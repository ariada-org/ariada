// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Phase 2 tests — prefilter integration + adapter seam contracts.
 *
 * Covers:
 *  (a) `createRulePackPrefilter` builds a working prefilter from rule-packs.
 *  (b) The `disablePrefilter` flag disables the prefilter so all snippets go to
 *      the leaf.
 *  (c) Signal-bearing snippets always reach the leaf even when most are skipped.
 *  (d) Fake leaf + fake prefilter compose correctly with createRecursiveEvaluator.
 *  (e) The two leaf-adapter interfaces are structural-only (no network, no SDK).
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createRecursiveEvaluator,
  createRulePackPrefilter,
  type ManagedApiLeaf,
  type SemanticEvaluator,
  type SemanticHit,
  type SemanticRequest,
  type SubscriptionSubagentLeaf,
} from '../src/index.js';
import type { RulePack } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple fake leaf that flags lines containing a keyword. */
function makeTrackedLeaf(keyword: string): SemanticEvaluator & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    evaluate(req: SemanticRequest): Promise<SemanticHit[]> {
      calls.push(req.content);
      const kw = keyword.toLowerCase();
      const lines = req.content.split(/\r?\n/);
      const hits: SemanticHit[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const idx = line.toLowerCase().indexOf(kw);
        if (idx !== -1) {
          hits.push({ matchedText: line.slice(idx, idx + kw.length), line: i + 1 });
        }
      }
      return Promise.resolve(hits);
    },
  };
}

/** A rule-pack whose patterns match the literal word "secret". */
const secretPack: RulePack = {
  id: 'secret-pack',
  description: 'Test pack that matches "secret"',
  rules: [
    {
      id: 'secret-rule',
      description: 'Flags the word secret',
      action: 'fail',
      category: 'test',
      patterns: ['\\bsecret\\b'],
    },
  ],
};

// ---------------------------------------------------------------------------
// createRulePackPrefilter — basic construction and behaviour
// ---------------------------------------------------------------------------

