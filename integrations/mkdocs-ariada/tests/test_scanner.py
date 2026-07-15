from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

from mkdocs.commands.build import build
from mkdocs.config import load_config

from mkdocs_ariada.scanner import AriadaScanOptions, count_findings, scan_mkdocs_site


def test_scan_mkdocs_site_serves_index_to_runner(tmp_path: Path) -> None:
    site_dir = tmp_path / "site"
    site_dir.mkdir()
    (site_dir / "index.html").write_text(
        "<html><body><h1>Docs</h1><img src='missing.png'><button></button></body></html>",
        encoding="utf-8",
    )

    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
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

    result = scan_mkdocs_site(
        site_dir,
        AriadaScanOptions(output_dir=tmp_path / "out", cli_command="ariada"),
        runner=fake_run,
    )

    assert result.gate_failed
    assert result.total_findings == 2
    assert result.report_path == tmp_path / "out" / "multi-domain-report.json"


def test_mkdocs_build_plugin_invokes_cli(tmp_path: Path) -> None:
    project = tmp_path / "project"
    docs = project / "docs"
    site = project / "site"
    docs.mkdir(parents=True)
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
    (project / "mkdocs.yml").write_text(
        "\n".join(
            [
                "site_name: Fixture Docs",
                "plugins:",
                "  - search",
                "  - ariada:",
                f"      cli_command: '{sys.executable} {fake_cli}'",
                "      output_dir: ariada-output",
                "      fail_on_violation: false",
            ]
        ),
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        "# Fixture Docs\n\n<img src='chart.png'><button></button>\n",
        encoding="utf-8",
    )

    config = load_config(config_file=str(project / "mkdocs.yml"), site_dir=str(site))
    build(config)

    command = json.loads(marker.read_text(encoding="utf-8"))
    assert "scan" in command
    assert "--output-dir" in command
    assert (site / "index.html").exists()


def test_count_findings_accepts_cli_scan_json_shape() -> None:
    assert count_findings({"summary": {"total": 5}}) == 5
