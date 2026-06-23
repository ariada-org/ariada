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

ProcessRunner = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class AriadaScanOptions:
 output_dir: Path
 cli_command: str = "ariada"
 browser: str = "chromium"
 format: str = "json"
 severity_threshold: str = "moderate"
 timeout_ms: int = 30_000


@dataclass(frozen=True)
class AriadaScanResult:
 source_dir: Path
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


def scan_sphinx_html(
 html_dir: Path,
 options: AriadaScanOptions,
 runner: ProcessRunner = subprocess.run,
) -> AriadaScanResult:
 index = html_dir / "index.html"
 if not index.exists():
 html_files = sorted(html_dir.rglob("*.html"))
 if not html_files:
 raise FileNotFoundError(f"No HTML files found under {html_dir}")
 index = html_files[0]

 options.output_dir.mkdir(parents=True, exist_ok=True)
 with ServedDirectory(html_dir) as base_url:
 relative = index.relative_to(html_dir).as_posix()
 target_url = f"{base_url}/{quote(relative)}"
 command = [
 *shlex.split(options.cli_command),
 "scan",
 target_url,
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
 return AriadaScanResult(
 source_dir=html_dir,
 scanned_url=target_url,
 exit_code=completed.returncode,
 stdout=completed.stdout or "",
 stderr=completed.stderr or "",
 report_path=report_path,
 total_findings=total,
)


class ServedDirectory(AbstractContextManager[str]):
 def __init__(self, root: Path) -> None:
 self._root = root
 self._server: ThreadingHTTPServer | None = None
 self._thread: threading.Thread | None = None

 def __enter__(self) -> str:
 handler = partial(_QuietHandler, directory=str(self._root))
 self._server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
 self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
 self._thread.start()
 host, port = self._server.server_address
 return f"http://{host}:{port}"

 def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
 if self._server:
 self._server.shutdown()
 self._server.server_close()
 if self._thread:
 self._thread.join(timeout=2)


class _QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self, format: str, *args: object) -> None: # noqa: A002
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
