// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Tests for createRecursiveEvaluator — the RLM (Recursive Language Model)
 * inference-strategy wrapper that decomposes large content into snippets,
 * evaluates each through an injected leaf SemanticEvaluator, maps
 * snippet-local line numbers to document-global lines, and aggregates +
 * dedupes findings by content fingerprint.
 *
 * All tests use a deterministic fake leaf (keyword-matching) so no model
 * or network is involved. Network and SDK imports are verified absent by
 * a grep-based assertion in the "purity" suite.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createRecursiveEvaluator,
  evaluateContentAsync,
  promptProfile,
  type SemanticEvaluator,
  type SemanticHit,
  type SemanticRequest,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Fake deterministic leaf — flags lines that contain a keyword from the prompt.
// Mirrors the keyword evaluator in semantic.test.ts but tracks call count.
// ---------------------------------------------------------------------------

function makeKeywordLeaf(keyword: string): SemanticEvaluator & { callCount: number } {
  let callCount = 0;
  return {
    get callCount() {
      return callCount;
    },
    evaluate(req: SemanticRequest): Promise<SemanticHit[]> {
      callCount++;
      const kw = keyword.toLowerCase();
      const lines = req.content.split(/\r?\n/);
      const hits: SemanticHit[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const idx = line.toLowerCase().indexOf(kw);
        if (idx !== -1) {
          hits.push({
            matchedText: line.slice(idx, idx + kw.length),
            line: i + 1,
            reason: `contains "${keyword}"`,
          });
        }
      }
      return Promise.resolve(hits);
    },
  };
}

// A profile + pack that uses one prompt rule, wired through promptProfile.
function makeSemanticProfile(keyword: string) {
  return promptProfile('test-profile', 'test-surface', `Flag any mention of ${keyword}`);
}

// ---------------------------------------------------------------------------
// Full coverage — large input is fully covered including the last chunk
// ---------------------------------------------------------------------------

describe('full coverage — large document is evaluated end-to-end', () => {
  it('reports a hit planted in the last chunk of a document 10× larger than maxLeafChars', async () => {
    // Build a document: 9 "clean" blocks followed by one block with "secret"
    // Each block is ~100 chars so the total is ~1000 chars;  maxLeafChars=150.
    const cleanBlock = 'This paragraph contains no sensitive words and is perfectly fine here.\n';
    const hitBlock = 'This paragraph mentions secret which is the forbidden keyword.\n';
    const doc = cleanBlock.repeat(9) + hitBlock;

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 150 });

    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag any mention of secret', category: 'test', action: 'fail' },
    });

    expect(hits.length).toBeGreaterThan(0);
    const matchedTexts = hits.map((h) => h.matchedText.toLowerCase());
    expect(matchedTexts.some((t) => t.includes('secret'))).toBe(true);
  });

  it('evaluates every chunk when there are multiple hits spread across the document', async () => {
    // One hit per chunk — every chunk must be visited.
    const chunkA = 'First block has target at the end: secret\n';
    const chunkB = 'Another block with the word secret again here.\n';
    const doc = chunkA + 'padding line\n'.repeat(5) + chunkB;

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 100 });
    await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });
    // Both hits should appear (dedupe operates on fingerprint = ruleId + text;
    // same matchedText from two chunks dedupes — but here both have the word "secret").
    // After dedup by (ruleId, matchedText) → one unique fingerprint for "secret" across chunks.
    // The important thing: the leaf WAS called for both chunks.
    expect(leaf.callCount).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Line mapping — snippet-local hits map to correct document-global lines
// ---------------------------------------------------------------------------

describe('line mapping — snippet-local lines are remapped to document-global lines', () => {
  it('remaps line numbers when the hit is in the second chunk', async () => {
    // Exactly 4 clean lines then a hit line. maxLeafChars small so the document
    // is split after the first chunk.
    const lines = [
      'line one is clean',
      'line two is clean',
      'line three is clean',
      'line four is clean',
      'line five has secret in it',
    ];
    const doc = lines.join('\n');

    const leaf = makeKeywordLeaf('secret');
    // maxLeafChars chosen so the first chunk contains ≤3 lines and the hit
    // is in the second chunk.
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 60 });
    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    const secretHit = hits.find((h) => h.matchedText.toLowerCase().includes('secret'));
    expect(secretHit).toBeDefined();
    // The hit is on document line 5.
    expect(secretHit?.line).toBe(5);
  });

  it('maps a hit in the first chunk to its correct global line', async () => {
    const lines = ['clean first', 'secret here on line two', 'clean third'];
    const doc = lines.join('\n');

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 40 });
    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    const secretHit = hits.find((h) => h.matchedText.toLowerCase() === 'secret');
    expect(secretHit).toBeDefined();
    expect(secretHit?.line).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Deduplication — same span in overlapping chunks dedupes to one finding
