from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

from sphinx.cmd.build import build_main

from ariada_sphinx.scanner import AriadaScanOptions, count_findings, scan_sphinx_html


def test_scan_sphinx_html_serves_index_to_runner(tmp_path: Path) -> None:
 html_dir = tmp_path / "html"
 html_dir.mkdir()
 (html_dir / "index.html").write_text(
 "<html><body><h1>Docs</h1><img src='missing.png'><button></button></body></html>",
 encoding="utf-8",
)

 def fake_run(command, **_kwargs): # type: ignore[no-untyped-def]
 url = command[command.index("scan") + 1]
 html = urllib.request.urlopen(url, timeout=5).read().decode("utf-8")
 assert "Docs" in html
 out_dir = Path(command[command.index("--output-dir") + 1])
 out_dir.mkdir(parents=True, exist_ok=True)
 (out_dir / "multi-domain-report.json").write_text(
 json.dumps(
 {
 "sites": [url],
 "domains": ["accessibility"],
 "grid": {
 url: {
 "accessibility": [
 {"ruleId": "image-alt", "severity": "critical"},
 {"ruleId": "button-name", "severity": "serious"},
 ]
 }
 },
 }
),
 encoding="utf-8",
)
 return subprocess.CompletedProcess(command, 1, "Wrote report\n", "")

 result = scan_sphinx_html(
 html_dir,
 AriadaScanOptions(output_dir=tmp_path / "out", cli_command="ariada"),
 runner=fake_run,
)

 assert result.gate_failed
 assert result.total_findings == 2
 assert result.report_path == tmp_path / "out" / "multi-domain-report.json"


def test_sphinx_build_extension_invokes_cli(tmp_path: Path) -> None:
 src = tmp_path / "docs"
 out = tmp_path / "_build" / "html"
 src.mkdir()
 fake_cli = tmp_path / "fake_ariada.py"
 marker = tmp_path / "scan-command.json"
 fake_cli.write_text(
 f"""
import json
import sys
from pathlib import Path

marker = Path({str(marker)!r})
command = sys.argv[1:]
out_dir = Path(command[command.index("--output-dir") + 1])
out_dir.mkdir(parents=True, exist_ok=True)
url = command[command.index("scan") + 1]
(out_dir / "multi-domain-report.json").write_text(json.dumps({{
 "sites": [url],
 "domains": ["accessibility"],
 "grid": {{url: {{"accessibility": [{{"ruleId": "doc-heading", "severity": "serious"}}]}}}}
}}), encoding="utf-8")
marker.write_text(json.dumps(command), encoding="utf-8")
print("Wrote report")
sys.exit(1)
""",
 encoding="utf-8",
)
 (src / "conf.py").write_text(
 "\n".join(
 [
 "extensions = ['ariada_sphinx']",
 f"ariada_cli_command = '{sys.executable} {fake_cli}'",
 "ariada_output_dir = '_ariada-output'",
 "ariada_fail_on_violation = False",
 "html_theme = 'alabaster'",
 ]
),
 encoding="utf-8",
)
 (src / "index.rst").write_text(
 "Fixture Docs\n============\n\n.. raw:: html\n\n <img src='chart.png'><button></button>\n",
 encoding="utf-8",
)

 assert build_main(["-b", "html", str(src), str(out)]) == 0

 command = json.loads(marker.read_text(encoding="utf-8"))
 assert "scan" in command
 assert "--output-dir" in command
 assert (out / "index.html").exists()


def test_count_findings_accepts_cli_scan_json_shape() -> None:
 assert count_findings({"summary": {"total": 5}}) == 5
