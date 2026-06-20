// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Recursive Language Model (RLM) evaluator — an inference strategy (not a new
 * model) that decomposes large content into snippets, evaluates each through
 * an injected leaf SemanticEvaluator, remaps snippet-local line numbers back
 * to document-global lines, and aggregates + dedupes findings by fingerprint.
 *
 * Technique: Zhang, Kraska, Khattab, MIT CSAIL, arXiv:2512.24601 (Oct 2025).
 * Mapped onto the content-policy seam: the deterministic chunker acts as the
 * "tool environment" the root evaluator uses to examine the input; the leaf is
 * the sub-evaluator invoked over each snippet (a host-supplied evaluator for
 * internal use, a managed-API adapter for client runtime). The engine itself is
 * pure, zero-dependency, and network-free — the model lives entirely behind
 * the leaf.
 */

import { contentFingerprint } from './evaluate.js';
import type { RulePack, SemanticEvaluator, SemanticHit, SemanticRequest } from './types.js';

// ---------------------------------------------------------------------------
// Phase 2 — prefilter factory
// ---------------------------------------------------------------------------

/**
 * Builds a prefilter function from one or more rule-packs.
 *
 * The returned function returns `true` (snippet is worth evaluating) when at
 * least one pattern from any of the supplied rule-packs matches the snippet
 * text, and `false` otherwise (skip — no candidate signal detected).
 *
 * This implements the RLM "examine cheaply, recurse selectively" step using
 * the deterministic regex tier as the cheap examiner. Rules that have only a
 * `prompt` and no `patterns` contribute nothing to the prefilter (they have
 * no regex proxy) and are silently skipped.
 *
 * Pass this function as the `prefilter` option to
 * {@link createRecursiveEvaluator}. If your prompt has no regex proxy
 * (entirely open-ended), omit the prefilter or set `disablePrefilter: true`
 * per evaluate call so every snippet reaches the leaf.
 *
 * @example
 * ```ts
 * import { noSecretsPack } from '@ariada-org/content-policy';
 * const prefilter = createRulePackPrefilter([noSecretsPack]);
 * const rle = createRecursiveEvaluator({ leaf, prefilter });
 * ```
 */
export function createRulePackPrefilter(packs: RulePack[]): (snippetText: string) => boolean {
  // Compile all patterns from all packs into one array of RegExp objects.
  // Rules with no patterns (prompt-only) contribute nothing.
  const regexes: RegExp[] = [];

  for (const pack of packs) {
    for (const rule of pack.rules) {
      for (const src of rule.patterns) {
        try {
          regexes.push(new RegExp(src, 'i'));
        } catch {
          // Malformed pattern — skip silently, consistent with matchPattern in evaluate.ts.
        }
      }
    }
  }

  if (regexes.length === 0) {
    // No patterns available — prefilter cannot signal anything; always return false.
    return () => false;
  }

  return (snippetText: string): boolean => regexes.some((re) => re.test(snippetText));
}

// ---------------------------------------------------------------------------
// Phase 2 — per-call evaluate options
// ---------------------------------------------------------------------------

/**
 * Optional per-call overrides for {@link RecursiveEvaluator.evaluate} and
 * {@link RecursiveEvaluator.evaluateWithBudget}.
 *
 * Currently the only option is `disablePrefilter` — some prompts have no
 * regex proxy (entirely open-ended) so every snippet must reach the leaf.
 * Pass `{ disablePrefilter: true }` to override the prefilter configured at
 * construction time for a single call without creating a new evaluator.
 */
export interface EvaluateOptions {
  /**
   * When `true`, the prefilter configured in {@link RecursiveEvaluatorOptions}
   * is bypassed for this call and every snippet is sent to the leaf.
   * Has no effect when no prefilter was configured.
   */
  disablePrefilter?: boolean;
}

// ---------------------------------------------------------------------------
// Public options type
// ---------------------------------------------------------------------------

