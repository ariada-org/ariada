from __future__ import annotations

from pathlib import Path
from typing import Callable

import pytest

from .scanner import AriadaScanOptions, AriadaScanResult, scan_target


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("ariada")
    group.addoption("--ariada-target", action="store", help="Default URL or HTML file to scan.")
    group.addoption("--ariada-output-dir", action="store", default="ariada-output")
    group.addoption("--ariada-cli", action="store", default="ariada")
    group.addoption("--ariada-browser", action="store", default="chromium")
    group.addoption("--ariada-severity-threshold", action="store", default="moderate")
    group.addoption("--ariada-timeout-ms", action="store", type=int, default=30_000)
    group.addoption("--ariada-no-fail", action="store_true")


@pytest.fixture
def ariada_scan(pytestconfig: pytest.Config) -> Callable[[str | None], AriadaScanResult]:
    def run(target: str | None = None) -> AriadaScanResult:
        selected = target or pytestconfig.getoption("--ariada-target")
        if not selected:
            raise pytest.UsageError("Provide a target to ariada_scan() or --ariada-target")
        result = scan_target(
            selected,
            AriadaScanOptions(
                output_dir=Path(pytestconfig.getoption("--ariada-output-dir")),
                cli_command=pytestconfig.getoption("--ariada-cli"),
                browser=pytestconfig.getoption("--ariada-browser"),
                severity_threshold=pytestconfig.getoption("--ariada-severity-threshold"),
                timeout_ms=pytestconfig.getoption("--ariada-timeout-ms"),
                no_fail=pytestconfig.getoption("--ariada-no-fail"),
            ),
        )
        if result.exit_code != 0:
            pytest.fail(f"Ariada scan failed for {result.target}: exit {result.exit_code}")
        return result

    return run
