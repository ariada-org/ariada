from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from streamlit_ariada.cli import main
from streamlit_ariada.scanner import AriadaScanOptions, count_findings, scan_url


def test_scan_url_invokes_ariada_cli_and_parses_report(tmp_path: Path) -> None:
    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
        out_dir = Path(command[command.index("--output-dir") + 1])
        out_dir.mkdir(parents=True, exist_ok=True)
        url = command[command.index("scan") + 1]
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

    result = scan_url(
        "http://127.0.0.1:8501",
        AriadaScanOptions(output_dir=tmp_path, cli_command="ariada", no_fail=True),
        runner=fake_run,
    )

    assert result.exit_code == 0
    assert result.total_findings == 2
    assert result.report_path == tmp_path / "multi-domain-report.json"


def test_scan_url_rejects_non_http_targets(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        scan_url("file:///tmp/app.html", AriadaScanOptions(output_dir=tmp_path))


def test_cli_returns_zero_with_no_fail_and_json_output(tmp_path: Path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    def fake_scan_url(app_url, options):  # type: ignore[no-untyped-def]
        from streamlit_ariada.scanner import AriadaScanResult

        return AriadaScanResult(app_url, 0, "", "", tmp_path / "report.json", 3)

    monkeypatch.setattr("streamlit_ariada.cli.scan_url", fake_scan_url)
    assert main(["scan", "http://localhost:8501", "--json", "--no-fail"]) == 0


def test_count_findings_accepts_cli_scan_json_shape() -> None:
    assert count_findings({"summary": {"total": 5}}) == 5