/**
 * Configuration for a recursive evaluator.
 *
 * - `leaf` — the sub-evaluator invoked over each snippet.
 * - `chunk` — optional custom chunker; receives the full content and the
 *   effective `maxLeafChars`, returns an array of snippet descriptors
 *   (`{ text, lineOffset }` where `lineOffset` is the 0-based index of the
 *   first line of the snippet within the original document).
 * - `prefilter` — optional guard; receives the raw snippet text, returns
 *   `true` if the snippet is worth evaluating, `false` to skip. Used to
 *   implement the RLM "examine cheaply, recurse selectively" step via
 *   deterministic rule-pack pattern matching.
 * - `maxLeafChars` — character budget per snippet (default 2000). Structural
 *   block boundaries are preferred split points; chunks are capped here.
 * - `maxDepth` — maximum recursion depth (default 1; P2 tree-recursion uses
 *   higher values).
 * - `maxLeafCalls` — hard cap on how many times the leaf may be invoked per
 *   evaluate call. When the budget is exhausted the un-evaluated remainder is
 *   returned in `evaluateWithBudget`'s `unevaluatedContent` and surfaced in
 *   the ContentGateDecision's `unevaluated` list so a partial pass is never
 *   silently clean.
 */
export interface RecursiveEvaluatorOptions {
  leaf: SemanticEvaluator;
  chunk?: (content: string, maxLeafChars: number) => Array<{ text: string; lineOffset: number }>;
  prefilter?: (snippetText: string) => boolean;
  maxLeafChars?: number;
  maxDepth?: number;
  maxLeafCalls?: number;
}

// ---------------------------------------------------------------------------
// Observability metrics
// ---------------------------------------------------------------------------

/**
 * Observability summary emitted by each `evaluateWithBudget` call.
 * Intended for host-side logging — e.g. a `🔁 RLM: N chunks, M calls` marker.
 * The engine only produces these numbers; printing or transmitting them is the
 * host's responsibility (never done inside this pure package).
 */
export interface RlmMetrics {
  /** Total number of snippets produced by the chunker. */
  chunks: number;
  /** Number of times the leaf evaluator was actually invoked. */
  leafCalls: number;
  /** Number of snippets skipped by the prefilter (no candidate signal). */
  prefilterSkipped: number;
  /** Whether the recursion reached the maximum allowed depth (always false at
   *  P0 depth=1; reserved for the P2 tree-recursion extension). */
  maxDepthReached: boolean;
  /** Number of distinct findings returned after deduplication. */
  findings: number;
  /** The length (in characters) of the content that was not evaluated due to
   *  leaf-call budget exhaustion. Zero when the whole document was covered. */
  unevaluatedRemainder: number;
}

// ---------------------------------------------------------------------------
// Extended result for budget-aware calls
// ---------------------------------------------------------------------------

/**
 * Result from {@link RecursiveEvaluator.evaluateWithBudget}. Carries the
 * collected hits, observability metrics, and — when the leaf-call budget was
 * exhausted — the portion of content that was not evaluated.
 *
 * A caller that uses `evaluate` (the plain SemanticEvaluator interface) gets
 * only the collected hits; the unevaluated remainder is surfaced to the host
 * via an `UnevaluatedRule` record in `evaluateContentAsync`'s result.
 */
export interface RecursiveEvaluationResult {
  hits: SemanticHit[];
  /** The portion of the original content that was not evaluated due to the
   *  leaf-call budget being exhausted. Empty string when the full document was
   *  evaluated. */
  unevaluatedContent: string;
  /** Observability metrics for this evaluation run. */
  metrics: RlmMetrics;
}

// ---------------------------------------------------------------------------
// The returned evaluator type (superset of SemanticEvaluator)
// ---------------------------------------------------------------------------

/**
 * A SemanticEvaluator that additionally exposes `evaluateWithBudget` for
 * callers that need to know about partial evaluation and observability metrics.
 *
 * Both `evaluate` and `evaluateWithBudget` accept an optional
 * {@link EvaluateOptions} second argument for per-call overrides (e.g.
 * `{ disablePrefilter: true }` when the prompt has no regex proxy).
 */
export interface RecursiveEvaluator extends SemanticEvaluator {
  /** Like `evaluate` but also returns un-evaluated content and metrics when the
   *  leaf-call budget is exhausted.
   * @param req — the content and rule to evaluate.
   * @param options — optional per-call overrides (e.g. disable prefilter).
   */
  evaluateWithBudget(req: SemanticRequest, options?: EvaluateOptions): Promise<RecursiveEvaluationResult>;

  /**
   * Evaluate content against a rule. Overrides the base SemanticEvaluator
   * signature to add per-call options.
   * @param req — the content and rule to evaluate.
   * @param options — optional per-call overrides (e.g. disable prefilter).
   */
  evaluate(req: SemanticRequest, options?: EvaluateOptions): Promise<SemanticHit[]>;
}

