from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from mkdocs.config import config_options
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin

from .scanner import AriadaScanOptions, scan_mkdocs_site

LOGGER = logging.getLogger("mkdocs.plugins.ariada")


class AriadaMkDocsPlugin(BasePlugin):
    config_scheme = (
        ("cli_command", config_options.Type(str, default="ariada")),
        ("output_dir", config_options.Type(str, default="ariada-output")),
        ("browser", config_options.Type(str, default="chromium")),
        ("severity_threshold", config_options.Type(str, default="moderate")),
        ("timeout_ms", config_options.Type(int, default=30_000)),
        ("fail_on_violation", config_options.Type(bool, default=True)),
    )

    def on_post_build(self, config: dict[str, Any]) -> None:
        site_dir = Path(str(config["site_dir"]))
        output_dir = Path(str(self.config["output_dir"]))
        if not output_dir.is_absolute():
            output_dir = Path(str(config["config_file_path"])).parent / output_dir

        result = scan_mkdocs_site(
            site_dir,
            AriadaScanOptions(
                output_dir=output_dir,
                cli_command=str(self.config["cli_command"]),
                browser=str(self.config["browser"]),
                severity_threshold=str(self.config["severity_threshold"]),
                timeout_ms=int(self.config["timeout_ms"]),
            ),
        )
        LOGGER.info(
            "ariada-mkdocs: scanned %s with %s finding(s), exit %s",
            result.scanned_url,
            result.total_findings,
            result.exit_code,
        )
        if result.stderr:
            LOGGER.warning("ariada-mkdocs: %s", result.stderr.strip())
        if result.runtime_failed:
            raise PluginError(f"ariada-mkdocs runtime failure: {result.stderr or result.stdout}")
        if result.gate_failed and bool(self.config["fail_on_violation"]):
            raise PluginError(
                f"ariada-mkdocs found {result.total_findings} finding(s); "
                "set fail_on_violation: false to warn only"
            )