// ---------------------------------------------------------------------------

describe('deduplication — overlapping snippets produce at most one finding per span', () => {
  it('collapses findings with the same ruleId and matchedText to a single result', async () => {
    // A short document where the hit sits near a chunk boundary; with overlap
    // both adjacent chunks will see it. The recursive evaluator should dedupe.
    const doc = [
      'block alpha content here',
      'the secret keyword lives here',
      'block beta content here',
    ].join('\n');

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({
      leaf,
      maxLeafChars: 40, // small cap forces overlap to straddle the boundary
    });
    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r-dedup', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    const secretHits = hits.filter((h) => h.matchedText.toLowerCase() === 'secret');
    // After fingerprint dedup there must be at most one.
    expect(secretHits.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Budget exhaustion — partial pass is never silently clean
// ---------------------------------------------------------------------------

describe('budget exhaustion — partial pass is never silently clean', () => {
  it('returns partial findings and a non-empty unevaluated range when maxLeafCalls is tiny', async () => {
    // A document with 5 "chunks" worth of content but maxLeafCalls = 2.
    const block = (n: number) => `Block number ${n} of content is here and is quite long.\n`;
    const doc = Array.from({ length: 5 }, (_, i) => block(i + 1)).join('');

    const leaf = makeKeywordLeaf('secret'); // no hits intentionally — tests the budget path
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 80, maxLeafCalls: 2 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    expect(result.unevaluatedContent).toBeDefined();
    expect(result.unevaluatedContent!.length).toBeGreaterThan(0);
    // The leaf should have been called at most maxLeafCalls times.
    expect(leaf.callCount).toBeLessThanOrEqual(2);
  });

  it('budget exhaustion in evaluateContentAsync surfaces unevaluated in the ContentGateDecision', async () => {
    const block = (n: number) => `This is block ${n} and it has a lot of words to fill space.\n`;
    const doc = Array.from({ length: 6 }, (_, i) => block(i + 1)).join('');

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 80, maxLeafCalls: 1 });
    const { profile, pack } = makeSemanticProfile('secret');

    const decision = await evaluateContentAsync(doc, profile, [pack], rle);

    // The decision must flag that some content was not evaluated.
    expect(decision.unevaluated).toBeDefined();
    expect(decision.unevaluated!.length).toBeGreaterThan(0);
    // The reason must communicate the budget exhaustion, not "no evaluator".
    expect(decision.unevaluated![0]?.reason).toMatch(/budget|exhausted|partial/i);
  });
});

// ---------------------------------------------------------------------------
// Prefilter — zero-signal snippets skipped, signal-bearing snippet always evaluated
// ---------------------------------------------------------------------------

describe('prefilter — zero-signal snippets skipped, signal-bearing snippet always evaluated', () => {
  it('does not call the leaf for snippets with no candidate text when prefilter is active', async () => {
    // Prefilter: skip chunks that don't contain the literal keyword "secret".
    const prefilter = (snippet: string) => snippet.toLowerCase().includes('secret');

    const cleanBlocks = Array.from({ length: 4 }, () => 'This block has nothing suspicious.\n').join('');
    const hitBlock = 'This block has secret in it.\n';
    const doc = cleanBlocks + hitBlock;

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 60, prefilter });

    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    // The hit must still be found.
    expect(hits.some((h) => h.matchedText.toLowerCase() === 'secret')).toBe(true);
    // The leaf must NOT have been called for the clean chunks.
    // We can't know exactly how many chunks form, but callCount must be < total chunks
    // (at least the 4 clean chunks should be skipped).
    expect(leaf.callCount).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// Purity — no model/network import in the package source
// ---------------------------------------------------------------------------

describe('purity — no SDK or network import in the package', () => {
  it('recursive.ts contains no SDK or HTTP client imports', () => {
    // Read the source directly and assert it has no dangerous imports.
    const source = readFileSync(
      new URL('../src/recursive.ts', import.meta.url),
      'utf-8',
    );
    // Must not import any LLM SDK, HTTP client, or node:http(s)/node:net
    expect(source).not.toMatch(/from\s+['"]@anthropic-ai\//);
    expect(source).not.toMatch(/from\s+['"]openai/);
    expect(source).not.toMatch(/from\s+['"]node:https?['"]/);
    expect(source).not.toMatch(/from\s+['"]node:net['"]/);
    expect(source).not.toMatch(/fetch\s*\(/);
    // The ONLY node: import allowed is node:crypto (via contentFingerprint from evaluate.ts).
    // Actually the module itself must not import node:crypto directly;
    // it delegates to contentFingerprint from evaluate.ts.
    // So assert no direct createHash usage either.
    expect(source).not.toMatch(/from\s+['"]node:crypto['"]/);
  });
});

// ---------------------------------------------------------------------------
// Composability — drops in as a SemanticEvaluator with evaluateContentAsync
// ---------------------------------------------------------------------------

describe('composition — createRecursiveEvaluator drops in as a SemanticEvaluator', () => {
  it('composes with evaluateContentAsync and returns the normal ContentGateDecision shape', async () => {
    const doc = [
      'Line one is clean.',
      'Line two is also clean.',
      'Line three says secret and triggers a finding.',
      'Line four is clean.',
    ].join('\n');

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 80 });
    const { profile, pack } = makeSemanticProfile('secret');

    const decision = await evaluateContentAsync(doc, profile, [pack], rle);

    expect(decision.result).toBe('fail');
    expect(decision.findings).toHaveLength(1);
    expect(decision.findings[0]?.tier).toBe('semantic');
    expect(decision.findings[0]?.matchedText.toLowerCase()).toBe('secret');
    // Line 3 in the document.
    expect(decision.findings[0]?.line).toBe(3);
  });

  it('passes clean content and produces result=pass with no findings', async () => {
    const doc = 'Line one.\nLine two.\nLine three.\nAll clean here.';
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 40 });
    const { profile, pack } = makeSemanticProfile('secret');

    const decision = await evaluateContentAsync(doc, profile, [pack], rle);
    expect(decision.result).toBe('pass');
    expect(decision.findings).toHaveLength(0);
  });

  it('returns a ContentGateDecision with the correct profileId and surface', async () => {
    const doc = 'Just some clean content.';
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 200 });
    const { profile, pack } = makeSemanticProfile('secret');

    const decision = await evaluateContentAsync(doc, profile, [pack], rle);
    expect(decision.profileId).toBe('test-profile');
    expect(decision.surface).toBe('test-surface');
  });

  it('fingerprint deduplication collapses semantically identical findings', async () => {
    // Both chunks of a split document contain "secret"; the recursive evaluator
    // should call the leaf for each chunk but dedupe the findings to one because
    // the fingerprint is (ruleId, matchedText) — position-independent.
    const doc = 'secret is here\nsecret is also here on the second line\nmore clean text follows';
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 25 });
    const { profile, pack } = makeSemanticProfile('secret');

    const decision = await evaluateContentAsync(doc, profile, [pack], rle);
    // Two distinct lines with "secret" → two distinct findings
    // (fingerprint is ruleId+matchedText; same ruleId+matchedText → dedupe.
    // Since matchedText is the same word "secret" both times, after dedup → 1.
    // This tests that position-independent fingerprint works as specified.
    const secretFindings = decision.findings.filter((f) =>
      f.matchedText.toLowerCase() === 'secret',
    );
    expect(secretFindings.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Observability metrics — evaluateWithBudget returns populated RlmMetrics
// ---------------------------------------------------------------------------

describe('observability metrics — evaluateWithBudget populates RlmMetrics', () => {
  it('reports correct chunk count and leafCalls for a small document', async () => {
    const doc = ['Block one line.', '', 'Block two line.', '', 'Block three line.'].join('\n');
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 20 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    // Metrics must be present.
    expect(result.metrics).toBeDefined();
    expect(result.metrics.chunks).toBeGreaterThan(0);
    expect(result.metrics.leafCalls).toBeGreaterThan(0);
    expect(result.metrics.maxDepthReached).toBe(false);
    expect(result.metrics.findings).toBe(result.hits.length);
  });

  it('reports unevaluatedRemainder > 0 when budget is exhausted', async () => {
    const block = (n: number) => `Block ${n} has plenty of words to fill up the space.\n`;
    const doc = Array.from({ length: 5 }, (_, i) => block(i + 1)).join('');

    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 60, maxLeafCalls: 1 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    expect(result.metrics.unevaluatedRemainder).toBeGreaterThan(0);
    expect(result.unevaluatedContent.length).toBeGreaterThan(0);
    // leafCalls must not exceed the budget.
    expect(result.metrics.leafCalls).toBeLessThanOrEqual(1);
  });

  it('reports prefilterSkipped count when prefilter is active', async () => {
    const cleanBlocks = Array.from({ length: 3 }, () => 'No suspicious words here.\n').join('\n\n');
    const hitBlock = '\n\nThis block contains secret.';
    const doc = cleanBlocks + hitBlock;

    const prefilter = (s: string) => s.toLowerCase().includes('secret');
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 40, prefilter });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag', category: 'test', action: 'fail' },
    });

    // At least some chunks should have been skipped by the prefilter.
    expect(result.metrics.prefilterSkipped).toBeGreaterThan(0);
    // The hit must still be found.
    expect(result.hits.some((h) => h.matchedText.toLowerCase() === 'secret')).toBe(true);
  });
});
