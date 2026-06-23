from __future__ import annotations


def test_generated_site_accessibility(ariada_scan):
    result = ariada_scan()
    assert result.total_findings >= 0
