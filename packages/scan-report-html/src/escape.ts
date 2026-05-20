// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * HTML entity escaping — the single XSS guard for the renderer.
 *
 * Per PRD §4.2 the renderer treats every string from `ScanReportInput` (rule
 * descriptions, selectors, snippets, URLs in attribute context) as untrusted
 * text and escapes it before injection. We never inject live HTML from the
 * input — even the `html` field on violation nodes is rendered as escaped
 * `<code>` content, not parsed as DOM.
 */

/**
 * Escape a string for safe injection into HTML text content or attribute
 * values. Handles the five canonical XSS sinks (`& < > " '`).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape and truncate a string to a maximum visible length, appending an
 * ellipsis when truncation occurs. Used for HTML snippet and selector cells
 * (PRD §3.4: «Truncate at 200 chars + ellipsis»).
 */
export function escapeAndTruncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return escapeHtml(value);
  }
  return `${escapeHtml(value.slice(0, maxLength))}…`;
}

/**
 * Escape a URL for use in an attribute context. Rejects javascript:, data:,
 * vbscript:, and file: URLs (return the empty string so callers can render
 * an inert placeholder rather than an exploitable link).
 */
export function escapeUrl(value: string): string {
  const trimmed = value.trim();
  // Lower-case prefix check — defends against case-mixed `JaVaScRiPt:` etc.
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:')
  ) {
    return '';
  }
  return escapeHtml(trimmed);
}
