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
 * Return true if `doc` looks like an accessibility-statement page.
 * Used by all statement-pack rules to gate themselves.
 */
export function isStatementPage(doc: Document): boolean {
  const url = doc.documentURI ?? '';
  if (STATEMENT_PATH_RE.test(url)) return true;
  const title = doc.title || '';
  const h1 = doc.querySelector('h1')?.textContent ?? '';
  return STATEMENT_TITLE_RE.test(`${title} ${h1}`);
}

/**
 * Return body text content as a single normalised line. Inserts spaces
 * between block-level elements so adjacent text doesn't run together
 * (which would break `\b` word boundaries in pattern matching).
 *
 * Used by text-search rules. Returns empty string if no body.
 */
export function statementText(doc: Document): string {
  if (!doc.body) return '';
  const parts: string[] = [];
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const own = nodeOwnText(el);
    if (own) parts.push(own);
  }
  // Fallback if no children — use bare textContent
  if (parts.length === 0) {
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Return the direct (non-descendant) text content of an element.
 */
function nodeOwnText(el: Element): string {
  let out = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      out += child.textContent ?? '';
    }
  }
  return out.trim();
}
