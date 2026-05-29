// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Maintainer: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Public shared types for the framework adapters.
 *
 * Re-exports a minimal vocabulary so the adapter layer never imports the
 * scanner engine directly — that boundary belongs to `internal/run-scan.ts`.
 */

/**
 * Severity ladder used by axe-core and the ariada rule packs.
 */
export type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

/**
 * Locale codes accepted by the rule-pack messages bundle.
 */
export type Locale = 'en' | 'sv' | 'de' | 'fr' | 'nl' | 'fi' | 'da' | 'no';

/**
 * Rule pack identifier matching the three packs exported by
 * `@ariada-org/wcag-rules-extended` (`banking`, `checkout`, `statement`).
 */
export type RulePackName = 'banking' | 'checkout' | 'statement';

/**
 * WCAG 2.2 Success Criterion identifier (e.g. `'1.4.3'`).
 */
export type WcagSuccessCriterion = string;

/**
 * One violation surfaced by the scanner. Normalised across analyzers so
 * adapter formatters can produce identical lines regardless of source.
 */
export interface Violation {
  readonly ruleId: string;
  readonly impact: Impact;
  readonly selector: string;
  readonly message: string;
  readonly wcag: readonly WcagSuccessCriterion[];
  readonly help?: string;
  readonly helpUrl?: string;
}

/**
 * Where the scan target came from. Used by formatters and snapshots.
 */
export type ScanTargetKind = 'page' | 'url' | 'html';

/**
 * Reusable scan result. The result is JSON-serialisable except for
 * `target.identifier` which is a short opaque string (URL or fixture id).
 */
export interface ScanResult {
  readonly violations: readonly Violation[];
  readonly passes: number;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly target: { readonly kind: ScanTargetKind; readonly identifier: string };
}

/**
 * Options accepted by every adapter. All fields optional; defaults documented
 * in `validate-options.ts`.
 */
export interface ScanOptions {
  readonly severity?: Impact;
  readonly packs?: readonly RulePackName[];
  readonly timeoutMs?: number;
  readonly locale?: Locale;
  readonly exclude?: readonly string[];
}

/**
 * Discriminated union of accepted target shapes. Adapters normalise their
 * framework-native subject into this union before forwarding to the scanner.
 */
export type ScanTarget =
  | { readonly kind: 'page'; readonly page: PageLike }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'html'; readonly html: string };

/**
 * Minimal structural shape a Playwright `Page` satisfies. Kept structural so
 * the adapter layer never imports `@playwright/test` types directly — that
 * import lives only in `src/playwright/`.
 */
export interface PageLike {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  url(): string;
}

/**
 * Default severity threshold. `'serious'` aligns with the axe-core
 * «must-fix-before-ship» convention.
 */
export const DEFAULT_SEVERITY: Impact = 'serious';

/**
 * Default per-scan timeout (matches `@ariada-org/core-playwright` default).
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Severity ladder used for threshold comparisons. Higher index = more severe.
 */
export const SEVERITY_ORDER: readonly Impact[] = ['minor', 'moderate', 'serious', 'critical'];

/**
 * All rule packs known to `@ariada-org/wcag-rules-extended` (v0.1).
 */
export const ALL_RULE_PACKS: readonly RulePackName[] = ['banking', 'checkout', 'statement'];

/**
 * Locales supported by the rule-pack messages bundle.
 */
export const SUPPORTED_LOCALES: readonly Locale[] = [
  'en',
  'sv',
  'de',
  'fr',
  'nl',
  'fi',
  'da',
  'no',
];
