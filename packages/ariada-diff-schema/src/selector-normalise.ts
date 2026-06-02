// SPDX-License-Identifier: EUPL-1.2
//
// Selector normalisation rules (differential CI gate spec).
//
// The DOM selector is the most volatile component of an accessibility
// finding. This module strips auto-generated IDs and framework-injected
// class hashes, generalises deep nth-child indices, lowercases the result,
// and collapses whitespace between combinators. The output is deterministic
// across implementations — any independent re-implementation of these rules
// MUST produce byte-identical normalised selectors for identical inputs.

/** Configuration knobs for selector normalisation. */
export interface SelectorNormaliseOptions {
  /** Beyond this depth, `nth-child(N)` is rewritten to `nth-child(*)`. */
  selectorDepth?: number;
  /** When true, strip additional ID patterns (per-org override). */
  strictIdRegex?: boolean;
}

const DEFAULT_OPTIONS: Required<SelectorNormaliseOptions> = {
  selectorDepth: 4,
  strictIdRegex: false,
};

const AUTO_ID_PATTERNS: ReadonlyArray<RegExp> = [
  /^#(input|button|el|comp|gen)-[a-f0-9]{4,}$/i,
  /^#[a-z]+-[a-f0-9]{6,}$/i,
];

const STRICT_ID_PATTERNS: ReadonlyArray<RegExp> = [
  /^#[a-z]+_[a-f0-9]{4,}$/i,
  /^#[a-z0-9]{8,}$/i,
];

const FRAMEWORK_CLASS_PATTERN =
  /^(css|sc|styled|chakra|mui|emotion|tw)-[a-z0-9]{6,}$/i;

const NTH_CHILD_PATTERN = /:nth-child\(([0-9]+)\)/g;

/**
 * Collapse whitespace around CSS combinators (>, +, ~) and normalise runs of
 * whitespace (descendant combinator) to a single space.
 *
 * Replaces three separate "whitespace-star X whitespace-star" patterns that
 * are O(n²) on long runs of whitespace because the quantifier must backtrack
 * exhaustively when the combinator character is absent
 * (polynomial ReDoS — CodeQL js/polynomial-redos). This implementation scans
 * the string exactly once, so it is O(n) regardless of whitespace length.
 *
 * Output contract (identical to the previous three-replace chain):
 *   • Each symbolic combinator (> + ~) is surrounded by exactly one space.
 *   • Consecutive whitespace collapses to a single space.
 *   • Leading and trailing whitespace is stripped.
 */
function collapseWhitespaceAroundCombinators(s: string): string {
  // Single O(n) scan that normalises whitespace around CSS combinators.
  //
  // Strategy: build the result as an array of single characters / combinator
  // tokens and track whether the last-emitted logical token was a combinator
  // (so we can suppress the leading space after it) or a regular character
  // (so we know to insert a space before the next combinator).
  //
  // State machine with three states:
  //   'start'      — at the very beginning or after leading whitespace
  //   'char'       — last emitted a non-ws, non-combinator character
  //   'combinator' — last emitted a combinator token (' > ', ' + ', ' ~ ')
  //   'space'      — accumulated whitespace after a char (not yet emitted)
  type State = 'start' | 'char' | 'space' | 'combinator';
  const parts: string[] = [];
  let state: State = 'start';

  for (let i = 0; i < s.length; i++) {
    // charAt always returns a string ('' if out of bounds, never undefined),
    // satisfying noUncheckedIndexedAccess without a non-null assertion.
    const ch = s.charAt(i);
    const isWs = ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f';
    const isComb = ch === '>' || ch === '+' || ch === '~';

    if (isWs) {
      if (state === 'char') {
        // Record that whitespace followed a character; don't emit yet.
        state = 'space';
      }
      // In 'start', 'space', 'combinator' — absorb silently.
    } else if (isComb) {
      // Emit the canonical ' X ' form. The leading space separates the
      // combinator from the preceding compound selector. When the previous
      // token was itself a combinator (adjacent combinators like `>>` or
      // `>+~`, which are invalid CSS but must still normalise deterministically)
      // its trailing space is already present, so we drop the leading space
      // here to avoid emitting a double space — matching the prior
      // implementation, whose final `\s+ -> ' '` squeeze collapsed it.
      // At 'start' the leading space is trimmed away by `.trim()` at the end.
      parts.push(state === 'combinator' ? `${ch} ` : ` ${ch} `);
      state = 'combinator';
    } else {
      // Regular character. If state is 'space', emit a single space first
      // (the descendant-combinator space between two compound selectors).
      // If state is 'combinator', the space is already in the combinator token.
      if (state === 'space') {
        parts.push(' ');
      }
      parts.push(ch);
      state = 'char';
    }
  }

  return parts.join('').trim();
}