// ---------------------------------------------------------------------------
// Chunker helpers (split out to keep cognitive complexity below the 25 limit)
// ---------------------------------------------------------------------------

/** A block is a run of non-blank lines with its 0-based start-line in the doc. */
interface Block {
  startLine: number;
  lines: string[];
}

/** Split content at blank lines into structural blocks. */
function extractBlocks(allLines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: string[] = [];
  let currentStart = 0;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i] ?? '';
    if (line.trim() === '') {
      if (current.length > 0) {
        blocks.push({ startLine: currentStart, lines: current });
        current = [];
      }
      currentStart = i + 1;
    } else {
      if (current.length === 0) currentStart = i;
      current.push(line);
    }
  }
  if (current.length > 0) {
    blocks.push({ startLine: currentStart, lines: current });
  }
  return blocks;
}

/** Split a block that is larger than maxLeafChars into line-batched sub-snippets. */
function splitOversizedBlock(
  block: Block,
  maxLeafChars: number,
  flush: (lines: string[], start: number) => void,
): void {
  let subLines: string[] = [];
  let subStart = block.startLine;
  for (let i = 0; i < block.lines.length; i++) {
    subLines.push(block.lines[i] ?? '');
    if (subLines.join('\n').length >= maxLeafChars) {
      flush(subLines, subStart);
      subLines = [];
      subStart = block.startLine + i + 1;
    }
  }
  if (subLines.length > 0) {
    flush(subLines, subStart);
  }
}

/** Merge blocks into snippets that fit within maxLeafChars. */
function mergeBlocksIntoSnippets(
  blocks: Block[],
  maxLeafChars: number,
): Array<{ text: string; lineOffset: number }> {
  const snippets: Array<{ text: string; lineOffset: number }> = [];
  let pendingLines: string[] = [];
  let pendingStart = 0;

  const flush = (linesToFlush: string[], startLine: number): void => {
    if (linesToFlush.length === 0) return;
    snippets.push({ text: linesToFlush.join('\n'), lineOffset: startLine });
  };

  for (const block of blocks) {
    const blockText = block.lines.join('\n');

    if (blockText.length > maxLeafChars) {
      if (pendingLines.length > 0) {
        flush(pendingLines, pendingStart);
        pendingLines = [];
      }
      splitOversizedBlock(block, maxLeafChars, flush);
      continue;
    }

    const combined = pendingLines.length === 0
      ? blockText
      : `${pendingLines.join('\n')}\n${blockText}`;

    if (pendingLines.length > 0 && combined.length > maxLeafChars) {
      flush(pendingLines, pendingStart);
      pendingLines = block.lines.slice();
      pendingStart = block.startLine;
    } else {
      if (pendingLines.length === 0) pendingStart = block.startLine;
      pendingLines.push(...block.lines);
    }
  }

  if (pendingLines.length > 0) {
    flush(pendingLines, pendingStart);
  }

  return snippets;
}

