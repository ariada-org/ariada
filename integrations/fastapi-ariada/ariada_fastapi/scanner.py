from __future__ import annotations

import json
import shlex
import subprocess
import tempfile
import threading
from contextlib import AbstractContextManager
from dataclasses import dataclass
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.testclient import TestClient

Severity = str
ProcessRunner = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class ScanOptions:
    output_dir: Path
    cli_command: str = "ariada"
    browser: str = "chromium"
    format: str = "json"
    severity_threshold: Severity = "moderate"
    timeout_ms: int = 30_000
    domains: tuple[str, ...] = ()


@dataclass(frozen=True)
class AriadaScanResult:
    target: str
    scanned_url: str
    exit_code: int
    stdout: str
    stderr: str
    report_path: Path | None
    total_findings: int

    @property
    def gate_failed(self) -> bool:
        return self.exit_code == 1

    @property
    def runtime_failed(self) -> bool:
        return self.exit_code >= 2


class AriadaCliRunner:
    def __init__(self, process_runner: ProcessRunner = subprocess.run) -> None:
        self._process_runner = process_runner

    def run(self, url: str, options: ScanOptions) -> AriadaScanResult:
        options.output_dir.mkdir(parents=True, exist_ok=True)
        command = [
            *shlex.split(options.cli_command),
            "scan",
            url,
            "--format",
            options.format,
            "--output-dir",
            str(options.output_dir),
            "--browser",
            options.browser,
            "--severity-threshold",
            options.severity_threshold,
            "--timeout-ms",
            str(options.timeout_ms),
        ]
        if options.domains:
            command.extend(["--domains", ",".join(options.domains)])

        completed = self._process_runner(command, text=True, capture_output=True, check=False)
        report_path, total = read_report_summary(options.output_dir)
        return AriadaScanResult(
            target=url,
            scanned_url=url,
            exit_code=completed.returncode,
            stdout=completed.stdout or "",
            stderr=completed.stderr or "",
            report_path=report_path,
            total_findings=total,
        )


def default_options(app: FastAPI, **overrides: object) -> ScanOptions:
    output_dir_value = overrides.get("output_dir") or getattr(
        app.state,
        "ariada_scan_output_dir",
        "ariada-output",
    )
    domains_raw = overrides.get("domains", getattr(app.state, "ariada_scan_domains", ()))
    return ScanOptions(
        output_dir=Path(str(output_dir_value)),
        cli_command=str(
            overrides.get("cli_command") or getattr(app.state, "ariada_cli_command", "ariada")
        ),
        browser=str(
            overrides.get("browser", getattr(app.state, "ariada_scan_browser", "chromium"))
        ),
        format=str(overrides.get("format", "json")),
        severity_threshold=str(
            overrides.get(
                "severity_threshold",
                getattr(app.state, "ariada_scan_severity_threshold", "moderate"),
            )
        ),
        timeout_ms=int(
            overrides.get("timeout_ms", getattr(app.state, "ariada_scan_timeout_ms", 30_000))
        ),
        domains=tuple(domains_raw or ()),
    )


def configured_targets(app: FastAPI) -> list[str]:
    return [str(target) for target in getattr(app.state, "ariada_scan_targets", [])]


def scan_target(
    app: FastAPI,
    target: str,
    options: ScanOptions,
    runner: AriadaCliRunner | None = None,
) -> AriadaScanResult:
    active_runner = runner or AriadaCliRunner()
    if is_http_url(target):
        return active_runner.run(target, options)

    html = render_target_to_html(app, target)
    with ServedHtml(html) as served_url:
        result = active_runner.run(served_url, options)
    return AriadaScanResult(
        target=target,
        scanned_url=result.scanned_url,
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        report_path=result.report_path,
        total_findings=result.total_findings,
    )


def render_target_to_html(app: FastAPI, target: str) -> bytes:
    path = Path(target)
    if path.exists() and path.is_file():
        return path.read_bytes()

    fastapi_path = target if target.startswith("/") else f"/{target}"
    response = TestClient(app).get(fastapi_path)
    if response.status_code >= 400:
        raise ValueError(f"FastAPI path {fastapi_path} returned HTTP {response.status_code}")
    return bytes(response.content)


class ServedHtml(AbstractContextManager[str]):
    def __init__(self, html: bytes) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="ariada-fastapi-")
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._html = html

    def __enter__(self) -> str:
        root = Path(self._tmp.name)
        (root / "index.html").write_bytes(self._html)
        handler = partial(_QuietHandler, directory=str(root))
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        host, port = self._server.server_address
        return f"http://{host}:{port}/{quote('index.html')}"

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
        if self._thread:
            self._thread.join(timeout=2)
        self._tmp.cleanup()


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return


def read_report_summary(output_dir: Path) -> tuple[Path | None, int]:
    for name in ("multi-domain-report.json", "scan.json"):
        path = output_dir / name
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return path, count_findings(data)
    return None, 0


def count_findings(data: object) -> int:
    if not isinstance(data, dict):
        return 0
    summary = data.get("summary")
    if isinstance(summary, dict) and isinstance(summary.get("total"), int):
        return int(summary["total"])
    grid = data.get("grid")
    if isinstance(grid, dict):
        total = 0
        for site in grid.values():
            if isinstance(site, dict):
                for findings in site.values():
                    if isinstance(findings, list):
                        total += len(findings)
        return total
    report = data.get("report")
    if isinstance(report, dict):
        findings = report.get("findings")
        if isinstance(findings, list):
            return len(findings)
        if isinstance(findings, dict):
            return sum(len(v) for v in findings.values() if isinstance(v, list))
    return 0


def is_http_url(value: str) -> bool:
    return value.startswith(("http://", "https://"))
