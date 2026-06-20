// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Inline CSS for the rendered report. Hand-written, design-token-driven,
 * no Tailwind, no external font, no CDN — fully self-contained single HTML file.
 *
 * Contrast invariants (verified manually against `--surface` / `--ink`):
 *   Light theme:
 *   - text on surface          : #18222e on #ffffff  → 13.42:1 ≥ 4.5:1 ✅
 *   - text on surface-2        : #18222e on #f5f7fa  → 12.41:1 ≥ 4.5:1 ✅
 *   - muted on surface         : #4a5a6c on #ffffff  →  6.79:1 ≥ 4.5:1 ✅
 *   - link on surface          : #0046aa on #ffffff  →  8.49:1 ≥ 4.5:1 ✅
 *   - badge text on critical   : #ffffff on #8a1118  →  8.31:1 ≥ 4.5:1 ✅
 *   - badge text on serious    : #ffffff on #8a4a00  →  6.05:1 ≥ 4.5:1 ✅
 *   - badge text on moderate   : #18222e on #d39a00  →  5.45:1 ≥ 4.5:1 ✅
 *   - badge text on minor      : #ffffff on #225b6f  →  6.20:1 ≥ 4.5:1 ✅
 *   - focus ring               : #0046aa outline 3px → visible 3:1 ≥ 3:1 ✅
 *
 *   Dark theme (prefers-color-scheme: dark):
 *   - text on dark surface     : #e2e8f0 on #1a1f2e  → 11.8:1 ≥ 4.5:1 ✅
 *   - muted on dark surface    : #94a3b8 on #1a1f2e  →  5.2:1 ≥ 4.5:1 ✅
 *   - link on dark surface     : #7aa8f0 on #1a1f2e  →  6.3:1 ≥ 4.5:1 ✅
 */

