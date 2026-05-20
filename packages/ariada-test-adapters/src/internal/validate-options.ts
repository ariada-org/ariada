// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Pure option-validation. Never invokes the scanner; never touches I/O.
 *
 * Returns a frozen, fully-defaulted `NormalisedScanOptions` so downstream code
 * can rely on every field being defined.
 */

import { AriadaTestAdapterError } from './error.js';
import {
  ALL_RULE_PACKS,
  DEFAULT_SEVERITY,
  DEFAULT_TIMEOUT_MS,
  SEVERITY_ORDER,
  SUPPORTED_LOCALES,
  type Impact,
  type Locale,
  type RulePackName,
  type ScanOptions,
} from './types.js';

/**
 * Validated, fully-defaulted options. Every field is `readonly` so consumers
 * cannot accidentally mutate a shared instance.
 */
export interface NormalisedScanOptions {
  readonly severity: Impact;
  readonly packs: readonly RulePackName[];
  readonly timeoutMs: number;
  readonly locale: Locale;
  readonly exclude: readonly string[];
}

/**
 * Validate user-supplied options and merge with defaults. Throws an
 * `AriadaTestAdapterError` (or `RangeError` for timeout) on any invalid input.
 *
 * @param input - caller-supplied options (may be undefined for all-defaults)
 * @returns frozen `NormalisedScanOptions` safe to share across calls.
 */
export function validateOptions(input?: ScanOptions): NormalisedScanOptions {
  const opts = input ?? {};

  const severity = opts.severity ?? DEFAULT_SEVERITY;
  if (!SEVERITY_ORDER.includes(severity)) {
    throw new AriadaTestAdapterError(
      'ERR_A11Y_SEVERITY_INVALID',
      `options.severity must be one of ${SEVERITY_ORDER.join(', ')}; received ${String(severity)}`,
    );
  }

  const packs = opts.packs ?? ALL_RULE_PACKS;
  if (!Array.isArray(packs) || packs.length === 0) {
    throw new AriadaTestAdapterError(
      'ERR_A11Y_PACK_INVALID',
      `options.packs must be a non-empty array; received ${JSON.stringify(packs)}`,
    );
  }
  const seenPacks = new Set<RulePackName>();
  for (const p of packs) {
    if (!ALL_RULE_PACKS.includes(p)) {
      throw new AriadaTestAdapterError(
        'ERR_A11Y_PACK_INVALID',
        `options.packs contains unknown pack ${String(p)}; must be one of ${ALL_RULE_PACKS.join(', ')}`,
      );
    }
    seenPacks.add(p);
  }
  const dedupedPacks: readonly RulePackName[] = Object.freeze([...seenPacks]);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    const err = new RangeError(
      `options.timeoutMs must be in (0, 120000]; received ${String(timeoutMs)}`,
    );
    // Attach a stable string code for caller dispatch.
    (err as RangeError & { code?: string }).code = 'ERR_A11Y_TIMEOUT_RANGE';
    throw err;
  }

  const locale = opts.locale ?? 'en';
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new AriadaTestAdapterError(
      'ERR_A11Y_LOCALE_UNSUPPORTED',
      `options.locale must be one of ${SUPPORTED_LOCALES.join(', ')}; received ${String(locale)}`,
    );
  }

  const exclude = opts.exclude ?? [];
  if (!Array.isArray(exclude)) {
    throw new AriadaTestAdapterError(
      'ERR_A11Y_EXCLUDE_INVALID',
      `options.exclude must be a string array; received ${typeof exclude}`,
    );
  }
  for (const sel of exclude) {
    if (typeof sel !== 'string' || sel.length === 0) {
      throw new AriadaTestAdapterError(
        'ERR_A11Y_EXCLUDE_INVALID',
        `options.exclude entries must be non-empty strings; received ${JSON.stringify(sel)}`,
      );
    }
  }

  return Object.freeze({
    severity,
    packs: dedupedPacks,
    timeoutMs,
    locale,
    exclude: Object.freeze([...exclude]),
  });
}
