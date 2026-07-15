from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from tox_nox_ariada.cli import main
from tox_nox_ariada.scanner import (
    AriadaScanOptions,
    count_findings,
    normalize_target,
    scan_target,
)
from tox_nox_ariada.snippets import nox_session_snippet, tox_env_snippet


def test_scan_target_invokes_ariada_cli_and_parses_report(tmp_path: Path) -> None:
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
                                {"ruleId": "button-name", "severity": "serious"},
                                {"ruleId": "page-title", "severity": "moderate"},
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
    assert result.total_findings == 2
    assert result.target.startswith("http://127.0.0.1:")
    assert result.target.endswith("/index.html")


def test_no_fail_does_not_hide_runtime_failures(tmp_path: Path) -> None:
    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
        return subprocess.CompletedProcess(command, 1, "", "ERR_MODULE_NOT_FOUND")

    result = scan_target(
        "https://example.test",
        AriadaScanOptions(output_dir=tmp_path, cli_command="ariada", no_fail=True),
        runner=fake_run,
    )

    assert result.exit_code == 1
    assert result.runtime_failed is False


def test_normalize_target_rejects_missing_files(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        normalize_target(str(tmp_path / "missing.html"))


def test_cli_returns_zero_with_no_fail_and_json_output(tmp_path: Path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    def fake_scan_target(target, options):  # type: ignore[no-untyped-def]
        from tox_nox_ariada.scanner import AriadaScanResult

        return AriadaScanResult(target, 0, "", "", tmp_path / "report.json", 3)

    monkeypatch.setattr("tox_nox_ariada.cli.scan_target", fake_scan_target)
    assert main(["scan", "https://example.test", "--json", "--no-fail"]) == 0


def test_count_findings_accepts_cli_scan_json_shape() -> None:
    assert count_findings({"summary": {"total": 5}}) == 5


def test_snippets_include_target() -> None:
    assert "site/index.html" in tox_env_snippet("site/index.html")
    assert "ariada-toxnox" in nox_session_snippet("site/index.html")
