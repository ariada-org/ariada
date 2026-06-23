from __future__ import annotations

import argparse
import importlib
from pathlib import Path

from fastapi import FastAPI

from ariada_fastapi.scanner import configured_targets, default_options, scan_target


def load_app(spec: str) -> FastAPI:
    module_name, sep, attr = spec.partition(":")
    if not sep:
        raise ValueError("--app must use module:attribute syntax")
    module = importlib.import_module(module_name)
    app = getattr(module, attr)
    if not isinstance(app, FastAPI):
        raise TypeError(f"{spec} did not resolve to a FastAPI app")
    return app


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ariada_fastapi")
    parser.add_argument("targets", nargs="*")
    parser.add_argument("--app", required=True, help="FastAPI app as module:attribute.")
    parser.add_argument("--all", action="store_true", help="Scan configured targets.")
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--cli", default=None, help="Ariada CLI command.")
    parser.add_argument("--browser", default="chromium")
    parser.add_argument("--format", default="json")
    parser.add_argument("--severity-threshold", default="moderate")
    parser.add_argument("--timeout-ms", type=int, default=30_000)
    parser.add_argument("--domains", default="")
    parser.add_argument("--no-fail", action="store_true")
    args = parser.parse_args(argv)

    app = load_app(args.app)
    targets = list(args.targets)
    if args.all:
        targets.extend(configured_targets(app))
    if not targets:
        parser.error("provide a target or pass --all with configured targets")

    options = default_options(
        app,
        output_dir=Path(args.output_dir) if args.output_dir else None,
        cli_command=args.cli,
        browser=args.browser,
        format=args.format,
        severity_threshold=args.severity_threshold,
        timeout_ms=args.timeout_ms,
        domains=tuple(d.strip() for d in args.domains.split(",") if d.strip()),
    )

    exit_code = 0
    for target in targets:
        result = scan_target(app, target, options)
        print(
            f"{target} -> {result.scanned_url}: {result.total_findings} finding(s), "
            f"exit {result.exit_code}"
        )
        if result.report_path:
            print(f"report: {result.report_path}")
        if result.stderr:
            print(result.stderr)
        if result.runtime_failed:
            exit_code = max(exit_code, 3)
        elif result.gate_failed and not args.no_fail:
            exit_code = max(exit_code, 1)
    return exit_code
