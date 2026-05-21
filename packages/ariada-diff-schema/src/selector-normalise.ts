// SPDX-License-Identifier: EUPL-1.2
//
// Selector normalisation rules (§3.2 of the differential CI gate spec).
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
 * Normalise a single selector string per §3.2.
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
  s = s.replace(/\s*>\s*/g, ' > ');
  s = s.replace(/\s*\+\s*/g, ' + ');
  s = s.replace(/\s*~\s*/g, ' ~ ');
  s = s.replace(/\s+/g, ' ').trim();

  // Step 3 — generalise nth-child below configurable depth. The depth check
  // is approximated by counting the number of compound-selector boundaries
  // (descendant combinators) preceding the nth-child occurrence.
  s = s.replace(NTH_CHILD_PATTERN, (match, idx, offset: number) => {
    const prefix = s.slice(0, offset);
    const depth = (prefix.match(/[ >+~]+/g) ?? []).length + 1;
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
