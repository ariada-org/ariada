// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import weightsData from './cross-domain-weights.json' with { type: 'json' };
import type {
  CorrelatedFeature,
  ExtractedFeatures,
  InteractionRecord,
  JoinScope,
} from './domain-contract.js';

/**
 * Detects cross-domain interactions over the single-pass feature set. It reads
 * the generic correlation index — features grouped by the scope and value they
 * were recorded on — finds where two domains meet on the same join value, and
 * scores each candidate pair with one fitted boundary over engineered features.
 * There are no per-pair code paths: domain identities live only in the trained
 * data file (as labels), never in the correlation or scoring logic.
 *
 * The classifier is a single shared logistic boundary; per-pair specialisation
 * awaits real labelled scan data, so the per-pair data is only the label set
 * (kind, scope, effect) — whether a coincidence fires is decided by the shared
 * boundary over features that genuinely vary with the data.
 */
export interface CrossDomainDetector {
  detect(features: ExtractedFeatures, scanId: string): InteractionRecord[];
}

/** The per-pair labels: which interaction a coinciding pair represents. */
interface PairLabel {
  kind: 'conflict' | 'synergy';
  scope: string;
  effect: string;
}

/**
 * The fitted shared boundary over the two engineered features. A single boundary
 * is used for every pair: per-pair specialisation needs real labelled scan data,
 * which is not available yet, so only the labels (kind/scope/effect) are per-pair.
 */
interface WeightsFile {
  decisionThreshold: number;
  sharedBoundary: { weights: [number, number]; bias: number };
  pairs: Record<string, PairLabel>;
}

const MODEL = weightsData as unknown as WeightsFile;

/**
 * Build the cross-domain interaction detector. The detector groups features by
 * their join scope and value, takes every unordered pair of distinct domains that
 * meet on the same value, and asks the fitted classifier whether they interact.
 * A pair with no trained model is ignored. The input feature set is not mutated;
 * a feature set with no qualifying co-occurrence yields an empty result.
 */
export function createCrossDomainDetector(): CrossDomainDetector {
  return {
    detect(features: ExtractedFeatures, scanId: string): InteractionRecord[] {
      const records: InteractionRecord[] = [];
      const byScope = correlationIndex(features);

      for (const [scope, byValue] of byScope) {
        for (const [joinValue, list] of byValue) {
          for (const candidate of candidatePairs(list)) {
            const record = score(scope, joinValue, candidate, scanId);
            if (record) records.push(record);
          }
        }
      }

      return records;
    },
  };
}

/**
 * Return the generic correlation index. The shared walker populates `byScope`
 * directly; this also reconstructs element-scope groups from `byElement` so a
 * feature set built only with element features still correlates. The walker's own
 * `byScope` entries take precedence and are never mutated.
 */
function correlationIndex(
  features: ExtractedFeatures,
): Map<JoinScope, Map<string, CorrelatedFeature[]>> {
  const index = new Map<JoinScope, Map<string, CorrelatedFeature[]>>();

  // `byScope` may be absent when a caller hand-builds a feature set from element
  // features alone; the element groups are then reconstructed from `byElement`.
  if (features.byScope) {
    for (const [scope, byValue] of features.byScope) {
      const copy = new Map<string, CorrelatedFeature[]>();
      for (const [joinValue, list] of byValue) copy.set(joinValue, [...list]);
      index.set(scope, copy);
    }
  }

  const elementGroups = index.get('element') ?? new Map<string, CorrelatedFeature[]>();
  for (const [elementKey, bucket] of features.byElement) {
    const existing = elementGroups.get(elementKey) ?? [];
    const present = new Set(existing.map((f) => `${f.domainId}::${f.featureKey}`));
    for (const [domainId, domainMap] of Object.entries(bucket.domainFeatures)) {
      for (const [featureKey, value] of domainMap) {
        if (present.has(`${domainId}::${featureKey}`)) continue;
        existing.push({ domainId, featureKey, value, scope: 'element', joinValue: elementKey });
      }
    }
    if (existing.length > 0) elementGroups.set(elementKey, existing);
  }
  if (elementGroups.size > 0) index.set('element', elementGroups);

  return index;
}

/** One unordered pair of distinct domains that both recorded on a join value. */
interface Candidate {
  domainA: string;
  domainB: string;
  countA: number;
  countB: number;
}

/**
 * Enumerate the unordered domain pairs present in one join group. Domains are
 * sorted so a pair is keyed consistently regardless of insertion order.
 */
function candidatePairs(features: readonly CorrelatedFeature[]): Candidate[] {
  const countByDomain = new Map<string, number>();
  for (const f of features) {
    countByDomain.set(f.domainId, (countByDomain.get(f.domainId) ?? 0) + 1);
  }
  const domains = [...countByDomain.keys()].sort();

  const out: Candidate[] = [];
  for (let i = 0; i < domains.length; i += 1) {
    for (let j = i + 1; j < domains.length; j += 1) {
      const domainA = domains[i] as string;
      const domainB = domains[j] as string;
      out.push({
        domainA,
        domainB,
        countA: countByDomain.get(domainA) ?? 0,
        countB: countByDomain.get(domainB) ?? 0,
      });
    }
  }
  return out;
}

/**
 * Score a candidate pair with the fitted shared boundary. The two engineered
 * features both vary with the data:
 *
 * - co-occurrence strength = how balanced the two domains' presence is on this
 *   join value (min over max of their feature counts) — 1.0 when both flag it
 *   comparably, falling toward 0 when one side barely participates;
 * - count signal = the geometric mean of how many features each domain set.
 *
 * A record is emitted only for a known pair (by sorted domain ids + scope) whose
 * predicted probability clears the decision threshold.
 */
function score(
  scope: JoinScope,
  joinValue: string,
  candidate: Candidate,
  scanId: string,
): InteractionRecord | undefined {
  const key = `${candidate.domainA}|${candidate.domainB}|${scope}`;
  const label = MODEL.pairs[key];
  if (!label) return undefined;

  const maxCount = Math.max(candidate.countA, candidate.countB);
  const cooccurrence = maxCount === 0 ? 0 : Math.min(candidate.countA, candidate.countB) / maxCount;
  const countSignal = Math.sqrt(candidate.countA * candidate.countB);

  const { weights, bias } = MODEL.sharedBoundary;
  const z = weights[0] * cooccurrence + weights[1] * countSignal + bias;
  const probability = sigmoid(z);
  if (probability < MODEL.decisionThreshold) return undefined;

  return {
    id: `${scanId}:${candidate.domainA}-${candidate.domainB}:${joinValue}`,
    type: label.kind,
    domains: [candidate.domainA, candidate.domainB],
    elementKey: joinValue,
    predictedEffect: label.effect,
    confidence: probability,
  };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}
