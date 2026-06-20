// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Site header section — URL, scan timestamp, scanner version, user-agent.
 *
 * Renders as a `<header>` landmark per WCAG 2.4.1 (Bypass Blocks). One `<h1>`
 * per report, here.
 */

import { escapeHtml } from '../escape.js';
import type { ScanMeta } from '../types.js';

/**
 * Extract a friendly hostname from a URL for the title — falls back to the
 * raw URL string if parsing fails.
 */
export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Render the `<header>` landmark for the report.
 */
export function renderHeader(meta: ScanMeta): string {
  const hostname = hostnameFromUrl(meta.url);
  return `<header class="report-header">
  <p class="report-eyebrow">Accessibility scan report</p>
  <h1 class="report-title">${escapeHtml(hostname)}</h1>
  <dl class="report-meta">
    <div class="report-meta__row">
      <dt>URL</dt>
      <dd><code>${escapeHtml(meta.url)}</code></dd>
    </div>
    <div class="report-meta__row">
      <dt>Scanned</dt>
      <dd><time datetime="${escapeHtml(meta.timestamp)}">${escapeHtml(meta.timestamp)}</time></dd>
    </div>
    <div class="report-meta__row">
      <dt>Scanner</dt>
      <dd>ariada v${escapeHtml(meta.scannerVersion)}</dd>
    </div>
  </dl>
</header>`;
}
