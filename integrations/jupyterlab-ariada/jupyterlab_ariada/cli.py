from __future__ import annotations

import argparse
from pathlib import Path

from .bridge import AriadaScanOptions, scan_notebook


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m jupyterlab_ariada")
    parser.add_argument("notebook", help="Notebook .ipynb file to export and scan.")
    parser.add_argument("--output-dir", default="ariada-output")
    parser.add_argument("--cli", default="ariada", help="Ariada CLI command.")
    parser.add_argument("--browser", default="chromium")
    parser.add_argument("--format", default="json")
    parser.add_argument("--severity-threshold", default="moderate")
    parser.add_argument("--timeout-ms", type=int, default=30_000)
    parser.add_argument("--no-fail", action="store_true")
    args = parser.parse_args(argv)

    result = scan_notebook(
        args.notebook,
        AriadaScanOptions(
            output_dir=Path(args.output_dir),
            cli_command=args.cli,
            browser=args.browser,
            format=args.format,
            severity_threshold=args.severity_threshold,
            timeout_ms=args.timeout_ms,
            no_fail=args.no_fail,
        ),
    )
    print(
        f"{result.notebook} -> {result.scanned_url}: "
        f"{result.total_findings} finding(s), exit {result.exit_code}"
    )
    if result.report_path:
        print(f"report: {result.report_path}")
    if result.stderr:
        print(result.stderr)
    return result.exit_code
