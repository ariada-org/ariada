from __future__ import annotations

from .bridge import AriadaScanOptions, AriadaScanResult, export_notebook_html, scan_notebook

__all__ = [
    "AriadaScanOptions",
    "AriadaScanResult",
    "export_notebook_html",
    "scan_notebook",
]


def _jupyter_server_extension_points() -> list[dict[str, str]]:
    return [{"module": "jupyterlab_ariada.handlers"}]
