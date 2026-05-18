// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Test-only helpers — re-exported under a stable path for test files.
 *
 * Not part of the public API surface (excluded from package `exports`).
 *
 * @internal
 */

/**
 * Parse a multi-element HTML fragment and return the document root,
 * with the fragment installed as `document.body.innerHTML`.
 *
 * Use when a check needs sibling / ancestor lookups (e.g. label-for, fieldset
 * wrapping). The returned root is `document` (typed as `Document`).
 */
export function setBodyFromFragment(html: string): Document {
  document.body.innerHTML = html.trim();
  return document;
}

/**
 * Reset the document body between tests to prevent fixture leakage.
 * Call in `beforeEach` for any test file using `setBodyFromFragment`.
 */
export function resetBody(): void {
  document.body.innerHTML = '';
}
