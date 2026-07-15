// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Offline trainer for the cross-domain interaction classifier.
 *
 * Plain Node TypeScript — no network, no API, no large-language-model calls. It
 * fits ONE shared logistic-regression boundary over two engineered features —
 * co-occurrence strength and shared-key count — on synthetic labelled examples,
 * then writes the fitted boundary plus the per-pair labels (kind, scope, effect)
 * to `src/cross-domain-weights.json`.
 *
 * Honesty note: the model is a SINGLE shared boundary, not five distinct per-pair
 * models. Per-pair specialisation needs real labelled scan data, which we do not
 * have yet; fabricating per-pair training variation to force distinct weights
 * would be dishonest. So the only per-pair data is the label set (which pairs
 * interact, in what direction, with what effect); whether a given coincidence
 * fires is decided by the shared boundary over genuinely-varying features.
 *
 * Run: `node --experimental-strip-types scripts/train-cross-domain.ts`
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The seed interaction set: which domain pairs interact, on what join scope, in
 * what direction, with the human explanation. This is the only place domain
 * identities are written; it becomes the label table the runtime consults after
 * the shared boundary decides a coincidence is strong enough to report.
 */
interface SeedLabel {
  domains: [string, string];
  scope: 'element' | 'document' | 'cookie' | 'request' | 'origin' | 'page';
  kind: 'conflict' | 'synergy';
  effect: string;
}

const SEEDS: readonly SeedLabel[] = [
  {
    domains: ['accessibility', 'sustainability'],
    scope: 'element',
    kind: 'conflict',
    effect:
      'Compressing this image to cut page weight can reduce visual fidelity that alt text depends on; remediating one constraint affects the other.',
  },
  {
    domains: ['performance', 'accessibility'],
    scope: 'element',
    kind: 'conflict',
    effect:
      'Lazy-loading this element to improve load time can hide it from assistive technology until it scrolls into view; the speed gain costs discoverability.',
  },
  {
    domains: ['security', 'accessibility'],
    scope: 'element',
    kind: 'conflict',
    effect:
      'Tightening the content security policy to block this script removes a dependency the assistive-technology behaviour relies on; hardening here weakens accessibility there.',
  },
  {
    domains: ['privacy', 'security'],
    scope: 'cookie',
    kind: 'synergy',
    effect:
      'Deferring this cookie until consent and adding the secure flags are a single fix that improves both privacy and security at once.',
  },
  {
    domains: ['accessibility', 'structured-data'],
    scope: 'element',
    kind: 'synergy',
    effect:
      'Writing one description for this image supplies both the alt text and the structured-data image description, fixing both findings together.',
  },
];

/** One example: [co-occurrence strength in [0,1], shared-key count signal]. */
interface TrainingRow {
  x: [number, number];
  y: number; // 1 = a real interaction, 0 = a spurious coincidence
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Fit a 2-feature logistic regression by batch gradient descent. Deterministic
 * given the rows and hyper-parameters.
 */
function fitLogistic(rows: readonly TrainingRow[]): { weights: [number, number]; bias: number } {
  let w0 = 0;
  let w1 = 0;
  let b = 0;
  const lr = 0.3;
  const epochs = 6000;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    let g0 = 0;
    let g1 = 0;
    let gb = 0;
    for (const row of rows) {
      const pred = sigmoid(w0 * row.x[0] + w1 * row.x[1] + b);
      const err = pred - row.y;
      g0 += err * row.x[0];
      g1 += err * row.x[1];
      gb += err;
    }
    const n = rows.length;
    w0 -= (lr * g0) / n;
    w1 -= (lr * g1) / n;
    b -= (lr * gb) / n;
  }

  return { weights: [w0, w1], bias: b };
}

/**
 * Synthetic labelled examples spanning the real range of the two engineered
 * features. Positives are strong, balanced co-occurrences (both domains flag the
 * same join value comparably); negatives are weak or one-sided coincidences. Both
 * features vary across the rows, so each weight converges to a meaningful non-zero value.
 */
function trainingRows(): TrainingRow[] {
  return [
    // Positives: high co-occurrence strength, real shared-key counts.
    { x: [1.0, 1.0], y: 1 },
    { x: [1.0, 1.4], y: 1 },
    { x: [0.8, 1.0], y: 1 },
    { x: [0.67, 1.2], y: 1 },
    { x: [0.75, 0.9], y: 1 },
    // Negatives: lopsided or thin coincidences that should not fire.
    { x: [0.2, 0.6], y: 0 },
    { x: [0.25, 1.0], y: 0 },
    { x: [0.0, 0.0], y: 0 },
    { x: [0.33, 0.5], y: 0 },
    { x: [0.1, 0.3], y: 0 },
  ];
}

interface PairLabel {
  kind: 'conflict' | 'synergy';
  scope: string;
  effect: string;
}

function main(): void {
  const { weights, bias } = fitLogistic(trainingRows());

  const pairs: Record<string, PairLabel> = {};
  for (const seed of SEEDS) {
    const sortedPair = [...seed.domains].sort();
    const key = `${sortedPair[0]}|${sortedPair[1]}|${seed.scope}`;
    pairs[key] = { kind: seed.kind, scope: seed.scope, effect: seed.effect };
  }

  const out = {
    note: 'Generated by scripts/train-cross-domain.ts. Do not hand-edit.',
    model: 'single shared interaction boundary; per-pair specialisation pending real labelled data',
    decisionThreshold: 0.5,
    sharedBoundary: { weights, bias },
    pairs,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const dest = join(here, '..', 'src', 'cross-domain-weights.json');
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `wrote shared boundary + ${Object.keys(pairs).length} pair labels to ${dest}\n`,
  );
}

main();
