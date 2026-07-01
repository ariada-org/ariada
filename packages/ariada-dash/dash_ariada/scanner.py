from __future__ import annotations

import json
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

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
    app_url: str
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

    def to_json(self) -> dict[str, object]:
        return {
            "appUrl": self.app_url,
            "exitCode": self.exit_code,
            "totalFindings": self.total_findings,
            "reportPath": str(self.report_path) if self.report_path else None,
            "gateFailed": self.gate_failed,
            "runtimeFailed": self.runtime_failed,
            "stdout": self.stdout,
            "stderr": self.stderr,
        }


def scan_url(
    app_url: str,
    options: AriadaScanOptions,
    runner: ProcessRunner = subprocess.run,
) -> AriadaScanResult:
    if not is_http_url(app_url):
        raise ValueError(f"Dash app URL must be http(s): {app_url}")

    options.output_dir.mkdir(parents=True, exist_ok=True)
    command = [
        *shlex.split(options.cli_command),
        "scan",
        app_url,
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
    if options.no_fail and exit_code == 1:
        exit_code = 0
    return AriadaScanResult(
        app_url=app_url,
        exit_code=exit_code,
        stdout=completed.stdout or "",
        stderr=completed.stderr or "",
        report_path=report_path,
        total_findings=total,
    )


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