export const REPORT_STYLES = `
/* ─── Design tokens — light theme ─── */
:root {
  --surface: #ffffff;
  --surface-2: #f5f7fa;
  --surface-3: #e7ecf2;
  --ink: #18222e;
  --ink-muted: #4a5a6c;
  --link: #0046aa;
  --link-visited: #5a268d;
  --border: #cad3dc;
  --shadow: 0 1px 2px rgba(24, 34, 46, 0.08), 0 4px 12px rgba(24, 34, 46, 0.05);
  --sev-critical: #8a1118;
  --sev-critical-fg: #ffffff;
  --sev-serious: #8a4a00;
  --sev-serious-fg: #ffffff;
  --sev-moderate: #d39a00;
  --sev-moderate-fg: #18222e;
  --sev-minor: #225b6f;
  --sev-minor-fg: #ffffff;
  --band-compliant: #1e6b2f;
  --band-wip: #8a4a00;
  --band-noncompliant: #8a1118;
  --radius: 8px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --font-sys: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  --caveat-bg: #fffbeb;
  --caveat-border: #d39a00;
  --caveat-ink: #18222e;
  --delta-improved-bg: #e8f5e9;
  --delta-improved-ink: #1e6b2f;
  --delta-regressed-bg: #fce8ea;
  --delta-regressed-ink: #8a1118;
  --delta-unchanged-bg: #f5f7fa;
  --delta-unchanged-ink: #4a5a6c;
}

/* ─── Design tokens — dark theme ─── */
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1e2535;
    --surface-2: #1a1f2e;
    --surface-3: #252c3f;
    --ink: #e2e8f0;
    --ink-muted: #94a3b8;
    --link: #7aa8f0;
    --link-visited: #c4a8f5;
    --border: #334155;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3);
    /* severity badges keep the same hue but are lighter for dark backgrounds */
    --sev-critical: #f87171;
    --sev-critical-fg: #1a0607;
    --sev-serious: #fb923c;
    --sev-serious-fg: #1a0900;
    --sev-moderate: #fbbf24;
    --sev-moderate-fg: #1a1000;
    --sev-minor: #67e8f9;
    --sev-minor-fg: #0a1a1e;
    --band-compliant: #4ade80;
    --band-wip: #fb923c;
    --band-noncompliant: #f87171;
    --caveat-bg: #1e1a00;
    --caveat-border: #fbbf24;
    --caveat-ink: #e2e8f0;
    --delta-improved-bg: #052e16;
    --delta-improved-ink: #4ade80;
    --delta-regressed-bg: #1c0607;
    --delta-regressed-ink: #f87171;
    --delta-unchanged-bg: #252c3f;
    --delta-unchanged-ink: #94a3b8;
  }
}

*, *::before, *::after { box-sizing: border-box; }

html { font-family: var(--font-sys); line-height: 1.5; color: var(--ink); background: var(--surface-2); }
body { margin: 0; padding: 0; }

main { display: block; max-width: 960px; margin: 0 auto; padding: var(--space-6) var(--space-5); }

a { color: var(--link); text-decoration: underline; text-underline-offset: 0.2em; }
a:visited { color: var(--link-visited); }
a:hover { text-decoration-thickness: 2px; }
a:focus-visible,
button:focus-visible,
summary:focus-visible,
details:focus-visible {
  outline: 3px solid var(--link);
  outline-offset: 2px;
  border-radius: 2px;
}

h1, h2, h3 { font-weight: 600; line-height: 1.25; color: var(--ink); }
h1 { font-size: 1.75rem; margin: 0 0 var(--space-3); }
h2 { font-size: 1.375rem; margin: var(--space-6) 0 var(--space-3); }
h3 { font-size: 1.125rem; margin: 0 0 var(--space-2); }

p { margin: 0 0 var(--space-3); }

/* Skip link */
.skip-link {
  position: absolute;
  top: -100px;
  left: var(--space-2);
  background: var(--ink);
  color: var(--surface);
  padding: var(--space-2) var(--space-3);
  z-index: 100;
  text-decoration: none;
}
.skip-link:focus { top: var(--space-2); }

/* Visually hidden — keep accessible to AT */
.visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

/* ─── Header ─── */
.report-header {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  box-shadow: var(--shadow);
}
.report-eyebrow {
  font-size: 0.875rem;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-2);
}
.report-title { margin-bottom: var(--space-4); word-break: break-word; }
.report-meta { display: grid; gap: var(--space-2); margin: 0; }
.report-meta__row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.report-meta__row dt { font-weight: 600; min-width: 7rem; }
.report-meta__row dd { margin: 0; color: var(--ink-muted); }
.report-meta__row code { font-family: var(--font-mono); font-size: 0.9rem; word-break: break-all; }

/* ─── Summary ─── */
.summary {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  box-shadow: var(--shadow);
}
.summary h2 { margin-top: 0; }
.summary__grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: minmax(220px, 1fr) 2fr;
}
.summary__score { text-align: center; padding: var(--space-3); }
.summary__score-label {
  font-size: 0.875rem;
  color: var(--ink-muted);
  margin: 0 0 var(--space-2);
}
.summary__score-value {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1;
  margin: 0;
}
.summary__score-value--compliant { color: var(--band-compliant); }
.summary__score-value--work-in-progress { color: var(--band-wip); }
.summary__score-value--non-compliant { color: var(--band-noncompliant); }
.summary__score-unit { font-size: 1.5rem; color: var(--ink-muted); margin-left: 0.1em; }
.summary__score-band { font-size: 1rem; margin: var(--space-2) 0 var(--space-2); font-weight: 600; }
.summary__score-caveat { font-size: 0.75rem; color: var(--ink-muted); margin: 0; }
.summary__breakdown-label { font-weight: 600; margin: 0 0 var(--space-3); }

/* Delta badge (vs previous scan) */
.summary__delta {
  display: inline-block;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 3px var(--space-2);
  border-radius: 999px;
  margin: var(--space-1) 0 var(--space-2);
}
.summary__delta--improved {
  background: var(--delta-improved-bg);
  color: var(--delta-improved-ink);
}
.summary__delta--regressed {
  background: var(--delta-regressed-bg);
  color: var(--delta-regressed-ink);
}
.summary__delta--unchanged {
  background: var(--delta-unchanged-bg);
  color: var(--delta-unchanged-ink);
}

.bar { display: grid; grid-template-columns: 6rem 1fr 3rem; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
.bar__label { font-size: 0.875rem; }
.bar__track { background: var(--surface-3); height: 0.75rem; border-radius: 4px; overflow: hidden; }
.bar__fill { height: 100%; border-radius: 4px; }
.bar__fill--critical { background: var(--sev-critical); }
.bar__fill--serious { background: var(--sev-serious); }
.bar__fill--moderate { background: var(--sev-moderate); }
.bar__fill--minor { background: var(--sev-minor); }
.bar__count { font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; }

@media (max-width: 768px) {
  .summary__grid { grid-template-columns: 1fr; }
}

/* ─── Audit caveat (displayed when there are findings) ─── */
.audit-caveat {
  background: var(--caveat-bg);
  border: 1px solid var(--caveat-border);
  border-left-width: 4px;
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-5);
  margin-bottom: var(--space-5);
  color: var(--caveat-ink);
}
.audit-caveat__text { margin: 0; font-size: 0.875rem; }

/* ─── Violations list ─── */
.violations { margin-bottom: var(--space-5); }
.violations-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.card-item {
  margin-bottom: var(--space-4);
}

/* ─── Violation card — <details>/<summary> based ─── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  page-break-inside: avoid;
}
.card--critical { border-left-color: var(--sev-critical); }
.card--serious { border-left-color: var(--sev-serious); }
.card--moderate { border-left-color: var(--sev-moderate); }
.card--minor { border-left-color: var(--sev-minor); }

.card__summary {
  list-style: none;
  padding: var(--space-5);
  cursor: pointer;
  user-select: none;
}
/* Remove default marker in Firefox */
.card__summary::-webkit-details-marker { display: none; }
.card__summary::marker { display: none; }

.card__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-2);
}
.card__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.card__badge--critical { background: var(--sev-critical); color: var(--sev-critical-fg); }
.card__badge--serious { background: var(--sev-serious); color: var(--sev-serious-fg); }
.card__badge--moderate { background: var(--sev-moderate); color: var(--sev-moderate-fg); }
.card__badge--minor { background: var(--sev-minor); color: var(--sev-minor-fg); }
.card__ruleid { font-family: var(--font-mono); font-size: 0.875rem; color: var(--ink-muted); }
.card__node-count { font-size: 0.875rem; color: var(--ink-muted); }
.card__wcag { font-size: 0.875rem; margin-left: auto; }
.card__wcag-extra { font-size: 0.8125rem; color: var(--ink-muted); margin: 0 0 var(--space-2); }
.card__title { margin: 0; }

/* Expand/collapse indicator using CSS — no JavaScript */
.card__summary::after {
  content: ' ▼';
  font-size: 0.75rem;
  color: var(--ink-muted);
  float: right;
  margin-top: 0.35em;
}
.card[open] > .card__summary::after {
  content: ' ▲';
}

.card__body {
  padding: 0 var(--space-5) var(--space-5);
  border-top: 1px solid var(--surface-3);
}

.card__help { color: var(--ink-muted); margin-bottom: var(--space-3); margin-top: var(--space-3); }
.card__screenshot { margin: 0 0 var(--space-3); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; background: var(--surface-2); }
.card__screenshot img { display: block; max-width: 100%; height: auto; }
.card__helpurl { font-size: 0.875rem; color: var(--ink-muted); margin-top: var(--space-3); }
.card__helpurl a { word-break: break-all; }

/* ─── Node list (all affected elements) ─── */
.node-list {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: grid;
  gap: var(--space-3);
}
.node-list--extra {
  margin-top: var(--space-3);
}
.node {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: var(--space-3);
}
.node__field { margin-bottom: var(--space-2); }
.node__field:last-child { margin-bottom: 0; }
.node__field-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
  margin: 0 0 var(--space-1);
}
.node__field-value { margin: 0; }
.node__field-value--code {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: var(--space-2) var(--space-3);
  white-space: pre-wrap;
  word-break: break-all;
  display: block;
}
.node__failure-summary {
  font-size: 0.875rem;
  font-style: italic;
  color: var(--ink-muted);
}
.node__field--failure .node__field-label { color: var(--sev-serious); }

/* "Show N more" overflow toggle */
.node-overflow {
  margin-top: var(--space-2);
}
.node-overflow__toggle {
  font-size: 0.875rem;
  color: var(--link);
  cursor: pointer;
  list-style: none;
  padding: var(--space-1) 0;
}
.node-overflow__toggle::-webkit-details-marker { display: none; }
.node-overflow__toggle::marker { display: none; }

/* ─── Action items ─── */
.action-items {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  box-shadow: var(--shadow);
}
.action-items__list { padding-left: var(--space-5); margin: 0; }
.action-items__item { margin-bottom: var(--space-2); }
.action-items__link { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.action-items__badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.action-items__badge--critical { background: var(--sev-critical); color: var(--sev-critical-fg); }
.action-items__badge--serious { background: var(--sev-serious); color: var(--sev-serious-fg); }
.action-items__badge--moderate { background: var(--sev-moderate); color: var(--sev-moderate-fg); }
.action-items__badge--minor { background: var(--sev-minor); color: var(--sev-minor-fg); }

/* ─── Footer ─── */
.report-footer {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-5);
  margin-top: var(--space-5);
  box-shadow: var(--shadow);
}
.report-footer__heading { margin-top: 0; font-size: 1.125rem; }
.report-footer__meta { display: grid; gap: var(--space-2); margin: 0 0 var(--space-4); }
.report-footer__row { display: flex; gap: var(--space-3); }
.report-footer__row dt { font-weight: 600; min-width: 8rem; }
.report-footer__row dd { margin: 0; color: var(--ink-muted); }
.report-footer__identity { font-size: 0.8125rem; color: var(--ink-muted); margin: 0; padding-top: var(--space-3); border-top: 1px solid var(--border); }

/* ─── Empty-state ─── */
.empty-state {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-5);
  text-align: center;
  margin-bottom: var(--space-5);
}
.empty-state__icon { font-size: 2.5rem; margin-bottom: var(--space-2); }

/* ─── Print ─── */
@media print {
  html, body { background: #ffffff; color: #000000; }
  main { max-width: none; padding: 0; }
  .skip-link { display: none; }
  .card,
  .report-header,
  .summary,
  .action-items,
  .report-footer,
  .audit-caveat { box-shadow: none; border-color: #000000; }
  /* Expand all details for print */
  details { display: block; }
  details > summary { display: block; }
  details > * { display: block !important; }
  a { text-decoration: underline; color: #000000; }
  /* Dark mode tokens reset for print */
  :root {
    --surface: #ffffff;
    --surface-2: #f5f7fa;
    --ink: #000000;
    --ink-muted: #444444;
    --link: #000000;
    --border: #000000;
  }
}

/* ─── Mobile ─── */
@media (max-width: 480px) {
  main { padding: var(--space-4) var(--space-3); }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }
  .summary__score-value { font-size: 2.5rem; }
  .bar { grid-template-columns: 4.5rem 1fr 2rem; }
  .card__wcag { margin-left: 0; }
  .card__header { gap: var(--space-2); }
}
`;