describe('createRulePackPrefilter — basic construction', () => {
  it('returns a function', () => {
    const filter = createRulePackPrefilter([secretPack]);
    expect(typeof filter).toBe('function');
  });

  it('returns true for a snippet that matches a pack pattern', () => {
    const filter = createRulePackPrefilter([secretPack]);
    expect(filter('This snippet mentions secret here.')).toBe(true);
  });

  it('returns false for a snippet with no match', () => {
    const filter = createRulePackPrefilter([secretPack]);
    expect(filter('This snippet is completely clean and has no issues.')).toBe(false);
  });

  it('handles an empty packs array — returns false for any snippet (no patterns)', () => {
    const filter = createRulePackPrefilter([]);
    expect(filter('secret is here')).toBe(false);
  });

  it('matches across multiple rules in the same pack', () => {
    const multiPack: RulePack = {
      id: 'multi',
      description: 'Pack with two rules',
      rules: [
        { id: 'r1', description: 'A', action: 'fail', category: 'c', patterns: ['\\bfoo\\b'] },
        { id: 'r2', description: 'B', action: 'fail', category: 'c', patterns: ['\\bbar\\b'] },
      ],
    };
    const filter = createRulePackPrefilter([multiPack]);
    expect(filter('contains foo here')).toBe(true);
    expect(filter('contains bar here')).toBe(true);
    expect(filter('contains neither')).toBe(false);
  });

  it('skips rules that have no patterns (prompt-only rules)', () => {
    const promptOnlyPack: RulePack = {
      id: 'prompt-only',
      description: 'A prompt-only rule has no regex patterns',
      rules: [
        {
          id: 'po',
          description: 'Prompt only',
          action: 'fail',
          category: 'c',
          patterns: [],
          prompt: 'Flag any mention of secret',
        },
      ],
    };
    const filter = createRulePackPrefilter([promptOnlyPack]);
    // Prompt-only rules contribute no patterns → filter returns false (no signal to match).
    expect(filter('secret is here')).toBe(false);
  });

  it('is case-insensitive (matches "SECRET" and "Secret")', () => {
    const filter = createRulePackPrefilter([secretPack]);
    expect(filter('This has SECRET here')).toBe(true);
    expect(filter('This has Secret here')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createRulePackPrefilter — integration with createRecursiveEvaluator
// ---------------------------------------------------------------------------

describe('createRulePackPrefilter — integration with createRecursiveEvaluator', () => {
  it('skips clean snippets and still finds the hit in the signal-bearing snippet', async () => {
    const cleanBlocks = Array.from({ length: 4 }, (_, i) => `Clean block number ${i + 1} has no issues.\n`).join('');
    const hitBlock = 'This block has secret in it and must be evaluated.\n';
    const doc = cleanBlocks + hitBlock;

    const leaf = makeTrackedLeaf('secret');
    const prefilter = createRulePackPrefilter([secretPack]);
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 60, prefilter });

    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag secret', category: 'test', action: 'fail' },
    });

    // Hit must be found.
    expect(hits.some((h) => h.matchedText.toLowerCase() === 'secret')).toBe(true);
    // The leaf must NOT have been called for every single snippet (prefilter skipped clean ones).
    // We can't assert exact counts due to overlap windows, but total calls < total snippet count.
    const totalSnippets = Math.ceil(doc.length / 60) + 2; // rough upper bound
    expect(leaf.calls.length).toBeLessThan(totalSnippets);
  });

  it('reports non-zero prefilterSkipped in metrics when prefilter is active', async () => {
    const cleanBlocks = Array.from({ length: 3 }, () => 'Completely clean block with nothing.\n').join('\n\n');
    const hitBlock = '\n\nLast block has secret word.';
    const doc = cleanBlocks + hitBlock;

    const leaf = makeTrackedLeaf('secret');
    const prefilter = createRulePackPrefilter([secretPack]);
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 50, prefilter });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag secret', category: 'test', action: 'fail' },
    });

    expect(result.metrics.prefilterSkipped).toBeGreaterThan(0);
    expect(result.hits.some((h) => h.matchedText.toLowerCase() === 'secret')).toBe(true);
  });

  it('evaluates all snippets when NO prefilter is provided (default behaviour unchanged)', async () => {
    const doc = Array.from({ length: 3 }, (_, i) => `Block ${i + 1} is clean.\n`).join('\n\n');

    const leaf = makeTrackedLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 30 }); // no prefilter

    await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    // With no prefilter, every snippet must be sent to the leaf.
    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });
    expect(result.metrics.prefilterSkipped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Disable-prefilter flag — a caller may opt out per-call
// ---------------------------------------------------------------------------

describe('disablePrefilter flag', () => {
  it('passes all snippets to the leaf when disablePrefilter=true even if prefilter is set', async () => {
    // A prefilter that never lets anything through.
    const blockAllPrefilter = (_: string) => false;

    const doc = 'Block one.\n\nBlock two with secret.\n\nBlock three.';
    const leaf = makeTrackedLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 30, prefilter: blockAllPrefilter });

    // With the prefilter active, the hit should be missed.
    const hitsWithFilter = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    // With disablePrefilter the hit should be found regardless.
    const hitsNoFilter = await rle.evaluate(
      { content: doc, rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' } },
      { disablePrefilter: true },
    );

    // When filter blocks everything: no hits.
    expect(hitsWithFilter.length).toBe(0);
    // When filter disabled: hit found.
    expect(hitsNoFilter.some((h) => h.matchedText.toLowerCase() === 'secret')).toBe(true);
  });

  it('evaluateWithBudget respects disablePrefilter=true', async () => {
    const blockAllPrefilter = (_: string) => false;
    const doc = 'Clean snippet.\n\nAnother snippet with secret here.';
    const leaf = makeTrackedLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 30, prefilter: blockAllPrefilter });

    const resultFiltered = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    const resultUnfiltered = await rle.evaluateWithBudget(
      { content: doc, rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' } },
      { disablePrefilter: true },
    );

    // Filtered: everything skipped, no hits, prefilterSkipped > 0.
    expect(resultFiltered.metrics.prefilterSkipped).toBeGreaterThan(0);
    expect(resultFiltered.hits.length).toBe(0);

    // Unfiltered: hits found, prefilterSkipped = 0.
    expect(resultUnfiltered.metrics.prefilterSkipped).toBe(0);
    expect(resultUnfiltered.hits.some((h) => h.matchedText.toLowerCase() === 'secret')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Adapter seam contracts — structural type checks (no network, no SDK)
// ---------------------------------------------------------------------------

describe('SubscriptionSubagentLeaf — interface contract', () => {
  it('can be implemented with a synchronous-wrapping async method', () => {
    // Verify the interface compiles with a valid implementation.
    const impl: SubscriptionSubagentLeaf = {
      kind: 'host-dispatched',
      evaluate(_req: SemanticRequest): Promise<SemanticHit[]> {
        return Promise.resolve([]);
      },
    };
    expect(impl.kind).toBe('host-dispatched');
    expect(typeof impl.evaluate).toBe('function');
  });

  it('has the SemanticEvaluator evaluate method', async () => {
    const impl: SubscriptionSubagentLeaf = {
      kind: 'host-dispatched',
      evaluate(_req: SemanticRequest): Promise<SemanticHit[]> {
        return Promise.resolve([{ matchedText: 'test', line: 1 }]);
      },
    };
    const hits = await impl.evaluate({
      content: 'test content',
      rule: { id: 'r', prompt: 'p', category: 'c', action: 'fail' },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.matchedText).toBe('test');
  });

  it('is assignable as a SemanticEvaluator (structural subtype)', () => {
    const impl: SubscriptionSubagentLeaf = {
      kind: 'host-dispatched',
      evaluate: (_req: SemanticRequest) => Promise.resolve([]),
    };
    // TypeScript structural check: assign to SemanticEvaluator.
    const asEvaluator: SemanticEvaluator = impl;
    expect(typeof asEvaluator.evaluate).toBe('function');
  });

  it('can be used as the leaf in createRecursiveEvaluator', async () => {
    const spyFn = vi.fn((_req: SemanticRequest) => Promise.resolve<SemanticHit[]>([]));
    const impl: SubscriptionSubagentLeaf = {
      kind: 'host-dispatched',
      evaluate: spyFn,
    };
    const rle = createRecursiveEvaluator({ leaf: impl, maxLeafChars: 100 });
    await rle.evaluate({
      content: 'some content',
      rule: { id: 'r', prompt: 'p', category: 'c', action: 'fail' },
    });
    expect(spyFn).toHaveBeenCalled();
  });
});

describe('ManagedApiLeaf — interface contract', () => {
  it('can be implemented with required fields', () => {
    const impl: ManagedApiLeaf = {
      kind: 'managed-api',
      evaluate(_req: SemanticRequest): Promise<SemanticHit[]> {
        return Promise.resolve([]);
      },
    };
    expect(impl.kind).toBe('managed-api');
    expect(typeof impl.evaluate).toBe('function');
  });

  it('is assignable as a SemanticEvaluator (structural subtype)', () => {
    const impl: ManagedApiLeaf = {
      kind: 'managed-api',
      evaluate: (_req: SemanticRequest) => Promise.resolve([]),
    };
    const asEvaluator: SemanticEvaluator = impl;
    expect(typeof asEvaluator.evaluate).toBe('function');
  });

  it('can be used as the leaf in createRecursiveEvaluator', async () => {
    const spyFn = vi.fn((_req: SemanticRequest) => Promise.resolve<SemanticHit[]>([]));
    const impl: ManagedApiLeaf = {
      kind: 'managed-api',
      evaluate: spyFn,
    };
    const rle = createRecursiveEvaluator({ leaf: impl, maxLeafChars: 100 });
    await rle.evaluate({
      content: 'content to evaluate',
      rule: { id: 'r', prompt: 'p', category: 'c', action: 'fail' },
    });
    expect(spyFn).toHaveBeenCalled();
  });

  it('has no network or SDK code in the interface itself (structural check)', () => {
    // This test verifies that creating an instance of ManagedApiLeaf does NOT
    // require any network call or SDK initialization. The interface is pure.
    let constructionError: unknown = null;
    try {
      const _impl: ManagedApiLeaf = {
        kind: 'managed-api',
        evaluate: () => Promise.resolve([]),
      };
    } catch (e) {
      constructionError = e;
    }
    expect(constructionError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Adapter purity — adapters.ts must not import any SDK or network module
// ---------------------------------------------------------------------------

describe('adapters.ts purity — no SDK or network imports', () => {
  it('adapters.ts source contains no model SDK or HTTP client imports', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../src/adapters.ts', import.meta.url),
      'utf-8',
    );
    expect(source).not.toMatch(/from\s+['"]@anthropic-ai\//);
    expect(source).not.toMatch(/from\s+['"]openai/);
    expect(source).not.toMatch(/from\s+['"]node:https?['"]/);
    expect(source).not.toMatch(/from\s+['"]node:net['"]/);
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/from\s+['"]node:crypto['"]/);
  });
});
