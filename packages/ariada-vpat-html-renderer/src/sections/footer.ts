// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Footer chapter (PRD §3.2.12).

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions } from '../types.js';

/**
 *
 */
export function renderFooter(version: string, options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  return `<footer role="contentinfo">
<p class="generator">${escapeHtml(i18n.generatedBy)} v${escapeHtml(version)} · <time datetime="${escapeHtml(options.generationTimestamp)}">${escapeHtml(options.generationTimestamp)}</time></p>
<p class="maintainer">${escapeHtml(i18n.maintainedBy)}</p>
<p class="licence">${escapeHtml(i18n.licenceNotice)}</p>
${options.sourceJsonUrl ? `<p class="source-json">Source JSON: <a href="${escapeHtml(options.sourceJsonUrl)}" rel="noopener noreferrer">${escapeHtml(options.sourceJsonUrl)}</a></p>` : ''}
</footer>`;
}
