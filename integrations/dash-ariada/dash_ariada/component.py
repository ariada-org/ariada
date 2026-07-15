from __future__ import annotations

from typing import Mapping


def render_summary(summary: Mapping[str, object], *, id: str = "ariada-summary"):
    """Return a small Dash component tree for embedding scan status in an app."""

    try:
        from dash import html  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("Install dash-ariada[dash] to render in-app summaries") from exc

    total = summary.get("totalFindings", summary.get("total", 0))
    report_path = summary.get("reportPath", "not written")
    return html.Div(
        [
            html.Strong("Ariada findings"),
            html.Span(str(total), **{"aria-label": f"{total} Ariada findings"}),
            html.Small(f"Report: {report_path}"),
        ],
        id=id,
        role="status",
    )
