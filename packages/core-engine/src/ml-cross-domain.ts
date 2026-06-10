// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { ExtractedFeatures, InteractionRecord } from './domain-contract.js';

/**
 * Detects cross-domain interactions over the single-pass feature set. Given the
 * features every domain recorded — correlated by shared element key — it predicts
 * where two domains interact, labelling each interaction a conflict or a synergy.
 *
 * The model is domain-agnostic: it reads typed feature keys, not domain-specific
 * code paths, so a new domain pair becomes detectable by adding a labelled pattern
 * rather than by changing the detector.
 */
export interface MLCrossDomainDetector {
  detect(features: ExtractedFeatures, scanId: string): InteractionRecord[];
}

/**
 * One labelled interaction pattern: when both domains have set their feature key
 * on the same element, the detector emits a record of the given type. This is the
 * seed-pair set the patent describes (and the eval set for the learned layer); the
 * representation is uniform so any future pair is expressible the same way.
 */
interface InteractionPattern {
  readonly domainA: string;
  readonly featureKeyA: string;
  readonly domainB: string;
  readonly featureKeyB: string;
  readonly type: 'conflict' | 'synergy';
  readonly predictedEffect: string;
  /** Model confidence for this learned pattern, in [0, 1]. */
  readonly confidence: number;
}

/**
 * Seed interaction patterns from Patent J's examples and the market pairs. Each is
 * a labelled element-coincidence: both domains flagging the same element implies
 * the named interaction.
 */
const SEED_PATTERNS: readonly InteractionPattern[] = [
  {
    // Patent flagship: a heavy image both lacks alt text (accessibility) and is
    // oversized (sustainability) — compressing it for carbon savings tends to
    // degrade alt fidelity, and the inverse, so they conflict on the same node.
    domainA: 'accessibility',
    featureKeyA: 'a11y:missing-alt',
    domainB: 'sustainability',
    featureKeyB: 'sustainability:large-image',
    type: 'conflict',
    predictedEffect:
      'Compressing this image to cut page weight can reduce visual fidelity that alt text depends on; remediating one constraint affects the other.',
    confidence: 0.82,
  },
  {
    // Render-blocking script that is also an assistive-technology dependency.
    domainA: 'accessibility',
    featureKeyA: 'a11y:missing-alt',
    domainB: 'sustainability',
    featureKeyB: 'sustainability:render-blocking-script',
    type: 'conflict',
    predictedEffect:
      'Deferring or removing this render-blocking script to lighten the page can break assistive-technology behaviour on the same element.',
    confidence: 0.74,
  },
  {
    // Performance optimisation that degrades an accessibility feature: a lazily
    // loaded element below the fold is not discoverable by a screen reader.
    domainA: 'performance',
    featureKeyA: 'perf:lazy-loaded',
    domainB: 'accessibility',
    featureKeyB: 'a11y:offscreen-content',
    type: 'conflict',
    predictedEffect:
      'Lazy-loading this element to improve load time can hide it from assistive technology until it scrolls into view; the speed gain costs discoverability.',
    confidence: 0.7,
  },
  {
    // A content-security-policy directive that blocks an assistive-technology
    // script needed on the same element.
    domainA: 'security',
    featureKeyA: 'security:csp-blocks-script',
    domainB: 'accessibility',
    featureKeyB: 'a11y:script-dependency',
    type: 'conflict',
    predictedEffect:
      'Tightening the content security policy to block this script removes a dependency the assistive-technology behaviour relies on; hardening here weakens accessibility there.',
    confidence: 0.68,
  },
  {
    // A cookie set before consent that is also missing secure cookie flags —
    // fixing the consent gate and the cookie hardening reinforce each other.
    domainA: 'privacy',
    featureKeyA: 'privacy:cookie-before-consent',
    domainB: 'security',
    featureKeyB: 'security:cookie-insecure-flags',
    type: 'synergy',
    predictedEffect:
      'Deferring this cookie until consent and adding the secure flags are a single fix that improves both privacy and security at once.',
    confidence: 0.71,
  },
  {
    // An image missing alt text whose structured-data description is also absent
    // — supplying the description text resolves both at once.
    domainA: 'accessibility',
    featureKeyA: 'a11y:missing-alt',
    domainB: 'structured-data',
    featureKeyB: 'structured-data:missing-image-description',
    type: 'synergy',
    predictedEffect:
      'Writing one description for this image supplies both the alt text and the structured-data image description, fixing both findings together.',
    confidence: 0.77,
  },
];

/**
 * Build the cross-domain interaction detector. Replaces the old empty-stub
 * behaviour: when a seeded pattern's two domains both flag the same element, the
 * detector emits an {@link InteractionRecord} for it. When no pattern matches, it
 * returns an empty array. The input feature set is never mutated.
 */
export function createMLCrossDomainDetector(): MLCrossDomainDetector {
  return {
    detect(features: ExtractedFeatures, scanId: string): InteractionRecord[] {
      const records: InteractionRecord[] = [];

      for (const [elementKey, bucket] of features.byElement) {
        for (const pattern of SEED_PATTERNS) {
          const aMap = bucket.domainFeatures[pattern.domainA];
          const bMap = bucket.domainFeatures[pattern.domainB];
          if (!aMap || !bMap) continue;
          if (!truthy(aMap.get(pattern.featureKeyA))) continue;
          if (!truthy(bMap.get(pattern.featureKeyB))) continue;

          records.push({
            id: `${scanId}:${pattern.domainA}-${pattern.domainB}:${elementKey}`,
            type: pattern.type,
            domains: [pattern.domainA, pattern.domainB],
            elementKey,
            predictedEffect: pattern.predictedEffect,
            confidence: pattern.confidence,
          });
        }
      }

      return records;
    },
  };
}

function truthy(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.length > 0);
}
