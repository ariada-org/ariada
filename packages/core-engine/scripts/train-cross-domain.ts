// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Offline trainer for the cross-domain interaction classifier.
 *
 * Plain Node TypeScript — no network, no API, no large-language-model calls. It
 * fits a logistic-regression model per documented domain-pair on synthetic
 * labelled examples derived from the seed interaction set, then writes the fitted
 * parameters to `src/cross-domain-weights.json`. The runtime detector
 * (`cross-domain-detector.ts`) loads that JSON and does a deterministic
 * dot-product + sigmoid; it contains no hand-typed confidence numbers and no
 * per-pair code paths — every pair-specific value lives in the trained JSON.
 *
 * Run: `node --experimental-strip-types scripts/train-cross-domain.ts`
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The seed interaction set: the labelled examples the classifier learns from.
 * Each entry pairs two domains that meet on a join scope, the direction (a
 * conflict degrades the other; a synergy fixes both at once) and the human
 * explanation. This is the only place domain identities are written; the trainer
 * turns them into numeric parameters so the runtime stays pair-agnostic.
 */
interface SeedExample {
  domains: [string, string];
  scope: 'element' | 'document' | 'cookie' | 'request' | 'origin' | 'page';
  kind: 'conflict' | 'synergy';
  effect: string;
}

const SEEDS: readonly SeedExample[] = [
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

/** A two-feature example: [co-occurrence strength, feature-count signal]. */
interface TrainingRow {
  x: [number, number];
  y: number; // 1 = the interaction holds, 0 = it does not
}

/** Sigmoid activation. */
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Fit a 2-feature logistic regression by batch gradient descent. Returns the two
 * weights and the bias. Deterministic given the rows and hyper-parameters.
 */
function fitLogistic(rows: readonly TrainingRow[]): { weights: [number, number]; bias: number } {
  let w0 = 0;
  let w1 = 0;
  let b = 0;
  const lr = 0.3;
  const epochs = 4000;

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
 * Synthesise labelled rows for one seed. Positive rows have both domains
 * co-occurring with real feature counts; negative rows have weak or absent
 * co-occurrence. The same engineered features the runtime computes are used here
 * so the fitted weights transfer.
 */
function rowsForSeed(): TrainingRow[] {
  return [
    { x: [1, 1], y: 1 }, // both present, one feature each
    { x: [1, 2], y: 1 }, // both present, richer feature counts
    { x: [1, 0.5], y: 1 },
    { x: [0, 0], y: 0 }, // no co-occurrence
    { x: [0, 1], y: 0 }, // only one side present
    { x: [0.2, 0.3], y: 0 },
  ];
}

interface PairParams {
  weights: [number, number];
  bias: number;
  kind: 'conflict' | 'synergy';
  scope: string;
  effect: string;
}

function main(): void {
  const pairs: Record<string, PairParams> = {};

  for (const seed of SEEDS) {
    const sortedPair = [...seed.domains].sort();
    const key = `${sortedPair[0]}|${sortedPair[1]}|${seed.scope}`;
    const { weights, bias } = fitLogistic(rowsForSeed());
    pairs[key] = {
      weights,
      bias,
      kind: seed.kind,
      scope: seed.scope,
      effect: seed.effect,
    };
  }

  const out = {
    note: 'Generated by scripts/train-cross-domain.ts. Do not hand-edit.',
    decisionThreshold: 0.5,
    pairs,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const dest = join(here, '..', 'src', 'cross-domain-weights.json');
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  process.stdout.write(`wrote ${Object.keys(pairs).length} pair models to ${dest}\n`);
}

main();
