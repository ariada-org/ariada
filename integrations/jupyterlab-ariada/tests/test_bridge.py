from __future__ import annotations

import json
import subprocess
import urllib.request
from pathlib import Path

from jupyterlab_ariada.bridge import (
    AriadaScanOptions,
    count_findings,
    export_notebook_html,
    inline_notebook_with_html,
    scan_notebook,
)


def test_export_notebook_html_includes_rendered_output(tmp_path: Path) -> None:
    html = "<section><h1>Report</h1><img src='missing.png'><button></button></section>"
    notebook = inline_notebook_with_html(html)

    html_path = export_notebook_html(notebook, tmp_path)

    exported = html_path.read_text(encoding="utf-8")
    assert "Report" in exported
    assert "missing.png" in exported


def test_scan_notebook_serves_exported_html_to_ariada_runner(tmp_path: Path) -> None:
    notebook = inline_notebook_with_html("<main><h1>Sales</h1><button></button></main>")

    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
        url = command[command.index("scan") + 1]
        exported = urllib.request.urlopen(url, timeout=5).read().decode("utf-8")
        assert "Sales" in exported
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
                                {"ruleId": "button-name", "severity": "serious"}
                            ]
                        }
                    },
                }
            ),
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 1, "Wrote report\n", "")

    result = scan_notebook(
        notebook,
        AriadaScanOptions(output_dir=tmp_path, cli_command="ariada", no_fail=True),
        runner=fake_run,
    )

    assert result.exit_code == 0
    assert result.total_findings == 1
    assert result.report_path == tmp_path / "multi-domain-report.json"


def test_count_findings_accepts_cli_scan_json_shape() -> None:
    assert count_findings({"summary": {"total": 4}}) == 4
