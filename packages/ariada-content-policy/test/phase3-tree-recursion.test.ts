// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Phase 3 tests — tree recursion (P2 from the PRD).
 *
 * When a chunk produced by the chunker still exceeds maxLeafChars and
 * depth < maxDepth, createRecursiveEvaluator recurses on that chunk rather
 * than stopping at flat depth-1 chunking.
 *
 * All tests use a deterministic fake leaf so no model or network is involved.
 *
 * Covers:
 *  (a) A deeply-oversized input (chunk > maxLeafChars at depth 1) recurses past
 *      depth 1 and every region is still covered.
 *  (b) metrics.maxDepthReached is true when the recursion hits maxDepth.
 *  (c) A hit planted in the deepest chunk is found and deduped correctly.
 *  (d) maxDepth=1 (default) does NOT recurse and maxDepthReached stays false.
 *  (e) The budget (maxLeafCalls) is shared across all recursion levels so a tiny
 *      budget surfaces unevaluatedContent even in tree mode.
 */

import { describe, expect, it } from 'vitest';

import {
  createRecursiveEvaluator,
  type SemanticHit,
  type SemanticRequest,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Fake deterministic leaf
// ---------------------------------------------------------------------------

function makeKeywordLeaf(keyword: string): { callCount: number; evaluate(req: SemanticRequest): Promise<SemanticHit[]> } {
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

// ---------------------------------------------------------------------------
// Tree recursion — basic depth-2 scenario
// ---------------------------------------------------------------------------

describe('Phase 3 tree recursion — recurse when chunk > maxLeafChars and depth < maxDepth', () => {
  it('recurses past depth 1 and still finds a hit planted deep in a large single block', async () => {
    // We need a document that is one large structural block (no blank lines
    // separating it) that exceeds maxLeafChars at the first level. The default
    // chunker splits oversized blocks line-by-line; in depth-1-only mode those
    // sub-snippets are sent directly to the leaf. In tree-recursion mode when
    // the sub-snippet itself exceeds maxLeafChars another recursion level fires.
    //
    // Strategy: use a small maxLeafChars (50 chars) and a document whose lines
    // are themselves 80+ chars so each sub-snippet from the line-splitter
    // is still > 50 chars → triggers recursion at depth 2.
    const hitKeyword = 'draculascan';
    const longLine = `${'padding text fills this line'.repeat(3)} ${hitKeyword}`;   // >50 chars + keyword
    const cleanLongLine = 'padding text fills this line'.repeat(3);                 // >50 chars, no keyword
    const doc = [
      cleanLongLine,
      cleanLongLine,
      longLine,      // hit is here, line 3
    ].join('\n');

    const leaf = makeKeywordLeaf(hitKeyword);
    // maxLeafChars=50, maxDepth=3 → enables tree recursion
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 50, maxDepth: 3 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: `Flag ${hitKeyword}`, category: 'test', action: 'fail' },
    });

    // The hit must be found.
    expect(result.hits.some((h) => h.matchedText.toLowerCase().includes(hitKeyword))).toBe(true);
    // The document was fully covered (no budget exhaustion for this test).
    expect(result.unevaluatedContent).toBe('');
  });

  it('maxDepthReached is true when the tree reaches maxDepth', async () => {
    // We force maxDepth=2 and create content where depth-1 chunks exceed
    // maxLeafChars so depth-2 recursion fires. At depth 2 the sub-chunks
    // may still be oversized but maxDepth=2 means we stop and pass them to
    // the leaf directly — the engine should set maxDepthReached=true.
    const hitKeyword = 'secret';
    // Lines that are each longer than maxLeafChars (30 chars) so every snippet
    // is still oversized even after the first split.
    const longLine = `${'This is a long clean filler line that has padding text. '.repeat(1)}`;
    const hitLine = `${'Filler before the keyword. '.repeat(1)}${hitKeyword}${'  end of line'.repeat(1)}`;
    const doc = [longLine, longLine, hitLine].join('\n');

    const leaf = makeKeywordLeaf(hitKeyword);
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 30, maxDepth: 2 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: `Flag ${hitKeyword}`, category: 'test', action: 'fail' },
    });

    // maxDepthReached must be true when recursion hit the depth limit.
    expect(result.metrics.maxDepthReached).toBe(true);
  });

  it('a hit in the deepest recursion level is still reported and correctly deduped', async () => {
    const hitKeyword = 'targetword';
    // A single very long line that requires multiple recursion levels to split
    // down to a size the leaf receives it. Plant the keyword once.
    const longCleanPrefix = 'a'.repeat(200);  // 200 chars, no keyword
    const doc = `${longCleanPrefix} ${hitKeyword} ${longCleanPrefix}`;  // 402+ chars total, 1 line

    const leaf = makeKeywordLeaf(hitKeyword);
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 60, maxDepth: 4 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: `Flag ${hitKeyword}`, category: 'test', action: 'fail' },
    });

    // Hit must appear exactly once after dedup.
    const targetHits = result.hits.filter((h) => h.matchedText.toLowerCase() === hitKeyword);
    expect(targetHits.length).toBe(1);
    // Full coverage — nothing left unevaluated (budget is Infinity by default).
    expect(result.unevaluatedContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Default depth=1 — no tree recursion, maxDepthReached stays false
// ---------------------------------------------------------------------------

describe('Phase 3 — maxDepth=1 (default) does not recurse and maxDepthReached is false', () => {
  it('maxDepthReached is false at default depth=1', async () => {
    const doc = ['Line one is clean.', 'Line two has secret in it.', 'Line three is clean.'].join('\n');
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 80 }); // default maxDepth=1

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag secret', category: 'test', action: 'fail' },
    });

    expect(result.metrics.maxDepthReached).toBe(false);
  });

  it('explicit maxDepth=1 also keeps maxDepthReached false even for large content', async () => {
    const longLine = 'a'.repeat(200);
    const doc = [longLine, `${longLine} secret`, longLine].join('\n');
    const leaf = makeKeywordLeaf('secret');
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 50, maxDepth: 1 });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: 'Flag secret', category: 'test', action: 'fail' },
    });

    // At depth 1 we do not recurse, even if the chunk is still oversized.
    expect(result.metrics.maxDepthReached).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tree recursion + budget interaction
