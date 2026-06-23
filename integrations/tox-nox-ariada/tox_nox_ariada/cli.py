from __future__ import annotations

import argparse
import json
from pathlib import Path

from .scanner import AriadaScanOptions, scan_target
from .snippets import nox_session_snippet, tox_env_snippet


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ariada-toxnox")
    sub = parser.add_subparsers(dest="command", required=True)

    scan = sub.add_parser("scan", help="Scan a generated HTML file or served URL.")
    scan.add_argument("target")
    scan.add_argument("--output-dir", default="ariada-output")
    scan.add_argument("--cli", default="ariada", help="Ariada CLI command.")
    scan.add_argument("--browser", default="chromium")
    scan.add_argument("--format", default="json")
    scan.add_argument("--severity-threshold", default="moderate")
    scan.add_argument("--timeout-ms", type=int, default=30_000)
    scan.add_argument("--no-fail", action="store_true")
    scan.add_argument("--json", action="store_true")

    snippets = sub.add_parser("snippets", help="Print tox and nox recipe snippets.")
    snippets.add_argument("target")

    args = parser.parse_args(argv)
    if args.command == "snippets":
        print(tox_env_snippet(args.target))
        print()
        print(nox_session_snippet(args.target))
        return 0

    result = scan_target(
        args.target,
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
        print(f"{result.target}: {result.total_findings} finding(s), exit {result.exit_code}")
        if result.report_path:
            print(f"report: {result.report_path}")
        if result.stderr:
            print(result.stderr)
    return result.exit_code
