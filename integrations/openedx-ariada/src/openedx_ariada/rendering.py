"""HTML rendering for the staff-only full report."""

from __future__ import annotations

from html import escape

from .model import Finding, ScanReport


def _standards(finding: Finding) -> str:
    parts: list[str] = []
    if finding.wcag:
        parts.append("WCAG " + ", ".join(escape(item) for item in finding.wcag))
    if finding.en301549:
        parts.append("EN 301 549 " + ", ".join(escape(item) for item in finding.en301549))
    return " | ".join(parts) if parts else "No standard reference supplied"


def render_full_report(report: ScanReport) -> str:
    """Render a standalone, script-free report with escaped scanner content."""

    counts = report.counts
    cards = "".join(
        f'<li><strong>{counts[impact]}</strong><span>{escape(impact)}</span></li>'
        for impact in ("critical", "serious", "moderate", "minor", "unknown")
    )
    findings = []
    for index, finding in enumerate(report.findings, start=1):
        selector = (
            f"<p><strong>Selector:</strong> <code>{escape(finding.selector)}</code></p>"
            if finding.selector
            else ""
        )
        help_link = (
            f'<p><a href="{escape(finding.help_url, quote=True)}" rel="noreferrer">'
            "Rule documentation</a></p>"
            if finding.help_url and finding.help_url.startswith(("https://", "http://"))
            else ""
        )
        findings.append(
            "<article>"
            f"<h2>{index}. {escape(finding.rule_id)}</h2>"
            f'<p class="impact impact-{escape(finding.severity)}">'
            f"{escape(finding.severity)}</p>"
            f"<p>{escape(finding.message)}</p>"
            f"<p><strong>Standards:</strong> {_standards(finding)}</p>"
            f"{selector}{help_link}</article>"
        )
    body = "".join(findings) or "<p>No accessibility findings were reported.</p>"
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ariada accessibility report</title>
  <style>
    :root {{ color-scheme: light; --ink:#17211d; --paper:#f5f1e8; --line:#c7bfae;
      --accent:#006b54; --danger:#a42a1e; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; color:var(--ink); background:var(--paper);
      font:16px/1.55 Georgia, "Times New Roman", serif; }}
    main {{ width:min(960px, calc(100% - 2rem)); margin:2rem auto 5rem; }}
    h1,h2 {{ line-height:1.15; }}
    .meta {{ border-block:1px solid var(--line); padding:1rem 0; overflow-wrap:anywhere; }}
    .counts {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
      gap:.75rem; padding:0; list-style:none; }}
    .counts li {{ background:#fff; border:1px solid var(--line); padding:.9rem; }}
    .counts strong,.counts span {{ display:block; }}
    .counts strong {{ font:700 1.7rem/1 sans-serif; }}
    article {{ position:relative; margin:1rem 0; padding:1rem 1.2rem;
      background:#fff; border:1px solid var(--line); }}
    article h2 {{ padding-right:7rem; font-size:1.2rem; }}
    .impact {{ position:absolute; top:.8rem; right:1rem; margin:0; font:700 .75rem/1 sans-serif;
      letter-spacing:.08em; text-transform:uppercase; color:var(--danger); }}
    code {{ overflow-wrap:anywhere; }}
    a {{ color:var(--accent); }}
  </style>
</head>
<body>
<main>
  <header>
    <p>Ariada / Open edX</p>
    <h1>Accessibility report</h1>
    <p class="meta"><strong>Page:</strong> {escape(report.url)}<br>
      <strong>Scan:</strong> {escape(report.scan_id)}<br>
      <strong>Duration:</strong> {report.duration_ms} ms</p>
  </header>
  <ul class="counts" aria-label="Findings by impact">{cards}</ul>
  <section aria-labelledby="findings-heading">
    <h2 id="findings-heading">All findings ({len(report.findings)})</h2>
    {body}
  </section>
</main>
</body>
</html>
"""