/** Add an overlap window so spans near chunk boundaries are captured. */
function addOverlap(
  snippets: Array<{ text: string; lineOffset: number }>,
  overlapLines: number,
): Array<{ text: string; lineOffset: number }> {
  if (snippets.length <= 1) return snippets;
  const result: Array<{ text: string; lineOffset: number }> = [snippets[0]!];

  for (let i = 1; i < snippets.length; i++) {
    const prev = snippets[i - 1]!;
    const cur = snippets[i]!;
    const prevLineArr = prev.text.split(/\r?\n/);
    const overlap = prevLineArr.slice(-overlapLines);
    const overlapOffset = prev.lineOffset + prevLineArr.length - overlap.length;
    result.push({
      text: `${overlap.join('\n')}\n${cur.text}`,
      lineOffset: overlapOffset,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Default chunker (assembles the helpers above)
// ---------------------------------------------------------------------------

/**
 * Split content into snippets at structural block boundaries (blank lines),
 * then enforce the `maxLeafChars` cap by further splitting oversized blocks.
 * Returns snippets with their `lineOffset` (0-based first-line index within
 * the original document) so hits can be remapped to global line numbers.
 *
 * An overlap window of two lines from the previous snippet is prepended to
 * each subsequent snippet so spans that straddle a boundary are captured.
 * Fingerprint deduplication in the aggregator collapses any double-counted
 * overlapping hits to a single finding.
 */
function defaultChunker(
  content: string,
  maxLeafChars: number,
): Array<{ text: string; lineOffset: number }> {
  const OVERLAP_LINES = 2;
  const allLines = content.split(/\r?\n/);

  let blocks = extractBlocks(allLines);
  if (blocks.length === 0) {
    blocks = [{ startLine: 0, lines: allLines }];
  }

  const snippets = mergeBlocksIntoSnippets(blocks, maxLeafChars);

  if (snippets.length === 0) {
    return [{ text: content, lineOffset: 0 }];
  }

  return addOverlap(snippets, OVERLAP_LINES);
}

// ---------------------------------------------------------------------------
// Fingerprint-based deduplication
// ---------------------------------------------------------------------------

function dedupeHits(ruleId: string, hits: SemanticHit[]): SemanticHit[] {
  const seen = new Set<string>();
  const deduped: SemanticHit[] = [];
  for (const hit of hits) {
    const fp = contentFingerprint(ruleId, hit.matchedText);
    if (!seen.has(fp)) {
      seen.add(fp);
      deduped.push(hit);
    }
  }
  return deduped;
}

// ---------------------------------------------------------------------------
// Internal shared budget state (Phase 3 tree recursion)
// ---------------------------------------------------------------------------

/**
 * Mutable budget state shared across all recursion levels for a single
 * top-level `evaluateWithBudget` call.  Passing it by reference lets
 * child recursive evaluators decrement the same counter and propagate
 * depth observations back to the root without needing a return-value
 * overhaul.
 *
 * `anyBudgetExhausted` is set to `true` the first time any level of the
 * recursion tree tries to invoke the leaf but finds `callsRemaining <= 0`.
 * The root-level `evaluateWithBudget` uses this flag to compute
 * `unevaluatedContent` when the budget exhaustion happened inside a child
 * call rather than at the root level.
 */
interface BudgetRef {
  callsRemaining: number;
  maxDepthReached: boolean;
  anyBudgetExhausted: boolean;
}

// ---------------------------------------------------------------------------
// Line-remapping helper (extracted to reduce cognitive complexity of runLevel)
// ---------------------------------------------------------------------------

/** Remap leaf hits from snippet-local lines to document-global lines. */
function remapHits(
  rawHits: SemanticHit[],
  globalLineBase: number,
): SemanticHit[] {
  return rawHits.map((hit) => {
    const remapped: SemanticHit = {
      matchedText: hit.matchedText,
      line: globalLineBase + hit.line,
    };
    if (hit.reason !== undefined) remapped.reason = hit.reason;
    return remapped;
  });
}

// ---------------------------------------------------------------------------
// Internal recursive worker (shared across depth levels)
// ---------------------------------------------------------------------------

/**
 * The inner implementation of the recursive evaluation loop.  The public
 * `createRecursiveEvaluator` wraps this so callers never see `depth` or
 * `budget`.
 *
 * At each depth level the worker:
 * 1. Chunks `content`.
 * 2. Applies the prefilter.
 * 3. For each surviving snippet:
 *    a. If the snippet still exceeds `maxLeafChars` AND `depth + 1 < maxDepth`,
 *       recurse into a child worker (tree recursion — P2).
 *    b. Otherwise, check the shared budget; if exhausted, record remainder.
 *    c. Otherwise, invoke the leaf and decrement the budget.
 * 4. Remap snippet-local line numbers to the offset within `content`.
 *
 * Returns raw (un-deduped) hits and the first index whose content was not
 * evaluated, so the caller can compute `unevaluatedContent`.
 */
async function runLevel(
  content: string,
  lineOffsetInDoc: number,
  rule: SemanticRequest['rule'],
  chunker: (c: string, max: number) => Array<{ text: string; lineOffset: number }>,
  leaf: SemanticEvaluator,
  effectivePrefilter: ((t: string) => boolean) | undefined,
  maxLeafChars: number,
  maxDepth: number,
  depth: number,
  budget: BudgetRef,
  prefilterSkippedRef: { count: number },
  unevaluatedSnippetRef: { start: number; snippets: Array<{ text: string; lineOffset: number }> },
): Promise<SemanticHit[]> {
  const snippets = chunker(content, maxLeafChars);

  // Capture the snippet array for unevaluated-remainder calculation at the
  // topmost level.  Child levels do not overwrite the root's reference —
  // the root is always the first to set it.
  if (unevaluatedSnippetRef.snippets.length === 0) {
    for (const s of snippets) unevaluatedSnippetRef.snippets.push(s);
  }

  const allHits: SemanticHit[] = [];

  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i]!;
    const globalLineBase = lineOffsetInDoc + snippet.lineOffset;

    // Prefilter check — skip snippets with no candidate signal.
    if (effectivePrefilter !== undefined && !effectivePrefilter(snippet.text)) {
      prefilterSkippedRef.count++;
      continue;
    }

    // P2 tree recursion: snippet is still oversized and depth allows it.
    // maxDepth=1 (flat mode) never recurses because 0 + 1 < 1 is false.
    if (snippet.text.length > maxLeafChars && depth + 1 < maxDepth) {
      const childHits = await runLevel(
        snippet.text,
        globalLineBase,
        rule,
        chunker,
        leaf,
        effectivePrefilter,
        maxLeafChars,
        maxDepth,
        depth + 1,
        budget,
        prefilterSkippedRef,
        { start: -1, snippets: [] },
      );
      allHits.push(...childHits);
      continue;
    }

    // P2 depth limit: record that tree recursion was blocked by the depth cap.
    // Only set for maxDepth > 1 (tree mode) — flat-mode (maxDepth=1) never
    // intends to recurse so the flag must stay false there.
    if (snippet.text.length > maxLeafChars && depth + 1 >= maxDepth && maxDepth > 1) {
      budget.maxDepthReached = true;
    }

    // Budget check: if exhausted, record the unevaluated start and signal.
    if (budget.callsRemaining <= 0) {
      budget.anyBudgetExhausted = true;
      if (unevaluatedSnippetRef.start === -1) unevaluatedSnippetRef.start = i;
      continue;
    }

    const rawHits = await leaf.evaluate({ content: snippet.text, rule });
    budget.callsRemaining--;
    allHits.push(...remapHits(rawHits, globalLineBase));
  }

  return allHits;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns a `RecursiveEvaluator` (a `SemanticEvaluator` with an extra
 * `evaluateWithBudget` method) that applies the RLM inference strategy:
 *
 * 1. Decompose `req.content` into snippets via the chunker.
 * 2. Optionally skip snippets with no candidate signal (prefilter).
 * 3. Invoke the `leaf` evaluator on each snippet within the call budget.
 * 4. Remap snippet-local line numbers to document-global lines.
 * 5. Aggregate + dedupe hits by `contentFingerprint(ruleId, matchedText)`.
 * 6. When the budget is exhausted, record un-evaluated content so a partial
 *    pass is never silently clean.
 * 7. Populate and return {@link RlmMetrics} for host-side observability.
 *
 * **Phase 3 tree recursion (P2):** when a snippet produced by the chunker
 * still exceeds `maxLeafChars` and `depth < maxDepth`, the evaluator recurses
 * into a child evaluation level on that snippet rather than passing the
 * over-sized snippet directly to the leaf. This matches the RLM paper's
 * recursive-self-call strategy. `metrics.maxDepthReached` is `true` when the
 * depth limit was hit during a run.
 *
 * The returned value IS a `SemanticEvaluator` (same interface), so it drops
 * into any existing call site of `evaluateContentAsync` without changes.
 * Budget exhaustion is communicated via `evaluateWithBudget` or through the
 * `unevaluated` field of `ContentGateDecision` when used with
 * `evaluateContentAsync`.
 */
export function createRecursiveEvaluator(opts: RecursiveEvaluatorOptions): RecursiveEvaluator {
  const {
    leaf,
    chunk: customChunk,
    prefilter,
    maxLeafChars = 2000,
    maxDepth = 1,
    maxLeafCalls = Infinity,
  } = opts;

  const chunker = customChunk ?? defaultChunker;

  async function evaluateWithBudget(req: SemanticRequest, options?: EvaluateOptions): Promise<RecursiveEvaluationResult> {
    const effectivePrefilter = options?.disablePrefilter === true ? undefined : prefilter;

    const budget: BudgetRef = {
      callsRemaining: maxLeafCalls,
      maxDepthReached: false,
      anyBudgetExhausted: false,
    };
    const prefilterSkippedRef = { count: 0 };
    const unevaluatedSnippetRef: { start: number; snippets: Array<{ text: string; lineOffset: number }> } = {
      start: -1,
      snippets: [],
    };

    const rawHits = await runLevel(
      req.content,
      0,
      req.rule,
      chunker,
      leaf,
      effectivePrefilter,
      maxLeafChars,
      maxDepth,
      0,
      budget,
      prefilterSkippedRef,
      unevaluatedSnippetRef,
    );

    const deduped = dedupeHits(req.rule.id, rawHits);

    // Root-level snippet list and prefilter count — populated during runLevel.
    const rootSnippets = unevaluatedSnippetRef.snippets;
    const prefilterSkipped = prefilterSkippedRef.count;

    // Compute unevaluatedContent from the root-level snippets.
    // When budget was exhausted inside a child recursive call (tree mode),
    // budget.anyBudgetExhausted is true even if unevaluatedSnippetRef.start
    // was never set at the root level.  In that case, fall back to the
    // conservative estimate: the portion of content not yet covered is from
    // the lineOffset of the last root snippet — we know at least that tail
    // was not fully evaluated.
    let unevaluatedContent = '';
    if (unevaluatedSnippetRef.start !== -1) {
      const lines = req.content.split(/\r?\n/);
      const firstUneval = unevaluatedSnippetRef.snippets[unevaluatedSnippetRef.start];
      if (firstUneval !== undefined) {
        unevaluatedContent = lines.slice(firstUneval.lineOffset).join('\n');
      }
    } else if (budget.anyBudgetExhausted && rootSnippets.length > 0) {
      // Budget was exhausted inside a child call.  Expose the tail of the document
      // to ensure a partial pass is never silently clean.
      const lines = req.content.split(/\r?\n/);
      const lastSnippet = rootSnippets[rootSnippets.length - 1];
      if (lastSnippet !== undefined && lastSnippet.lineOffset < lines.length) {
        unevaluatedContent = lines.slice(lastSnippet.lineOffset).join('\n');
      }
      // Fallback: guarantee non-empty when budget was exhausted.
      if (unevaluatedContent === '') {
        unevaluatedContent = ' ';
      }
    }

    // Leaf-calls-made: total snippets at the root minus those prefilter-skipped,
    // bounded by the original budget cap.
    const leafCallsMade = maxLeafCalls === Infinity
      ? rootSnippets.length - prefilterSkipped
      : Math.min(maxLeafCalls, rootSnippets.length - prefilterSkipped);

    const metrics: RlmMetrics = {
      chunks: rootSnippets.length,
      leafCalls: leafCallsMade,
      prefilterSkipped,
      maxDepthReached: budget.maxDepthReached,
      findings: deduped.length,
      unevaluatedRemainder: unevaluatedContent.length,
    };

    return { hits: deduped, unevaluatedContent, metrics };
  }

  const evaluator: RecursiveEvaluator = {
    async evaluate(req: SemanticRequest, options?: EvaluateOptions): Promise<SemanticHit[]> {
      const result = await evaluateWithBudget(req, options);
      return result.hits;
    },

    evaluateWithBudget,
  };

  return evaluator;
}

// ---------------------------------------------------------------------------
// Helper: wrap a RecursiveEvaluator for use with evaluateContentAsync so that
// budget exhaustion surfaces in the ContentGateDecision's `unevaluated` field.
// ---------------------------------------------------------------------------

interface BudgetState {
  unevaluatedContent: string;
  lastRule: { id: string; prompt: string } | undefined;
}

const budgetChannel = new WeakMap<SemanticEvaluator, BudgetState>();

/**
 * Wraps a `RecursiveEvaluator` so that budget exhaustion detected during
 * `evaluate()` is stashed in an in-process side channel. The wrapper is itself
 * a `SemanticEvaluator`, safe to pass to `evaluateContentAsync`. After the
 * evaluation, read the stash via `getBudgetExhaustion(wrapper)`.
 */
export function wrapForEvaluateContentAsync(rle: RecursiveEvaluator): SemanticEvaluator {
  const state: BudgetState = { unevaluatedContent: '', lastRule: undefined };
  const wrapper: SemanticEvaluator = {
    async evaluate(req: SemanticRequest): Promise<SemanticHit[]> {
      const result = await rle.evaluateWithBudget(req);
      if (result.unevaluatedContent.length > 0) {
        state.unevaluatedContent = result.unevaluatedContent;
        state.lastRule = req.rule;
      }
      return result.hits;
    },
  };
  budgetChannel.set(wrapper, state);
  return wrapper;
}

/**
 * Returns the budget-exhaustion state recorded by a wrapper produced by
 * `wrapForEvaluateContentAsync`, or `undefined` if the wrapper is unknown.
 */
export function getBudgetExhaustion(wrapper: SemanticEvaluator): BudgetState | undefined {
  return budgetChannel.get(wrapper);
}
