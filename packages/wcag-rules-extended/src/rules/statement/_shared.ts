// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Shared helpers for the accessibility-statement rule pack.
 *
 * Statement-page detection is reused across many rules — centralising it
 * here keeps the per-rule files focused on their specific check logic.
 */

const STATEMENT_PATH_RE = /\/(accessibility|a11y|tillganglighet|tilgjengelighet|saavutettavuus|tillg%C3%A4nglighet|tilgaengelighed)/i;
const STATEMENT_TITLE_RE = /\b(accessibility statement|tillgänglighetsutlåtande|tillgänglighet|saavutettavuusseloste|tilgjengelighetserklæring|tilgængelighedserklæring)\b/i;

/**
 * Return true if `document` looks like an accessibility-statement page.
 * Used by all statement-pack rules to gate themselves.
 */
export function isStatementPage(document: Document): boolean {
  const url = document.documentURI ?? '';
  if (STATEMENT_PATH_RE.test(url)) return true;
  const title = document.title || '';
  const h1 = document.querySelector('h1')?.textContent ?? '';
  return STATEMENT_TITLE_RE.test(`${title} ${h1}`);
}

/**
 * Return body text content as a single normalised line. Inserts spaces
 * between block-level elements so adjacent text doesn't run together
 * (which would break `\b` word boundaries in pattern matching).
 *
 * Used by text-search rules. Returns empty string if no body.
 */
export function statementText(document: Document): string {
  if (!document.body) return '';
  const parts: string[] = [];
  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    const own = nodeOwnText(element);
    if (own) parts.push(own);
  }
  // Fallback if no children — use bare textContent
  if (parts.length === 0) {
    return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Return the direct (non-descendant) text content of an element.
 */
function nodeOwnText(element: Element): string {
  let out = '';
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      out += child.textContent ?? '';
    }
  }
  return out.trim();
}
