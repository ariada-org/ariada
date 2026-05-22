// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Table of contents.

import { escapeHtml } from '../escape.js';
import type { ResolvedRenderOptions } from '../types.js';

/**
 *
 */
export function renderToc(options: ResolvedRenderOptions): string {
  const i18n = options.i18n;
  const items: ReadonlyArray<{ readonly href: string; readonly label: string }> = [
    { href: '#cover', label: i18n.headings.cover },
    { href: '#standards', label: i18n.headings.standards },
    { href: '#summary', label: i18n.headings.summary },
    { href: '#wcag-table', label: i18n.headings.wcagTable },
    { href: '#fpc', label: i18n.headings.fpc },
    { href: '#chapters-4-to-7', label: i18n.headings.hardware },
    { href: '#documentation', label: i18n.headings.documentation },
  ];
  const list = items
    .map((i) => `<li><a href="${escapeHtml(i.href)}">${escapeHtml(i.label)}</a></li>`)
    .join('\n');
  return `<nav id="toc" role="navigation" aria-label="${escapeHtml(i18n.headings.toc)}">
<h2 id="toc-heading">${escapeHtml(i18n.headings.toc)}</h2>
<ol class="toc-list">
${list}
</ol>
</nav>`;
}
