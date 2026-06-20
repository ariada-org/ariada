// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Reverter regression baseline for content-policy.
 *
 * The baseline records the forbidden content spans a surface deliberately
 * removed (their literal text + fingerprint). `detectRegression` then re-scans
 * the RAW current content for those exact spans — independent of the live
 * rule-set. This is the distinct reverter value per the regression contract:
 * not "run the policy on HEAD" (which only catches what active rules still
 * flag), but "did a span the baseline removed reappear EVEN IF the current
 * profile no longer has a rule that would catch it?". The baseline remembers
 * what the rule-set forgot.
 */

import type { ContentGateDecision } from './types.js';

/** One forbidden span the surface deliberately removed. */
export interface RemovedSpan {
  fingerprint: string;
  /** The literal matched text — what detectRegression re-scans the content for. */
  matchedText: string;
  ruleId: string;
  category: string;
}

/** A JSON-serialisable record of the spans a surface deliberately removed. */
export interface ReverterBaseline {
  surface: string;
  removedSpans: RemovedSpan[];
}

/** A re-introduced span found by re-scanning the raw content. */
export interface RegressionFinding {
  matchedText: string;
  baselineFingerprint: string;
  ruleId: string;
  category: string;
  /** 1-based line in the current content where the removed span reappeared. */
  line: number;
}

/**
 * Build a baseline from a before-fix and after-fix evaluation pair. The removed
 * spans are the findings present in `previousDecision` but absent (by
 * fingerprint) from `currentDecision` — the spans the surface owner cleaned.
 * Stored with their literal text so the regression check does not depend on any
 * rule still existing.
 */
export function buildBaseline(
  previousDecision: ContentGateDecision,
  currentDecision: ContentGateDecision,
): ReverterBaseline {
  const afterFingerprints = new Set(currentDecision.findings.map((f) => f.fingerprint));
  const removedSpans: RemovedSpan[] = [];
  const seen = new Set<string>();

  for (const f of previousDecision.findings) {
    if (afterFingerprints.has(f.fingerprint) || seen.has(f.fingerprint)) continue;
    seen.add(f.fingerprint);
    removedSpans.push({
      fingerprint: f.fingerprint,
      matchedText: f.matchedText,
      ruleId: f.ruleId,
      category: f.category,
    });
  }

  return { surface: currentDecision.surface, removedSpans };
}

/** Escape a literal string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect regressions by re-scanning the RAW current content for each span the
 * baseline removed — independent of the live rule-set. A removed span that
 * reappears in the content is a regression even if no current rule would flag
 * it (the retired-rule case the static gate alone misses).
 */
export function detectRegression(
  baseline: ReverterBaseline,
  currentContent: string,
): RegressionFinding[] {
  const lines = currentContent.split(/\r?\n/);
  const regressions: RegressionFinding[] = [];

  for (const span of baseline.removedSpans) {
    if (span.matchedText === '') continue;
    const re = new RegExp(escapeRegExp(span.matchedText), 'i');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i] ?? '')) {
        regressions.push({
          matchedText: span.matchedText,
          baselineFingerprint: span.fingerprint,
          ruleId: span.ruleId,
          category: span.category,
          line: i + 1,
        });
        break; // one regression per removed span is enough proof
      }
    }
  }

  return regressions;
}
