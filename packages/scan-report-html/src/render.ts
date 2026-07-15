// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Render orchestrator — pure function. No I/O. Composes the section helpers
 * into a single self-contained HTML5 document.
 *
 * The disk-write overload lives in `index.ts` so this file stays free of
 * `node:fs` dependencies and remains trivially unit-testable.
 */

import { escapeHtml } from './escape.js';
import { renderActionItems } from './sections/action-items.js';
import { renderFooter } from './sections/footer.js';
import { renderHeader, hostnameFromUrl } from './sections/header.js';
import { renderSummary } from './sections/summary.js';
import {
  renderViolationCards,
  type ViolationCardScreenshot,
} from './sections/violation-card.js';
import { REPORT_STYLES } from './styles.js';
import type { RenderOptions, ScanReportInput } from './types.js';

/**
 * Render the report as a single HTML string.
 *
 * Pure: same input → same output bytes (deterministic). No fetches,
 * no timestamps from `Date.now()`, no random IDs.
 */
export function renderHtml(
  input: ScanReportInput,
  options: RenderOptions = {},
): string {
  const releaseBuild = options.releaseBuild ?? true;
  const screenshots: ReadonlyMap<string, ViolationCardScreenshot> = new Map();

  const hostname = hostnameFromUrl(input.meta.url);
  const title = `Accessibility scan — ${hostname} — ${input.meta.timestamp}`;

  const header = renderHeader(input.meta);
  const summary = renderSummary(input.findings);
  const violations = renderViolationCards(input.findings, screenshots);
  const actionItems = renderActionItems(input.findings);
  const footer = renderFooter(input.meta, { releaseBuild });

  const emptyState =
    input.findings.length === 0
      ? `<section class="empty-state" aria-labelledby="empty-heading">
    <p class="empty-state__icon" aria-hidden="true">✓</p>
    <h2 id="empty-heading">No automated violations detected</h2>
    <p>The automated scan did not surface any WCAG 2.2 AA failures on this URL. Manual review is still recommended for AAA criteria, cognitive accessibility, and assistive-technology compatibility.</p>
  </section>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="ariada/scan-report-html v0.1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <main id="main">
    ${header}
    ${summary}
    ${emptyState}
    ${violations}
    ${actionItems}
    ${footer}
  </main>
</body>
</html>
`;
}
