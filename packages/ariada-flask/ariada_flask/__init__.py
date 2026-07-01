from __future__ import annotations

import click
from flask import Flask

from ariada_flask.scanner import configured_targets, default_options, scan_target

__all__ = ["__version__", "init_app"]

__version__ = "0.1.0"


def init_app(app: Flask) -> None:
    @app.cli.command("ariada-scan")
    @click.argument("targets", nargs=-1)
    @click.option("--all", "scan_all", is_flag=True, help="Scan ARIADA_SCAN_TARGETS.")
    @click.option("--output-dir", default=None, help="Directory for Ariada JSON output.")
    @click.option("--cli", "cli_command", default=None, help="Ariada CLI command.")
    @click.option("--browser", default="chromium", help="chromium, firefox, or webkit.")
    @click.option("--format", "output_format", default="json", help="human, json, or both.")
    @click.option("--severity-threshold", default="moderate")
    @click.option("--timeout-ms", default=30_000, type=int)
    @click.option("--domains", default="", help="Comma-separated Ariada domains to scan.")
    @click.option("--no-fail", is_flag=True, help="Do not fail command on gate findings.")
    def ariada_scan(
        targets: tuple[str, ...],
        scan_all: bool,
        output_dir: str | None,
        cli_command: str | None,
        browser: str,
        output_format: str,
        severity_threshold: str,
        timeout_ms: int,
        domains: str,
        no_fail: bool,
    ) -> None:
        selected = list(targets)
        if scan_all:
            selected.extend(configured_targets(app))
        if not selected:
            raise click.ClickException(
                "Provide a target or pass --all with ARIADA_SCAN_TARGETS configured."
            )

        options = default_options(
            app,
            output_dir=output_dir,
            cli_command=cli_command,
            browser=browser,
            format=output_format,
            severity_threshold=severity_threshold,
            timeout_ms=timeout_ms,
            domains=tuple(d.strip() for d in domains.split(",") if d.strip()),
        )

        failures: list[str] = []
        runtime_errors: list[str] = []
        for target in selected:
            result = scan_target(app, target, options)
            click.echo(
                f"{target} -> {result.scanned_url}: {result.total_findings} finding(s), "
                f"exit {result.exit_code}"
            )
            if result.report_path:
                click.echo(f"report: {result.report_path}")
            if result.stderr:
                click.echo(result.stderr, err=True)
            if result.runtime_failed:
                runtime_errors.append(target)
            elif result.gate_failed:
                failures.append(target)

        if runtime_errors:
            raise click.ClickException(f"Ariada runtime failed for: {', '.join(runtime_errors)}")
        if failures and not no_fail:
            raise click.ClickException(f"Ariada gate failed for: {', '.join(failures)}")
