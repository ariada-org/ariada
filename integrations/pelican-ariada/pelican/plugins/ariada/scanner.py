from __future__ import annotations

import json
import shlex
import subprocess
import threading
from collections.abc import Mapping
from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

Runner = Callable[..., subprocess.CompletedProcess[str]]


class AriadaScanError(RuntimeError):
    """Raised for scanner orchestration failures, not Ariada findings."""


@dataclass(frozen=True)
class ScanResult:
    target: str
    scan_target: str
    exit_code: int
    stdout: str
    stderr: str
    report_path: str | None
    total_findings: int

    @property
    def gate_failed(self) -> bool:
        return self.exit_code == 1

    @property
    def runtime_failed(self) -> bool:
        return self.exit_code >= 2


class AriadaScanner:
    def __init__(
        self,
        options: Mapping[str, Any] | None = None,
        *,
        runner: Runner = subprocess.run,
    ) -> None:
        self.options = dict(options or {})
        self.runner = runner

    def scan(self, target: str) -> ScanResult:
        output_dir = Path(str(self.options.get("output_dir", "ariada-output")))
        output_dir.mkdir(parents=True, exist_ok=True)

        server: ThreadingHTTPServer | None = None
        thread: threading.Thread | None = None
        scan_target = target
        if Path(target).is_dir():
            server, thread, scan_target = serve_directory(Path(target))
        elif not is_http_url(target):
            message = f"Ariada target must be an existing directory or HTTP(S) URL: {target}"
            raise AriadaScanError(message)

        try:
            completed = self.runner(
                self.command_for(scan_target),
                text=True,
                capture_output=True,
                check=False,
            )
        finally:
            if server is not None:
                server.shutdown()
            if thread is not None:
                thread.join(timeout=5)

        report_path, total_findings = read_report_summary(output_dir)
        return ScanResult(
            target=target,
            scan_target=scan_target,
            exit_code=int(completed.returncode),
            stdout=completed.stdout or "",
            stderr=completed.stderr or "",
            report_path=str(report_path) if report_path else None,
            total_findings=total_findings,
        )

    def command_for(self, target: str) -> list[str]:
        command = shlex.split(str(self.options.get("cli_command", "ariada")))
        command += [
            "scan",
            target,
            "--format",
            str(self.options.get("format", "json")),
            "--output-dir",
            str(self.options.get("output_dir", "ariada-output")),
            "--browser",
            str(self.options.get("browser", "chromium")),
            "--severity-threshold",
            str(self.options.get("severity_threshold", "moderate")),
            "--timeout-ms",
            str(self.options.get("timeout_ms", 30_000)),
        ]
        domains = [str(item) for item in self.options.get("domains", []) if str(item)]
        if domains:
            command += ["--domains", ",".join(domains)]
        return command


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        return


def serve_directory(root: Path) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    class RootedHandler(QuietHandler):
        def __init__(self, *args: object, **kwargs: object) -> None:
            super().__init__(*args, directory=str(root), **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", 0), RootedHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, thread, f"http://{host}:{port}/"


def is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


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
        return sum(
            sum(len(findings) for findings in site.values() if isinstance(findings, list))
            for site in grid.values()
            if isinstance(site, dict)
        )
    report = data.get("report")
    findings = report.get("findings") if isinstance(report, dict) else None
    if isinstance(findings, list):
        return len(findings)
    if isinstance(findings, dict):
        return sum(len(value) for value in findings.values() if isinstance(value, list))
    return 0
