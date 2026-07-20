from __future__ import annotations

import json
import subprocess
from pathlib import Path

from pelican.plugins.ariada.scanner import AriadaScanner, count_findings


def test_builds_shared_cli_scan_command() -> None:
    scanner = AriadaScanner(
        {
            "cli_command": "node ../../packages/ariada-cli/dist/bin.js",
            "output_dir": "tmp/out",
            "domains": ["accessibility", "privacy"],
        }
    )

    assert scanner.command_for("https://example.test") == [
        "node",
        "../../packages/ariada-cli/dist/bin.js",
        "scan",
        "https://example.test",
        "--format",
        "json",
        "--output-dir",
        "tmp/out",
        "--browser",
        "chromium",
        "--severity-threshold",
        "moderate",
        "--timeout-ms",
        "30000",
        "--domains",
        "accessibility,privacy",
    ]


def test_returns_gate_failure_from_fixture_json(tmp_path: Path) -> None:
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    (output_dir / "scan.json").write_text(
        json.dumps({"summary": {"total": 3}, "report": {"findings": []}}),
        encoding="utf-8",
    )

    def runner(command: list[str], **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(command, 1, "Wrote scan.json\n", "")

    result = AriadaScanner({"output_dir": str(output_dir)}, runner=runner).scan("https://example.test")

    assert result.gate_failed
    assert not result.runtime_failed
    assert result.total_findings == 3
    assert result.report_path and result.report_path.endswith("scan.json")


def test_counts_multi_domain_grid_findings() -> None:
    report = {
        "grid": {
            "https://example.test": {
                "accessibility": [{"ruleId": "image-alt"}],
                "security": [{"ruleId": "csp"}],
            }
        }
    }

    assert count_findings(report) == 2
