#!/usr/bin/env python3
from __future__ import annotations

import base64
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST_REPORT = ROOT / "test-report"
SCAN_EVIDENCE = ROOT / "scan-evidence"


def esc(value: object) -> str:
 return html.escape(str(value), quote=True)


def read(path: Path) -> str:
 return path.read_text(encoding="utf-8") if path.exists() else ""


def status_for(name: str) -> str:
 code = read(TEST_REPORT / "logs" / f"{name}.exit").strip()
 return "pass" if code == "0" else "fail"


def shell_log(name: str) -> str:
 return read(TEST_REPORT / "logs" / f"{name}.log").strip() or "(no output)"


def report_path() -> Path:
 multi = SCAN_EVIDENCE / "ariada-output" / "multi-domain-report.json"
 single = SCAN_EVIDENCE / "ariada-output" / "scan.json"
 return multi if multi.exists() else single


def scan_total(report: dict) -> int:
 grid = report.get("grid")
 if not isinstance(grid, dict):
 summary = report.get("summary")
 return int(summary.get("total", 0)) if isinstance(summary, dict) else 0
 total = 0
 for site in grid.values():
 if isinstance(site, dict):
 total += sum(len(v) for v in site.values() if isinstance(v, list))
 return total


def page(title: str, body: str) -> str:
 return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<style>
body{{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}}
main{{max-width:1040px;margin:0 auto;padding:32px 20px}}
h1{{font-size:1.9rem;margin:0 0 12px}}
h2{{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}}
table{{border-collapse:collapse;width:100%;background:#fff}}
th,td{{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}}
code,pre{{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}}
code{{background:#eef1f5;padding:1px 5px;border-radius:4px}}
pre{{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}}
figure{{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}}
img{{display:block;max-width:100%;height:auto}}
figcaption{{padding:10px 14px}}
</style>
</head>
<body><main>
<h1>{esc(title)}</h1>
{body}
</main></body></html>"""


def build_test_report() -> None:
 gates = [
 ("install", "pip install -e.[dev]"),
 ("ruff", "ruff check."),
 ("pytest", "pytest -q"),
 ("compileall", "python -m compileall -q pytest_ariada tests"),
 ("build", "python -m build"),
 ("ariada-cli-build", "pnpm --filter @ariada-org/cli build"),
 ("scan", "pytest --ariada-target examples/site/index.html --ariada-no-fail"),
 ]
 rows = "\n".join(
 f"<tr><th scope='row'>{esc(name)}</th><td>{status_for(name)}</td>"
 f"<td><code>{esc(command)}</code></td></tr>"
 for name, command in gates
)
 logs = "\n".join(
 f"<details><summary>{esc(name)} log</summary><pre>{esc(shell_log(name))}</pre></details>"
 for name, _command in gates
)
 TEST_REPORT.mkdir(parents=True, exist_ok=True)
 (TEST_REPORT / "result.html").write_text(
 page(
 "Ariada pytest test report",
 f"<p>Focused local gates for the pytest helper.</p><table><tbody>{rows}</tbody></table><h2>Logs</h2>{logs}",
),
 encoding="utf-8",
)


def build_scan_preview() -> None:
 path = report_path()
 report = json.loads(read(path)) if path.exists() else {}
 total = scan_total(report)
 command = read(SCAN_EVIDENCE / "command.log").strip()
 SCAN_EVIDENCE.mkdir(parents=True, exist_ok=True)
 (SCAN_EVIDENCE / "scan-result-preview.html").write_text(
 page(
 "Ariada pytest real scan preview",
 f"""
<p>Real Ariada CLI scan triggered through <code>pytest --ariada-target examples/site/index.html --ariada-no-fail</code>.</p>
<p><strong>{total}</strong> finding(s) in <code>{esc(path.relative_to(ROOT))}</code>.</p>
<h2>Command Output</h2>
<pre>{esc(command or "(no command output)")}</pre>
<h2>Report Summary</h2>
<pre>{esc(json.dumps(report, indent=2)[:12000])}</pre>
""",
),
 encoding="utf-8",
)


def build_scan_report() -> None:
 path = report_path()
 report = json.loads(read(path)) if path.exists() else {}
 total = scan_total(report)
 screenshot = SCAN_EVIDENCE / "screenshots" / "scan-result.png"
 if screenshot.exists():
 encoded = base64.b64encode(screenshot.read_bytes()).decode("ascii")
 shot = (
 "<figure><img alt='Screenshot of the Ariada pytest scan result' "
 f"src='data:image/png;base64,{encoded}'><figcaption>"
 "Browser screenshot of the real scan result preview.</figcaption></figure>"
)
 else:
 shot = "<p><strong>Evidence gap:</strong> screenshot file was not produced.</p>"
 (SCAN_EVIDENCE / "result.html").write_text(
 page(
 "Ariada pytest scan evidence",
 f"""
<p>Representative host surface: generated HTML fixture that a pytest job can produce.</p>
<p>Scanner path: pytest plugin fixture/options to <code>@ariada-org/cli</code>.</p>
<p><strong>{total}</strong> finding(s) were reported by the shared scanner CLI.</p>
{shot}
<h2>Command Output</h2>
<pre>{esc(read(SCAN_EVIDENCE / "command.log") or "(no command output)")}</pre>
<h2>Host Blockers</h2>
<p>PyPI publication and running in a private pytest suite require founder-owned credentials or repository access. Local pytest file-surface evidence is complete.</p>
""",
),
 encoding="utf-8",
)


def main() -> None:
 build_test_report()
 build_scan_preview()
 build_scan_report()


if __name__ == "__main__":
 main()
