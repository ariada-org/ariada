from __future__ import annotations

import argparse
import json
from pathlib import Path

from .scanner import AriadaScanOptions, scan_url


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="streamlit-ariada")
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan")
    scan.add_argument("app_url")
    scan.add_argument("--output-dir", default="ariada-output")
    scan.add_argument("--cli", default="ariada", help="Ariada CLI command.")
    scan.add_argument("--browser", default="chromium")
    scan.add_argument("--format", default="json")
    scan.add_argument("--severity-threshold", default="moderate")
    scan.add_argument("--timeout-ms", type=int, default=30_000)
    scan.add_argument("--no-fail", action="store_true")
    scan.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    result = scan_url(
        args.app_url,
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
    if args.json:
        print(json.dumps(result.to_json(), indent=2))
    else:
        print(f"{result.app_url}: {result.total_findings} finding(s), exit {result.exit_code}")
        if result.report_path:
            print(f"report: {result.report_path}")
        if result.stderr:
            print(result.stderr)
    return result.exit_code
