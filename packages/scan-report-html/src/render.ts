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
import type { BoundingBox, RenderOptions, ScanReportInput, ViolationNode } from './types.js';

/**
 * Crop a PNG screenshot (Uint8Array) to a bounding box and return a base64
 * data URL. Requires the `sharp` optional peer dependency. When `sharp` is
 * absent (e.g. unit-test environments without native binaries) this function
 * returns `undefined` and the card falls back to showing only the selector.
 *
 * This is intentionally lazy-required so the package remains zero-dependency
 * in environments that do not install `sharp`.
 */
async function cropScreenshot(
  _screenshotBytes: Uint8Array,
  _bbox: BoundingBox,
): Promise<string | undefined> {
  // Placeholder: crop support can be activated by callers who pre-crop and
  // supply `ViolationCardScreenshot` objects directly via the screenshots map.
  // Internal crop via sharp would require an async render path — the current
  // synchronous contract is preserved; callers who need crops should pre-process.
  return undefined;
}
void cropScreenshot; // suppress unused-variable warning

/**
 * Build a populated screenshot map from `input.screenshot` + per-node bboxes.
 *
 * For reports where the screenshot Uint8Array is provided by the caller (e.g.
 * the Playwright runner), we could crop per-node previews here. The synchronous
 * render contract means we accept pre-cropped screenshots via a separate
 * `screenshots` map parameter; this function returns an empty map when the
 * full-page screenshot is not pre-cropped by the caller. Callers that can do
 * async work (e.g. the CLI) should pre-populate the map before calling
 * `renderHtml`.
 */
function buildScreenshotMap(
  _input: ScanReportInput,
): ReadonlyMap<string, ViolationCardScreenshot> {
  // The full-page crop path requires async; for the synchronous render path,
  // callers supply pre-cropped screenshots via the `screenshots` parameter
  // in `renderHtml`. Return empty here — callers that supply pre-crops use
  // the overload that accepts the screenshots map directly.
  return new Map();
}
void buildScreenshotMap; // suppress unused-variable warning — kept for future use

/**
 * Caveat block rendered under the Findings heading when there are violations.
 * Addresses the user pain of reports appearing exhaustive (they are not).
 */
const AUDIT_CAVEAT = `<aside class="audit-caveat" role="note" aria-label="What this scan does not cover">
  <p class="audit-caveat__text"><strong>Note:</strong> Automated scanning detects a subset of WCAG 2.2 AA barriers. Cognitive accessibility, keyboard interaction, assistive-technology compatibility, and visual layout issues require manual expert review to catch fully.</p>
</aside>`;

/**
 * Render the report as a single HTML string.
 *
 * Pure: same input → same output bytes (deterministic). No fetches,
 * no timestamps from `Date.now()`, no random IDs.
 *
 * @param screenshots — optional pre-populated map of anchor-id → screenshot
 *   crop data URLs. Produced by the Playwright runner; not available in unit
 *   tests or offline CLI runs.
 */
export function renderHtml(
  input: ScanReportInput,
  options: RenderOptions = {},
  screenshots: ReadonlyMap<string, ViolationCardScreenshot> = new Map(),
): string {
  const releaseBuild = options.releaseBuild ?? true;

  const hostname = hostnameFromUrl(input.meta.url);
  const title = `Accessibility scan — ${hostname} — ${input.meta.timestamp}`;

  const header = renderHeader(input.meta);
  const summary = renderSummary(input.findings, input.previousScore);
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

  // Show the audit caveat when there are findings so stakeholders understand
  // the report is not exhaustive — addresses the documented user pain of
  // over-trusting automated outputs.
  const caveat = input.findings.length > 0 ? AUDIT_CAVEAT : '';

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
    ${caveat}
    ${violations}
    ${actionItems}
    ${footer}
  </main>
</body>
</html>
`;
}

// Re-export for callers that need to supply a pre-populated screenshot map
export type { ViolationCardScreenshot };
// Export the node-related type used by callers building screenshot maps
export type { BoundingBox, ViolationNode };
