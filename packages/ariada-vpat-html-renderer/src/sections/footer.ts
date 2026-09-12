// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Footer chapter.

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions } from '../types.js';

const PROJECT_SITE = 'https://ariada.org';
const PROJECT_SOURCE = 'https://github.com/ariada-org/ariada';

/**
 * The three lines a reader of this document needs at the bottom: what produced
 * it, that it is a self-declaration rather than an independent audit, and where
 * to find the tool.
 *
 * It used to carry the maintainer's legal name and company registration number.
 * Those are our details in someone else's published document — the reader has
 * no use for them, and the publisher has no reason to carry them. What was
 * missing instead was somewhere to go: the project's site and its source.
 */
export function renderFooter(version: string, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  // The date is what dates a conformance claim; the time of day and the
  // milliseconds are noise in a document meant to be read and filed.
  const date = options.generationTimestamp.slice(0, 10);
  return `<footer role="contentinfo">
<p class="generator">${escapeHtml(i18n.generatedBy)} v${escapeHtml(version)} · <time datetime="${escapeHtml(options.generationTimestamp)}">${escapeHtml(date)}</time></p>
<p class="licence">${escapeHtml(i18n.licenceNotice)}</p>
<p class="project"><a href="${PROJECT_SITE}" rel="noopener noreferrer">ariada.org</a> · <a href="${PROJECT_SOURCE}" rel="noopener noreferrer">source</a> · EUPL-1.2</p>
${options.sourceJsonUrl ? `<p class="source-json">Source JSON: <a href="${escapeHtml(options.sourceJsonUrl)}" rel="noopener noreferrer">${escapeHtml(options.sourceJsonUrl)}</a></p>` : ''}
</footer>`;
}
