from __future__ import annotations

import json
from pathlib import Path

import pytest

from openedx_ariada.model import ReportParseError, ScanReport

FIXTURE = Path(__file__).parent / "fixtures" / "sample-scan.json"


def test_parses_cli_json_into_wcag_and_en301549_report() -> None:
    report = ScanReport.from_cli_json(FIXTURE.read_text(encoding="utf-8"))

    assert report.scan_id == "01JOPENEDXARIADA0000000000"
    assert report.exit_code == 1
    assert report.counts["critical"] == 1
    assert report.counts["serious"] == 1
    assert report.findings[0].rule_id == "image-alt"
    assert report.findings[0].wcag == ("1.1.1",)
    assert report.findings[0].en301549 == ("9.1.1.1",)
    assert report.findings[1].selector == ".course-title"


def test_storage_round_trip_retains_full_report() -> None:
    original = ScanReport.from_cli_json(FIXTURE.read_text(encoding="utf-8"))

    restored = ScanReport.from_storage_json(original.to_storage_json())

    assert restored == original
    assert restored.client_payload("/handler/full")["fullReportUrl"] == "/handler/full"


def test_rejects_summary_that_disagrees_with_findings() -> None:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    payload["summary"]["total"] = 99

    with pytest.raises(ReportParseError, match="summary total"):
        ScanReport.from_cli_json(payload)

