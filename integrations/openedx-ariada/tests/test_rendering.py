from __future__ import annotations

from openedx_ariada.model import Finding, ScanReport
from openedx_ariada.rendering import render_full_report


def test_full_report_escapes_scanner_content_and_lists_standards() -> None:
    report = ScanReport(
        url="https://courses.example.edu/unit?<unsafe>",
        scan_id="scan-1",
        started_at="",
        completed_at="",
        duration_ms=12,
        exit_code=1,
        findings=(
            Finding(
                rule_id="<image-alt>",
                severity="critical",
                message="<script>alert(1)</script>",
                wcag=("1.1.1",),
                en301549=("9.1.1.1",),
                selector="img[data-name='<hero>']",
            ),
        ),
    )

    rendered = render_full_report(report)

    assert "<script>alert(1)</script>" not in rendered
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in rendered
    assert "WCAG 1.1.1" in rendered
    assert "EN 301 549 9.1.1.1" in rendered

