// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Discriminator that turns any accepted target shape into the canonical
 * `ScanTarget` discriminated union. Pure function — no I/O.
 */

import { AriadaTestAdapterError } from './error.js';
import type { PageLike, ScanTarget } from './types.js';

/**
 * Raw shape callers can pass — superset of `ScanTarget` for ergonomic input.
 */
export type RawScanTarget =
  | PageLike
  | string
  | { html: string }
  | { url: string };

/**
 * Quick structural guard for `PageLike`. We deliberately avoid an
 * `instanceof` check against `playwright.Page` so the adapter layer never
 * imports the Playwright runtime.
 */
function isPageLike(value: unknown): value is PageLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PageLike>;
  return typeof candidate.goto === 'function' && typeof candidate.url === 'function';
}

/**
 * Heuristic URL detector. Accepts the schemes the scanner already supports
 * (`http`, `https`, `file`). Anything else is treated as HTML literal.
 */
function looksLikeUrl(value: string): boolean {
  return /^(https?|file):\/\//i.test(value);
}

/**
 * Normalise any accepted target into the canonical discriminated union.
 *
 * @throws {AriadaTestAdapterError} `ERR_A11Y_TARGET_INVALID` on inputs the
 *   adapter cannot interpret (null, number, empty string, malformed object).
 */
export function normaliseTarget(input: unknown): ScanTarget {
  if (input == null) {
    throw new AriadaTestAdapterError(
      'ERR_A11Y_TARGET_INVALID',
      'target must be a Page, URL string, HTML string, { html } or { url }; received null/undefined',
    );
  }

  if (typeof input === 'string') {
    if (input.length === 0) {
      throw new AriadaTestAdapterError(
        'ERR_A11Y_TARGET_INVALID',
        'target string must be non-empty',
      );
    }
    if (looksLikeUrl(input)) {
      return { kind: 'url', url: input };
    }
    return { kind: 'html', html: input };
  }

  if (isPageLike(input)) {
    return { kind: 'page', page: input };
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (typeof obj['url'] === 'string' && obj['url'].length > 0) {
      return { kind: 'url', url: obj['url'] };
    }
    if (typeof obj['html'] === 'string' && obj['html'].length > 0) {
      return { kind: 'html', html: obj['html'] };
    }
  }

  throw new AriadaTestAdapterError(
    'ERR_A11Y_TARGET_INVALID',
    `target must be a Page, URL string, HTML string, { html } or { url }; received ${typeof input}`,
  );
}
