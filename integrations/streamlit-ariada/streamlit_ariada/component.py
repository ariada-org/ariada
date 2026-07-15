from __future__ import annotations

from typing import Mapping


def render_summary(summary: Mapping[str, object]) -> None:
    try:
        import streamlit as st  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("Install streamlit-ariada[streamlit] to render in-app summaries") from exc

    total = summary.get("totalFindings", summary.get("total", 0))
    report_path = summary.get("reportPath", "not written")
    st.metric("Ariada findings", total)
    st.caption(f"Report: {report_path}")