/**
 * Normalise a single selector string per the differential CI gate spec.
 *
 * Steps applied in order:
 *   1. Strip auto-generated IDs.
 *   2. Strip framework-injected class hashes.
 *   3. Generalise deep nth-child indices.
 *   4. Lowercase all selector components.
 *   5. Collapse whitespace between combinators.
 *
 * Stable hand-written IDs / classes and ARIA attribute predicates are
 * preserved verbatim (lower-cased).
 */
export function normaliseSelector(
  selector: string,
  options?: SelectorNormaliseOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  // Step 5 — lowercase (early, so subsequent regex checks are case-insensitive)
  let s = selector.toLowerCase();

  // Step 5b — collapse whitespace around combinators (>, +, ~) and around
  // multi-space sequences.
  //
  // The naive patterns /\s*>\s*/g etc. are O(n²) on long runs of whitespace
  // because each position tries \s* before the non-space anchor (ReDoS). We
  // replace them with a single linear scan that emits tokens and then joins
  // with correct spacing. This is O(n) regardless of whitespace length.
  s = collapseWhitespaceAroundCombinators(s);

  // Step 3 — generalise nth-child below configurable depth. The depth check
  // is approximated by counting the number of combinator-run boundaries
  // (sequences of spaces, >, +, ~) preceding the nth-child occurrence.
  //
  // The previous implementation used `prefix.match(/[ >+~]+/g)` on a growing
  // prefix inside a replace callback, which is O(n²) on long inputs (ReDoS
  // risk — CodeQL js/polynomial-redos). Replaced with a single linear scan
  // that counts run-starts in one O(n) pass over the prefix characters.
  s = s.replace(NTH_CHILD_PATTERN, (match, _capturedIndex, offset: number) => {
    const prefix = s.slice(0, offset);
    // Count the number of combinator runs (a run is a maximal sequence of
    // characters from the set { ' ', '>', '+', '~' }). Each run separates two
    // compound selectors. A single scan avoids any backtracking.
    let depth = 1; // start at 1 — the element before the first combinator
    let inRun = false;
    for (let ci = 0; ci < prefix.length; ci++) {
      const ch = prefix[ci];
      const isCombinator = ch === ' ' || ch === '>' || ch === '+' || ch === '~';
      if (isCombinator) {
        if (!inRun) {
          depth++;
          inRun = true;
        }
      } else {
        inRun = false;
      }
    }
    if (depth > opts.selectorDepth) {
      return ':nth-child(*)';
    }
    return match;
  });

  // Re-tokenise into compound selectors and process each one.
  const parts = s.split(/(\s+>\s+|\s+\+\s+|\s+~\s+|\s+)/);
  const out: string[] = [];
  for (const part of parts) {
    if (/^[\s>+~]/.test(part)) {
      out.push(part);
      continue;
    }
    out.push(normaliseCompound(part, opts));
  }
  return out.join('');
}

function matchesAnyPattern(tok: string, patterns: ReadonlyArray<RegExp>): boolean {
  for (const p of patterns) {
    if (p.test(tok)) return true;
  }
  return false;
}

function normaliseIdToken(
  tok: string,
  opts: Required<SelectorNormaliseOptions>,
): string {
  if (matchesAnyPattern(tok, AUTO_ID_PATTERNS)) return '*';
  if (opts.strictIdRegex && matchesAnyPattern(tok, STRICT_ID_PATTERNS)) return '*';
  return tok;
}

function normaliseClassToken(tok: string): string | null {
  const cls = tok.slice(1);
  if (FRAMEWORK_CLASS_PATTERN.test(cls)) return null; // drop
  return tok;
}

function normaliseToken(
  tok: string,
  opts: Required<SelectorNormaliseOptions>,
): string | null {
  if (tok.startsWith('#')) return normaliseIdToken(tok, opts);
  if (tok.startsWith('.')) return normaliseClassToken(tok);
  return tok;
}

function normaliseCompound(
  compound: string,
  opts: Required<SelectorNormaliseOptions>,
): string {
  if (compound.length === 0) return compound;

  // Split a compound selector into tokens: tag, #id, .class, [attr], :pseudo
  const tokenPattern = /([#.][a-z0-9_-]+|\[[^\]]+\]|:[a-z-]+(\([^)]*\))?|[a-z0-9*-]+)/g;
  const matches = compound.match(tokenPattern);
  if (!matches) return compound;

  const tokens: string[] = [];
  for (const tok of matches) {
    const out = normaliseToken(tok, opts);
    if (out !== null) tokens.push(out);
  }
  return tokens.join('');
}
