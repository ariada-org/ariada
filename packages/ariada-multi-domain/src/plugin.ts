// SPDX-License-Identifier: EUPL-1.2
/**
 * `JurisdictionPlugin` — the extension contract that allows community
 * implementers to register a new accessibility jurisdiction against an
 * orchestrator instance without modifying this package's source.
 *
 * The contract is intentionally small. A plugin describes:
 *
 *   - which jurisdiction it represents (code, label, statute, standard,
 *     supervisory authority);
 *   - how a URL or document fingerprint maps onto the jurisdiction
 *     (TLD hints, meta-tag hints, `<html lang="...">` hints);
 *   - which rule pack to load and which version is required;
 *   - how to turn a partial scan context into a `JurisdictionSubset`
 *     record.
 *
 * Plugins are pure data + pure functions. The reference orchestrator
 * does NOT execute plugin code in a sandbox — callers wishing to load
 * untrusted plugins are responsible for their own isolation mechanism
 * (Node `vm` module, worker thread, container, etc.).
 */

import type { JurisdictionSubset, PartialScanContext, Severity } from './types.js';

/**
 * The 11-field extension contract.
 *
 * Field count matches the engineering-specification table (5 identity
 * fields, 3 auto-detection hint arrays, 2 rule-pack fields, 1
 * emission function). Plugins that supply optional auxiliary
 * emission functions (VPAT section, accessibility statement) extend
 * this base shape via TypeScript declaration merging or composition;
 * the base contract stays minimal.
 */
export interface JurisdictionPlugin {
  /** ISO-like jurisdiction code (e.g. "SE", "DE-BFSG", "FR-RGAA"). */
  jurisdictionCode: string;
  /** Human-readable jurisdiction label. */
  jurisdictionLabel: string;
  /** Governing statute citation (e.g. "Lag (2023:254)"). */
  governingRegulation: string;
  /** Technical standard citation (e.g. "EN 301 549 v3.2.1 clause 9"). */
  technicalStandard: string;
  /** Supervisory authority (e.g. "DIGG", "BFSG market-surveillance"). */
  supervisoryAuthority: string;

  /** URL TLD hints that imply this jurisdiction (e.g. ["se"], ["de"]). */
  tldHints: string[];
  /**
   * `<meta name="...">` content hints that imply this jurisdiction
   * (e.g. `["legal:de-bfsg"]`).
   */
  metaHints: string[];
  /** `<html lang="...">` hints (e.g. ["sv-SE", "sv"]). */
  langAttrHints: string[];

  /** Rule pack identifier this jurisdiction depends on. */
  rulePackId: string;
  /**
   * Semver range required by this jurisdiction plugin. Orchestrators
   * use a string-equality check by default; consumers wishing for full
   * semver-range matching wrap the registration call themselves.
   */
  rulePackVersion: string;

  /**
   * Translate the current partial scan context into a
   * `JurisdictionSubset` record. The reference orchestrator calls this
   * exactly once per scan, after all findings have been collected.
   */
  emitJurisdictionSubset(context: PartialScanContext): JurisdictionSubset;
}

/**
 * Hint match result returned by `matchJurisdictionFromHints`.
 *
 * `confidence` is intentionally categorical (not a numeric score) so
 * downstream callers can reason about it without needing a calibration
 * step.
 */
export interface JurisdictionMatch {
  plugin: JurisdictionPlugin;
  confidence: 'high' | 'medium' | 'low';
  matchedOn: 'tld' | 'meta' | 'lang' | 'multiple';
}

/**
 * Pure helper: given a hostname (TLD-bearing), a `<meta>` content
 * value, and an `<html lang="...">` value, return the best plugin
 * match — or `undefined` if no plugin hints match.
 *
 * Stable across calls: the same inputs always return the same result;
 * the function never reads filesystem or network state.
 */
export function matchJurisdictionFromHints(
  plugins: readonly JurisdictionPlugin[],
  inputs: {
    hostname?: string;
    metaContent?: string;
    htmlLang?: string;
  },
): JurisdictionMatch | undefined {
  const tldHits: JurisdictionPlugin[] = [];
  const metaHits: JurisdictionPlugin[] = [];
  const langHits: JurisdictionPlugin[] = [];

  const hostname = (inputs.hostname ?? '').toLowerCase();
  const metaContent = (inputs.metaContent ?? '').toLowerCase();
  const htmlLang = (inputs.htmlLang ?? '').toLowerCase();

  for (const plugin of plugins) {
    if (
      hostname.length > 0 &&
      plugin.tldHints.some((tld) => hostname.endsWith('.' + tld.toLowerCase()))
    ) {
      tldHits.push(plugin);
    }
    if (
      metaContent.length > 0 &&
      plugin.metaHints.some((m) => metaContent === m.toLowerCase())
    ) {
      metaHits.push(plugin);
    }
    if (
      htmlLang.length > 0 &&
      plugin.langAttrHints.some((l) => htmlLang === l.toLowerCase())
    ) {
      langHits.push(plugin);
    }
  }

  // Highest-confidence: TLD + at least one secondary corroborator.
  for (const tldPlugin of tldHits) {
    if (metaHits.includes(tldPlugin) || langHits.includes(tldPlugin)) {
      return { plugin: tldPlugin, confidence: 'high', matchedOn: 'multiple' };
    }
  }

  if (tldHits.length === 1) {
    return { plugin: tldHits[0] as JurisdictionPlugin, confidence: 'high', matchedOn: 'tld' };
  }
  if (metaHits.length === 1) {
    return { plugin: metaHits[0] as JurisdictionPlugin, confidence: 'medium', matchedOn: 'meta' };
  }
  if (langHits.length === 1) {
    return { plugin: langHits[0] as JurisdictionPlugin, confidence: 'low', matchedOn: 'lang' };
  }

  // Multiple TLD matches and no corroborator → low confidence on the
  // first match, the caller decides.
  if (tldHits.length > 1) {
    return { plugin: tldHits[0] as JurisdictionPlugin, confidence: 'low', matchedOn: 'tld' };
  }

  return undefined;
}

/**
 * Helper for plugin authors: given a list of findings and a severity
 * threshold, compute the success-criterion pass rate.
 *
 * The reference implementation treats any finding at or above the
 * threshold as a non-pass.
 */
export function computePassRate(
  findings: { severity: Severity }[],
  totalCriteria: number,
  threshold: Severity = 'moderate',
): number {
  if (totalCriteria <= 0) return 1;
  const order: Severity[] = ['minor', 'moderate', 'serious', 'critical'];
  const thresholdIndex = order.indexOf(threshold);
  const nonPass = findings.filter((f) => order.indexOf(f.severity) >= thresholdIndex).length;
  const passed = Math.max(0, totalCriteria - nonPass);
  return passed / totalCriteria;
}
