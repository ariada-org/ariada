from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from pytest_ariada.scanner import AriadaScanOptions, count_findings, scan_target


def test_scan_target_serves_html_file_and_parses_report(tmp_path: Path) -> None:
    html = tmp_path / "site" / "index.html"
    html.parent.mkdir()
    html.write_text("<main><button></button></main>", encoding="utf-8")

    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
        out_dir = Path(command[command.index("--output-dir") + 1])
        out_dir.mkdir(parents=True, exist_ok=True)
        target = command[command.index("scan") + 1]
        (out_dir / "multi-domain-report.json").write_text(
            json.dumps(
                {
                    "sites": [target],
                    "domains": ["accessibility"],
                    "grid": {
                        target: {
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

    result = scan_target(
        str(html),
        AriadaScanOptions(output_dir=tmp_path / "out", cli_command="ariada", no_fail=True),
        runner=fake_run,
    )

    assert result.exit_code == 0
    assert result.total_findings == 1
    assert result.target.startswith("http://127.0.0.1:")


def test_count_findings_accepts_cli_scan_json_shape() -> None:
    assert count_findings({"summary": {"total": 5}}) == 5


def test_scan_target_rejects_missing_files(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        scan_target(str(tmp_path / "missing.html"), AriadaScanOptions(output_dir=tmp_path))


def test_pytester_runs_plugin_fixture(pytester) -> None:  # type: ignore[no-untyped-def]
    pytester.makepyfile(
        test_a11y="""
        def test_accessibility(ariada_scan, monkeypatch, tmp_path):
            import json
            import subprocess
            import pytest_ariada.plugin as plugin

            html = tmp_path / "index.html"
            html.write_text("<main><button></button></main>", encoding="utf-8")

            def fake_scan_target(target, options):
                from pytest_ariada.scanner import AriadaScanResult
                options.output_dir.mkdir(parents=True, exist_ok=True)
                report = options.output_dir / "multi-domain-report.json"
                report.write_text(json.dumps({"summary": {"total": 0}}), encoding="utf-8")
                return AriadaScanResult(target, 0, "", "", report, 0)

            monkeypatch.setattr(plugin, "scan_target", fake_scan_target)
            result = ariada_scan(str(html))
            assert result.exit_code == 0
        """
    )
    result = pytester.runpytest("-q")
    result.assert_outcomes(passed=1)