// ---------------------------------------------------------------------------

describe('Phase 3 tree recursion — budget exhaustion still surfaces unevaluatedContent', () => {
  it('a tiny maxLeafCalls still exposes unevaluatedContent even in tree mode', async () => {
    const hitKeyword = 'secret';
    const longLine = `${'padding text fills this line. '.repeat(2)}`;
    const lines = Array.from({ length: 10 }, (_, i) =>
      i === 9 ? `${longLine}${hitKeyword}` : longLine,
    );
    const doc = lines.join('\n');

    const leaf = makeKeywordLeaf(hitKeyword);
    const rle = createRecursiveEvaluator({
      leaf,
      maxLeafChars: 40,
      maxDepth: 3,
      maxLeafCalls: 1,  // tiny budget → exhaustion guaranteed
    });

    const result = await rle.evaluateWithBudget({
      content: doc,
      rule: { id: 'r1', prompt: `Flag ${hitKeyword}`, category: 'test', action: 'fail' },
    });

    // Budget exhausted → some content was not evaluated.
    expect(result.unevaluatedContent.length).toBeGreaterThan(0);
    expect(result.metrics.unevaluatedRemainder).toBeGreaterThan(0);
    // Leaf must not have been called more than the budget allows.
    expect(leaf.callCount).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Full coverage proof — hit in LAST chunk of a 10x-oversized doc with recursion
// ---------------------------------------------------------------------------

describe('Phase 3 full coverage — hit in the last chunk is found with tree recursion', () => {
  it('reports a hit planted in the very last region of a large document', async () => {
    const hitKeyword = 'forbidden';
    // Build a document: many long filler lines then one hit line at the end.
    const filler = 'This is a filler line that is definitely longer than fifty chars.';
    const hitLine = `This line mentions ${hitKeyword} at the end.`;
    const doc = Array.from({ length: 15 }, (_, i) => (i === 14 ? hitLine : filler)).join('\n');

    const leaf = makeKeywordLeaf(hitKeyword);
    const rle = createRecursiveEvaluator({ leaf, maxLeafChars: 50, maxDepth: 3 });

    const hits = await rle.evaluate({
      content: doc,
      rule: { id: 'r1', prompt: `Flag ${hitKeyword}`, category: 'test', action: 'fail' },
    });

    // The hit in the last chunk must be reported.
    expect(hits.some((h) => h.matchedText.toLowerCase().includes(hitKeyword))).toBe(true);
  });
});
