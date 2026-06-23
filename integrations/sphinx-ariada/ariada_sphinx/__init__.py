from __future__ import annotations

from pathlib import Path
from typing import Any

from sphinx.application import Sphinx
from sphinx.errors import ExtensionError
from sphinx.util import logging

from.scanner import AriadaScanOptions, scan_sphinx_html

__all__ = ["AriadaScanOptions", "scan_sphinx_html", "setup"]

LOGGER = logging.getLogger(__name__)


def setup(app: Sphinx) -> dict[str, Any]:
 app.add_config_value("ariada_cli_command", "ariada", "html", types=[str])
 app.add_config_value("ariada_output_dir", "ariada-output", "html", types=[str])
 app.add_config_value("ariada_browser", "chromium", "html", types=[str])
 app.add_config_value("ariada_severity_threshold", "moderate", "html", types=[str])
 app.add_config_value("ariada_timeout_ms", 30_000, "html", types=[int])
 app.add_config_value("ariada_fail_on_violation", True, "html", types=[bool])
 app.connect("build-finished", _on_build_finished)
 return {"version": "0.1.0", "parallel_read_safe": True, "parallel_write_safe": True}


def _on_build_finished(app: Sphinx, exception: Exception | None) -> None:
 if exception is not None:
 return
 if app.builder.format != "html":
 LOGGER.info("ariada-sphinx: skipped non-HTML builder %s", app.builder.format)
 return

 output_dir = Path(app.confdir) / str(app.config.ariada_output_dir)
 result = scan_sphinx_html(
 Path(app.outdir),
 AriadaScanOptions(
 output_dir=output_dir,
 cli_command=str(app.config.ariada_cli_command),
 browser=str(app.config.ariada_browser),
 severity_threshold=str(app.config.ariada_severity_threshold),
 timeout_ms=int(app.config.ariada_timeout_ms),
),
)
 LOGGER.info(
 "ariada-sphinx: scanned %s with %s finding(s), exit %s",
 result.scanned_url,
 result.total_findings,
 result.exit_code,
)
 if result.stderr:
 LOGGER.warning("ariada-sphinx: %s", result.stderr.strip())
 if result.runtime_failed:
 raise ExtensionError(f"ariada-sphinx runtime failure: {result.stderr or result.stdout}")
 if result.gate_failed and bool(app.config.ariada_fail_on_violation):
 raise ExtensionError(
 f"ariada-sphinx found {result.total_findings} finding(s); "
 "set ariada_fail_on_violation = False to warn only"
)
