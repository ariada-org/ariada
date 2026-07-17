from __future__ import annotations

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from ariada_django.scanner import configured_targets, default_options, scan_target


class Command(BaseCommand):
    help = "Render Django paths and run the shared Ariada scanner CLI over the produced HTML."

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument(
            "targets",
            nargs="*",
            help="Django path, local HTML file, or URL to scan.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Scan ARIADA_SCAN_TARGETS from settings.",
        )
        parser.add_argument("--output-dir", default=None, help="Directory for Ariada JSON output.")
        parser.add_argument(
            "--cli",
            default=None,
            help="Ariada CLI command, e.g. 'ariada' or 'node dist/bin.js'.",
        )
        parser.add_argument("--browser", default="chromium", help="chromium, firefox, or webkit.")
        parser.add_argument("--format", default="json", help="human, json, or both.")
        parser.add_argument(
            "--severity-threshold",
            default="moderate",
            help="minor, moderate, serious, or critical.",
        )
        parser.add_argument("--timeout-ms", type=int, default=30_000)
        parser.add_argument("--domains", default="", help="Comma-separated Ariada domains to scan.")
        parser.add_argument(
            "--no-fail",
            action="store_true",
            help="Do not fail command on gate findings.",
        )

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        targets = list(options["targets"])
        if options["all"]:
            targets.extend(configured_targets())
        if not targets:
            raise CommandError(
                "Provide a target or pass --all with ARIADA_SCAN_TARGETS configured."
            )

        scan_options = default_options(
            output_dir=Path(options["output_dir"]) if options["output_dir"] else None,
            cli_command=options["cli"] or None,
            browser=options["browser"],
            format=options["format"],
            severity_threshold=options["severity_threshold"],
            timeout_ms=options["timeout_ms"],
            domains=tuple(d.strip() for d in options["domains"].split(",") if d.strip()),
        )

        failures = []
        runtime_errors = []
        for target in targets:
            result = scan_target(target, scan_options)
            self.stdout.write(
                f"{target} -> {result.scanned_url}: {result.total_findings} finding(s), "
                f"exit {result.exit_code}"
            )
            if result.report_path:
                self.stdout.write(f"report: {result.report_path}")
            if result.stderr:
                self.stderr.write(result.stderr)
            if result.runtime_failed:
                runtime_errors.append(target)
            elif result.gate_failed:
                failures.append(target)

        if runtime_errors:
            raise CommandError(f"Ariada runtime failed for: {', '.join(runtime_errors)}")
        if failures and not options["no_fail"]:
            raise CommandError(f"Ariada gate failed for: {', '.join(failures)}")
