// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Canonical HTML-escape helper. All user-controlled strings (meta.*,
// criterion.remarks, brand.vendorName, etc.) pass through this before
// embedding in template-literal HTML.
//
// We escape the five characters that have HTML special meaning. Single
// quotes are escaped as `&#39;` rather than `&apos;` for HTML 4 + email-
// client compatibility (Outlook preview pane historically rendered the
// named entity literally).

const ESCAPE_MAP: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

const ESCAPE_RE = /[&<>"']/g;

/**
 * Escape a string for safe embedding into HTML text content or attribute
 * values. Returns an empty string for `undefined` / `null` inputs to
 * simplify template-literal call sites.
 */
export function escapeHtml(input: string | undefined | null): string {
  if (input === undefined || input === null) {
    return '';
  }
  return String(input).replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] ?? ch);
}

/**
 * Escape an attribute value. Currently identical to `escapeHtml` since the
 * five-character escape set is sufficient for both contexts; kept as a
 * distinct named export so future tightening (e.g. URL-context handling)
 * can be applied at call sites without churn.
 */
export function escapeAttr(input: string | undefined | null): string {
  return escapeHtml(input);
}
