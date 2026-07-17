from __future__ import annotations

import json
import shlex
import subprocess
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, Iterator
from urllib.parse import quote, urlparse

ProcessRunner = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class AriadaScanOptions:
    output_dir: Path
    cli_command: str = "ariada"
    browser: str = "chromium"
    format: str = "json"
    severity_threshold: str = "moderate"
    timeout_ms: int = 30_000
    no_fail: bool = False


@dataclass(frozen=True)
class AriadaScanResult:
    target: str
    exit_code: int
    stdout: str
    stderr: str
    report_path: Path | None
    total_findings: int

    def to_json(self) -> dict[str, object]:
        return {
            "target": self.target,
            "exitCode": self.exit_code,
            "totalFindings": self.total_findings,
            "reportPath": str(self.report_path) if self.report_path else None,
            "stdout": self.stdout,
            "stderr": self.stderr,
        }


def scan_target(
    target: str,
    options: AriadaScanOptions,
    runner: ProcessRunner = subprocess.run,
) -> AriadaScanResult:
    with normalized_target(target) as normalized:
        options.output_dir.mkdir(parents=True, exist_ok=True)
        command = [
            *shlex.split(options.cli_command),
            "scan",
            normalized,
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
        completed = runner(command, text=True, capture_output=True, check=False)
        report_path, total = read_report_summary(options.output_dir)
        exit_code = completed.returncode
        if options.no_fail and exit_code == 1 and not looks_like_runtime_failure(completed.stderr or ""):
            exit_code = 0
        return AriadaScanResult(
            target=normalized,
            exit_code=exit_code,
            stdout=completed.stdout or "",
            stderr=completed.stderr or "",
            report_path=report_path,
            total_findings=total,
        )


@contextmanager
def normalized_target(target: str) -> Iterator[str]:
    if is_http_url(target):
        yield target
        return
    path = Path(target)
    if not path.exists() or path.suffix.lower() not in {".html", ".htm"}:
        raise ValueError(f"pytest Ariada target must be http(s) or an existing HTML file: {target}")
    handler = partial(SimpleHTTPRequestHandler, directory=str(path.resolve().parent))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}/{quote(path.name)}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


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
    if isinstance(summary, dict) and isinstance(summary.get("total", 0), int):
        return int(summary["total"])
    grid = data.get("grid")
    if isinstance(grid, dict):
        total = 0
        for site in grid.values():
            if isinstance(site, dict):
                total += sum(len(v) for v in site.values() if isinstance(v, list))
        return total
    report = data.get("report")
    if isinstance(report, dict):
        findings = report.get("findings")
        if isinstance(findings, list):
            return len(findings)
        if isinstance(findings, dict):
            return sum(len(v) for v in findings.values() if isinstance(v, list))
    return 0


def looks_like_runtime_failure(stderr: str) -> bool:
    markers = ("ERR_MODULE_NOT_FOUND", "command not found", "Cannot find package", "Traceback")
    return any(marker in stderr for marker in markers)
