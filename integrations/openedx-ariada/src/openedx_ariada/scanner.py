"""Safe process boundary for the wheel-embedded Ariada runtime."""

from __future__ import annotations

import hashlib
import io
import ipaddress
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import time
from dataclasses import dataclass
from importlib import resources
from pathlib import Path, PurePosixPath
from urllib.parse import SplitResult, urlsplit, urlunsplit

from .model import ReportParseError, ScanReport

RUNTIME_FILENAME = "ariada-openedx-runtime-0.1.0.tgz"
RUNTIME_PACKAGE_NAME = "@ariada-integrations/openedx-runtime"
RUNTIME_VERSION = "0.1.0"
MAX_EXTRACTED_BYTES = 256 * 1024 * 1024


class AriadaConfigurationError(RuntimeError):
    """Raised for missing or unsafe administrator configuration."""


class TargetValidationError(ValueError):
    """Raised when a requested target is outside the configured boundary."""


class AriadaProcessError(RuntimeError):
    """Raised when the real scanner process cannot produce a valid report."""


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _hosts_from_environment() -> tuple[str, ...]:
    configured = os.environ.get("OPENEDX_ARIADA_ALLOWED_HOSTS", "")
    if not configured.strip():
        configured = os.environ.get("LMS_HOST", "")
    return tuple(
        dict.fromkeys(
            host.strip().lower().rstrip(".")
            for host in configured.split(",")
            if host.strip()
        )
    )


