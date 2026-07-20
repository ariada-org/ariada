from __future__ import annotations

import json
import shlex
import subprocess
import threading
from contextlib import AbstractContextManager
from dataclasses import dataclass
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable
from urllib.parse import quote

import nbformat
from nbconvert import HTMLExporter

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
    notebook: str
    scanned_url: str
    exit_code: int
    stdout: str
    stderr: str
    report_path: Path | None
    total_findings: int
    html_path: Path

    @property
    def gate_failed(self) -> bool:
        return self.exit_code == 1

    @property
    def runtime_failed(self) -> bool:
        return self.exit_code >= 2

    def to_json(self) -> dict[str, object]:
        return {
            "notebook": self.notebook,
            "scannedUrl": self.scanned_url,
            "exitCode": self.exit_code,
            "totalFindings": self.total_findings,
            "reportPath": str(self.report_path) if self.report_path else None,
            "htmlPath": str(self.html_path),
            "gateFailed": self.gate_failed,
            "runtimeFailed": self.runtime_failed,
            "stdout": self.stdout,
            "stderr": self.stderr,
        }


def export_notebook_html(notebook: str | Path | dict[str, object], destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    if isinstance(notebook, dict):
        node = nbformat.from_dict(notebook)
        source_name = "notebook"
    else:
        source_path = Path(notebook)
        node = nbformat.read(source_path, as_version=4)
        source_name = source_path.stem

    body, _resources = HTMLExporter(template_name="classic").from_notebook_node(node)
    html_path = destination / f"{source_name}.html"
    html_path.write_text(body, encoding="utf-8")
    return html_path


def scan_notebook(
    notebook: str | Path | dict[str, object],
    options: AriadaScanOptions,
    runner: ProcessRunner = subprocess.run,
) -> AriadaScanResult:
    options.output_dir.mkdir(parents=True, exist_ok=True)
    html_path = export_notebook_html(notebook, options.output_dir / "html")
    with ServedHtml(html_path) as url:
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
        completed = runner(command, text=True, capture_output=True, check=False)

    report_path, total = read_report_summary(options.output_dir)
    exit_code = completed.returncode
    if options.no_fail and exit_code == 1:
        exit_code = 0
    return AriadaScanResult(
        notebook="inline" if isinstance(notebook, dict) else str(notebook),
        scanned_url=url,
        exit_code=exit_code,
        stdout=completed.stdout or "",
        stderr=completed.stderr or "",
        report_path=report_path,
        total_findings=total,
        html_path=html_path,
    )


class ServedHtml(AbstractContextManager[str]):
    def __init__(self, html_path: Path) -> None:
        self._html_path = html_path
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def __enter__(self) -> str:
        handler = partial(_QuietHandler, directory=str(self._html_path.parent))
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        host, port = self._server.server_address
        return f"http://{host}:{port}/{quote(self._html_path.name)}"

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
        if self._thread:
            self._thread.join(timeout=2)


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


def inline_notebook_with_html(html: str) -> dict[str, object]:
    return {
        "cells": [
            {
                "cell_type": "code",
                "execution_count": 1,
                "metadata": {},
                "outputs": [
                    {
                        "output_type": "display_data",
                        "metadata": {},
                        "data": {"text/html": html, "text/plain": "Ariada HTML fixture"},
                    }
                ],
                "source": "from IPython.display import HTML\nHTML(...)",
            }
        ],
        "metadata": {"kernelspec": {"name": "python3", "display_name": "Python 3"}},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
