// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Inline stylesheet. Single <style> block; no external stylesheets, no inline
// JS. WCAG 2.2 AA contrast holds on both light and dark variants
// (prefers-color-scheme: dark). Print stylesheet follows the print-discipline:
// page-break-inside avoid on rows, header repeats via display:
// table-header-group, page numbers via @page counters, URL append via
// a[href]::after.

import { sanitiseColor } from '../sanitise-svg.js';
import type { ResolvedRenderOptions } from '../types.js';

const FALLBACK_PRIMARY = '#0b3d91';

/**
 *
 */
export function renderStyles(options: ResolvedRenderOptions): string {
  const primary = sanitiseColor(options.brand.primaryColor) ?? FALLBACK_PRIMARY;
  return `<style>
:root {
  --color-fg: #111111;
  --color-bg: #ffffff;
  --color-muted: #4a4a4a;
  --color-border: #cdd2d8;
  --color-primary: ${primary};
  --color-primary-text: #ffffff;
  --color-supports-bg: #d8efd6;
  --color-supports-fg: #0b4a05;
  --color-partial-bg: #fbe9b3;
  --color-partial-fg: #5a4204;
  --color-fail-bg: #f5c2c2;
  --color-fail-fg: #5a0808;
  --color-na-bg: #e2e6eb;
  --color-na-fg: #2c2f33;
  --color-ne-bg: #d5deea;
  --color-ne-fg: #1c2a3f;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --radius: 6px;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-fg: #f1f3f5;
    --color-bg: #14171a;
    --color-muted: #c0c5cb;
    --color-border: #2c3138;
    --color-primary-text: #ffffff;
    --color-supports-bg: #1f3f1c;
    --color-supports-fg: #c7f0c2;
    --color-partial-bg: #4a3a09;
    --color-partial-fg: #fde6a8;
    --color-fail-bg: #4a1818;
    --color-fail-fg: #f5c8c8;
    --color-na-bg: #2a2e34;
    --color-na-fg: #d8dde3;
    --color-ne-bg: #1d2a3a;
    --color-ne-fg: #c8d8ec;
  }
}

* { box-sizing: border-box; }
html { font-size: 100%; }
body {
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.55;
  color: var(--color-fg);
  background: var(--color-bg);
  margin: 0;
  padding: 0;
}

main {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

header[role="banner"] {
  background: var(--color-primary);
  color: var(--color-primary-text);
  padding: var(--space-2) var(--space-4);
}
header[role="banner"] #toc { color: var(--color-primary-text); }
header[role="banner"] #toc a { color: var(--color-primary-text); }
header[role="banner"] #toc a:focus { outline: 3px solid #ffd166; outline-offset: 2px; }
header[role="banner"] h2 { margin: 0 0 var(--space-1) 0; font-size: 0.9rem; opacity: 0.95; font-weight: 600; }
header[role="banner"] .toc-list { margin: 0; padding: 0 0 0 var(--space-4); display: flex; flex-wrap: wrap; gap: var(--space-3); list-style: decimal-leading-zero inside; }

.skip-link {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.skip-link:focus {
  position: fixed;
  left: 1rem;
  top: 1rem;
  width: auto;
  height: auto;
  z-index: 9999;
  background: var(--color-fg);
  color: var(--color-bg);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  outline: 3px solid #ffd166;
}

h1 {
  font-size: 2rem;
  line-height: 1.25;
  margin: 0 0 var(--space-4) 0;
  color: var(--color-primary);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) h1 { color: #9dbbf2; }
}
h2 { font-size: 1.5rem; line-height: 1.3; margin: var(--space-8) 0 var(--space-3) 0; border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2); }
h3 { font-size: 1.2rem; line-height: 1.3; margin: var(--space-6) 0 var(--space-2) 0; }

p { margin: 0 0 var(--space-3) 0; }
a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
a:focus { outline: 3px solid #ffd166; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) a { color: #9dbbf2; }
}

.brand-logo { max-width: 240px; max-height: 96px; margin: 0 0 var(--space-3) 0; }
.brand-logo svg { width: 100%; height: auto; }
.vendor-banner { font-size: 1.25rem; margin-bottom: var(--space-3); }

.meta-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-4) 0;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.meta-grid dt { font-weight: 600; }
.meta-grid dd { margin: 0; }
.meta-version { color: var(--color-muted); font-family: var(--font-mono); }
.contact-missing { color: var(--color-fail-fg); }

.freshness-banner {
  background: var(--color-partial-bg);
  color: var(--color-partial-fg);
  padding: var(--space-3);
  border: 1px solid var(--color-partial-fg);
  border-radius: var(--radius);
  margin: var(--space-3) 0;
}
.warning-banner {
  background: var(--color-fail-bg);
  color: var(--color-fail-fg);
  padding: var(--space-3);
  border: 1px solid var(--color-fail-fg);
  border-radius: var(--radius);
}

.summary-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-2); margin: var(--space-3) 0 0; }
.summary-cell { padding: var(--space-3); border-radius: var(--radius); border: 1px solid var(--color-border); display: grid; grid-template-rows: auto auto auto auto; gap: var(--space-1); text-align: center; }
.summary-symbol { font-size: 1.5rem; font-weight: 700; }
.summary-count { font-size: 1.5rem; font-weight: 700; }
.summary-key { font-size: 0.85rem; }
.summary-pct { font-size: 0.75rem; color: var(--color-muted); }

.summary-counts { display: grid; grid-template-columns: max-content auto; gap: var(--space-2) var(--space-4); margin: var(--space-3) 0; }
.summary-counts dt { font-weight: 600; }
.summary-counts dd { margin: 0; }

.standards-list { padding-left: 1.2rem; }
.standards-list li { margin-bottom: var(--space-2); }

.vpat-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-3);
  font-size: 0.95rem;
}
.vpat-table caption { caption-side: top; text-align: left; font-weight: 600; padding-bottom: var(--space-2); }
.vpat-table th, .vpat-table td {
  text-align: left;
  vertical-align: top;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
}
.vpat-table thead { display: table-header-group; }
.vpat-table thead th { background: var(--color-primary); color: var(--color-primary-text); font-weight: 600; }
.vpat-table tbody tr:nth-child(even) { background: rgba(0, 0, 0, 0.025); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .vpat-table tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.04); }
}

.vpat-table code { font-family: var(--font-mono); font-size: 0.9em; }

.level { display: inline-block; padding: 0 var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 0.85rem; font-weight: 600; }

.status-badge { display: inline-flex; gap: var(--space-1); align-items: baseline; padding: var(--space-1) var(--space-2); border-radius: var(--radius); font-size: 0.9rem; font-weight: 600; }
.status-symbol { font-weight: 700; }

tr.status-supports td { background-color: var(--color-supports-bg); color: var(--color-supports-fg); }
tr.status-partial td { background-color: var(--color-partial-bg); color: var(--color-partial-fg); }
tr.status-fail td { background-color: var(--color-fail-bg); color: var(--color-fail-fg); }
tr.status-na td { background-color: var(--color-na-bg); color: var(--color-na-fg); }
tr.status-ne td { background-color: var(--color-ne-bg); color: var(--color-ne-fg); }

dd.status-supports { background: var(--color-supports-bg); color: var(--color-supports-fg); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }
dd.status-partial { background: var(--color-partial-bg); color: var(--color-partial-fg); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }
dd.status-fail { background: var(--color-fail-bg); color: var(--color-fail-fg); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }
dd.status-na { background: var(--color-na-bg); color: var(--color-na-fg); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }
dd.status-ne { background: var(--color-ne-bg); color: var(--color-ne-fg); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }

.aaa-toggle { margin-top: var(--space-3); }
.aaa-toggle summary { cursor: pointer; font-weight: 600; padding: var(--space-2); background: var(--color-na-bg); color: var(--color-na-fg); border-radius: var(--radius); }
.aaa-toggle summary:focus { outline: 3px solid #ffd166; outline-offset: 2px; }

.evidence { display: block; margin-top: var(--space-1); color: var(--color-muted); font-family: var(--font-mono); font-size: 0.8rem; }
.remarks { white-space: pre-wrap; }

footer[role="contentinfo"] {
  margin-top: var(--space-8);
  padding: var(--space-4);
  background: var(--color-na-bg);
  color: var(--color-na-fg);
  font-size: 0.9rem;
  text-align: center;
}
footer p { margin: var(--space-1) 0; }

/* Print stylesheet */
@media print {
  :root { color-scheme: light; }
  body { background: white; color: black; }
  header[role="banner"] { position: static; background: white; color: black; border-bottom: 2px solid black; }
  header[role="banner"] #toc a { color: black; }
  .skip-link { display: none; }
  main { max-width: none; padding: 0; }
  h1, h2, h3 { page-break-after: avoid; }
  .vpat-table { font-size: 9pt; }
  .vpat-table thead { display: table-header-group; }
  .vpat-table tfoot { display: table-row-group; }
  .vpat-table tr { page-break-inside: avoid; }
  a[href]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #444; word-break: break-all; }
  a[href^="#"]::after { content: ""; }
  .aaa-toggle[open] summary { display: none; }
  .aaa-toggle { margin-top: 0; }
  .aaa-toggle table { margin-top: var(--space-3); }
  tr.status-supports td,
  tr.status-partial td,
  tr.status-fail td,
  tr.status-na td,
  tr.status-ne td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { margin: 18mm 14mm; @bottom-right { content: counter(page) " / " counter(pages); } }
}

/* Forced colours (Windows High Contrast) */
@media (forced-colors: active) {
  .status-badge, .level { border: 1px solid CanvasText; }
  a:focus, summary:focus { outline: 3px solid Highlight; }
}
</style>`;
}