@dataclass(frozen=True, slots=True)
class ScannerConfig:
    """Administrator-owned scanner process configuration."""

    node_binary: str = "node"
    browser: str = "chromium"
    browser_channel: str | None = "chrome"
    timeout_ms: int = 45_000
    process_timeout_seconds: int = 75
    allowed_hosts: tuple[str, ...] = ()
    allow_private: bool = False
    storage_state: Path | None = None
    runtime_cache: Path = Path(tempfile.gettempdir()) / "openedx-ariada-runtime"
    max_report_bytes: int = 10 * 1024 * 1024

    @classmethod
    def from_environment(cls) -> ScannerConfig:
        timeout_ms = int(os.environ.get("OPENEDX_ARIADA_TIMEOUT_MS", "45000"))
        if timeout_ms < 1_000 or timeout_ms > 120_000:
            raise AriadaConfigurationError("OPENEDX_ARIADA_TIMEOUT_MS must be 1000..120000")
        process_timeout = max(30, min(180, (timeout_ms // 1000) + 30))
        storage_value = os.environ.get("OPENEDX_ARIADA_STORAGE_STATE", "").strip()
        channel_value = os.environ.get("OPENEDX_ARIADA_BROWSER_CHANNEL", "chrome").strip()
        allowed_hosts = _hosts_from_environment()
        allow_private = _env_flag("OPENEDX_ARIADA_ALLOW_PRIVATE")
        if allow_private and not allowed_hosts:
            raise AriadaConfigurationError(
                "private routing requires OPENEDX_ARIADA_ALLOWED_HOSTS"
            )
        return cls(
            node_binary=os.environ.get("OPENEDX_ARIADA_NODE", "node"),
            browser_channel=channel_value or None,
            timeout_ms=timeout_ms,
            process_timeout_seconds=process_timeout,
            allowed_hosts=allowed_hosts,
            allow_private=allow_private,
            storage_state=Path(storage_value) if storage_value else None,
            runtime_cache=Path(
                os.environ.get(
                    "OPENEDX_ARIADA_RUNTIME_CACHE",
                    str(Path(tempfile.gettempdir()) / "openedx-ariada-runtime"),
                )
            ),
        )


def _normalized_target(value: str, config: ScannerConfig) -> str:
    try:
        parsed = urlsplit(value)
    except ValueError as exc:
        raise TargetValidationError("target must be a valid HTTP(S) URL") from exc
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise TargetValidationError("target must be a valid HTTP(S) URL")
    if parsed.username is not None or parsed.password is not None:
        raise TargetValidationError("URL credentials are forbidden")
    host = parsed.hostname.lower().rstrip(".")
    if not config.allowed_hosts:
        raise AriadaConfigurationError(
            "configure OPENEDX_ARIADA_ALLOWED_HOSTS or LMS_HOST before scanning"
        )
    if host not in config.allowed_hosts:
        raise TargetValidationError("target host is outside OPENEDX_ARIADA_ALLOWED_HOSTS")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and not address.is_global and not config.allow_private:
        raise TargetValidationError("private and reserved IP targets are forbidden")
    clean = SplitResult(parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, "")
    return urlunsplit(clean)


def _safe_child_environment(config: ScannerConfig) -> dict[str, str]:
    keep = (
        "HOME",
        "LANG",
        "LC_ALL",
        "NODE_EXTRA_CA_CERTS",
        "NO_PROXY",
        "PATH",
        "SSL_CERT_FILE",
        "TMPDIR",
        "http_proxy",
        "https_proxy",
        "no_proxy",
    )
    child = {name: os.environ[name] for name in keep if name in os.environ}
    child["PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"] = "1"
    if config.storage_state is not None:
        child["OPENEDX_ARIADA_STORAGE_STATE"] = str(config.storage_state)
    return child


def _read_runtime_bytes() -> bytes:
    artifact = resources.files("openedx_ariada").joinpath("runtime", RUNTIME_FILENAME)
    return artifact.read_bytes()


def _extract_runtime(payload: bytes, destination: Path) -> None:
    total = 0
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        members = archive.getmembers()
        for member in members:
            path = PurePosixPath(member.name)
            if (
                path.is_absolute()
                or ".." in path.parts
                or not path.parts
                or path.parts[0] != "package"
            ):
                raise AriadaConfigurationError("embedded runtime contains an unsafe path")
            if member.issym() or member.islnk() or member.isdev():
                raise AriadaConfigurationError(
                    "embedded runtime contains a forbidden link or device"
                )
            if member.isfile():
                total += member.size
                if total > MAX_EXTRACTED_BYTES:
                    raise AriadaConfigurationError("embedded runtime exceeds its extraction limit")
        for member in members:
            relative = PurePosixPath(member.name)
            target = destination.joinpath(*relative.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            source = archive.extractfile(member)
            if source is None:
                raise AriadaConfigurationError("embedded runtime member cannot be read")
            with source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
            target.chmod(member.mode & 0o777)


def runtime_entrypoint(config: ScannerConfig) -> Path:
    """Extract the immutable npm artifact atomically and return its scanner entry."""

    payload = _read_runtime_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    root = config.runtime_cache
    target = root / digest
    entry = target / "bin" / "scan.mjs"
    marker = target / ".ariada-runtime.json"
    if entry.is_file() and marker.is_file():
        return entry
    root.mkdir(parents=True, exist_ok=True)
    lock = root / f"{digest}.lock"
    deadline = time.monotonic() + 30
    descriptor: int | None = None
    while descriptor is None:
        try:
            descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            if entry.is_file() and marker.is_file():
                return entry
            if time.monotonic() >= deadline:
                raise AriadaConfigurationError(
                    "timed out waiting for runtime extraction"
                ) from None
            time.sleep(0.1)
    os.close(descriptor)
    temporary = Path(tempfile.mkdtemp(prefix=f".{digest}-", dir=root))
    try:
        if entry.is_file() and marker.is_file():
            return entry
        _extract_runtime(payload, temporary)
        package = temporary / "package"
        manifest_path = package / "package.json"
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise AriadaConfigurationError("embedded runtime manifest is unreadable") from exc
        if (
            manifest.get("name") != RUNTIME_PACKAGE_NAME
            or manifest.get("version") != RUNTIME_VERSION
        ):
            raise AriadaConfigurationError("embedded runtime identity is invalid")
        (package / ".ariada-runtime.json").write_text(
            json.dumps({"sha256": digest, "version": RUNTIME_VERSION}) + "\n",
            encoding="utf-8",
        )
        try:
            os.replace(package, target)
        except FileExistsError:
            pass
        if not entry.is_file():
            raise AriadaConfigurationError("embedded runtime scanner entry is missing")
        return entry
    finally:
        shutil.rmtree(temporary, ignore_errors=True)
        lock.unlink(missing_ok=True)


def _process_error(stderr: str) -> str:
    line = next((item.strip() for item in reversed(stderr.splitlines()) if item.strip()), "")
    if not line:
        return "Ariada scanner failed without diagnostic output"
    return f"Ariada scanner failed: {line[:500]}"


class AriadaScanner:
    """Invoke the real packed Ariada CLI and return a strict report model."""

    def __init__(self, config: ScannerConfig | None = None) -> None:
        self.config = config or ScannerConfig.from_environment()

    def _runtime_entrypoint(self) -> Path:
        return runtime_entrypoint(self.config)

    def scan(self, target: str) -> ScanReport:
        normalized = _normalized_target(target, self.config)
        if self.config.storage_state is not None and not self.config.storage_state.is_file():
            raise AriadaConfigurationError("configured storage-state file is unavailable")
        entry = self._runtime_entrypoint()
        with tempfile.TemporaryDirectory(prefix="openedx-ariada-scan-") as temporary:
            output = Path(temporary)
            command = [
                self.config.node_binary,
                str(entry),
                normalized,
                "--output-dir",
                str(output),
                "--browser",
                self.config.browser,
                "--severity-threshold",
                "minor",
                "--timeout-ms",
                str(self.config.timeout_ms),
            ]
            if self.config.browser_channel:
                command.extend(["--browser-channel", self.config.browser_channel])
            if self.config.allow_private:
                command.append("--allow-private")
            try:
                completed = subprocess.run(
                    command,
                    check=False,
                    capture_output=True,
                    text=True,
                    shell=False,
                    timeout=self.config.process_timeout_seconds,
                    env=_safe_child_environment(self.config),
                )
            except FileNotFoundError as exc:
                raise AriadaConfigurationError("configured Node executable is unavailable") from exc
            except subprocess.TimeoutExpired as exc:
                raise AriadaProcessError("Ariada scanner exceeded its process timeout") from exc
            if completed.returncode not in (0, 1):
                raise AriadaProcessError(_process_error(completed.stderr))
            report_path = output / "scan.json"
            try:
                size = report_path.stat().st_size
            except OSError as exc:
                raise AriadaProcessError("Ariada scanner did not produce scan.json") from exc
            if size > self.config.max_report_bytes:
                raise AriadaProcessError("Ariada scanner report exceeds the configured size limit")
            try:
                report = ScanReport.from_cli_json(report_path.read_text(encoding="utf-8"))
            except (OSError, ReportParseError) as exc:
                raise AriadaProcessError(f"invalid Ariada scanner report: {exc}") from exc
            if report.url != normalized:
                raise AriadaProcessError("Ariada scanner report URL does not match the target")
            if report.exit_code != completed.returncode:
                raise AriadaProcessError("Ariada scanner process and report exit codes disagree")
            return report
