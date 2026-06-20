// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Brand-logo SVG sanitiser.
//
// Customers supply inline SVG (Scalable Vector Graphics) strings for cover-
// page branding. We strip:
//   1. <script> elements (entire subtree)
//   2. event-handler attributes (on*=...)
//   3. javascript: / data: URLs in href / xlink:href / src attributes
//   4. <foreignObject> (allows arbitrary HTML embedding)
//
// This is conservative — we do NOT pull in DOMPurify or a full SAX parser.
// Customers wanting richer SVG should pre-sanitise themselves and accept
// the responsibility.

// Patterns for full closed elements (both paired and self-closing forms).
// The end-tag allows optional whitespace before `>` (`</script >`,
// `</foreignObject\n>`) — HTML treats those as valid end tags, so the regex
// must too, otherwise the opener is stripped but the inner body survives as
// text (CodeQL js/bad-tag-filter).
const SCRIPT_ELEMENT_RE = /<script\b[\s\S]*?<\/script\s*>/gi;
const SCRIPT_SELF_CLOSING_RE = /<script\b[^>]*\/>/gi;
const FOREIGN_OBJECT_RE = /<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi;
const FOREIGN_OBJECT_SELF_CLOSING_RE = /<foreignObject\b[^>]*\/>/gi;
// Dangling openers: a <script or <foreignObject tag that was never closed —
// these are left behind after the paired-element patterns remove inner content,
// reconstructing an opener from surrounding text. Stripping them prevents the
// bad-tag-filter bypass (CodeQL js/bad-tag-filter).
const SCRIPT_OPENER_RE = /<script\b[^>]*/gi;
const FOREIGN_OPENER_RE = /<foreignObject\b[^>]*/gi;
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URL_RE =
  /\s+(?:href|xlink:href|src)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*')/gi;

/**
 * Strip every match of `re` from `s`, repeating until the string stops
 * changing. Removing one match can splice surrounding text into a fresh match
 * (the incomplete-multi-character-sanitization bypass), so a single pass is
 * not enough — the loop runs to a fixed point at the replacement site itself.
 * Each iteration only deletes text, so the string shrinks monotonically and
 * the loop always terminates.
 */
function stripUntilStable(s: string, re: RegExp): string {
  let previous: string;
  do {
    previous = s;
    s = s.replace(re, '');
  } while (s !== previous);
  return s;
}

/**
 * Apply one full pass of all strip patterns and return the result. Each
 * pattern is itself driven to a fixed point via {@link stripUntilStable}.
 */
function applyStrips(s: string): string {
  let out = s;
  out = stripUntilStable(out, SCRIPT_ELEMENT_RE);
  out = stripUntilStable(out, SCRIPT_SELF_CLOSING_RE);
  out = stripUntilStable(out, FOREIGN_OBJECT_RE);
  out = stripUntilStable(out, FOREIGN_OBJECT_SELF_CLOSING_RE);
  // After the closed-element patterns, strip any surviving dangling openers
  // (the bad-tag-filter bypass — e.g. a `<script` that was reassembled when
  // the inner `<script>...</script>` was removed from a nested string).
  out = stripUntilStable(out, SCRIPT_OPENER_RE);
  out = stripUntilStable(out, FOREIGN_OPENER_RE);
  out = stripUntilStable(out, EVENT_HANDLER_RE);
  out = stripUntilStable(out, DANGEROUS_URL_RE);
  return out;
}

/**
 * Maximum number of fixed-point iterations before giving up.
 * A clean SVG converges in 1 pass; a pathological reconstruction chain should
 * converge in 2-3. If it hasn't after MAX_ITERATIONS the input is adversarial —
 * we fail closed and return an empty string.
 */
const MAX_STRIP_ITERATIONS = 32;

/**
 * Sanitise an inline SVG string. Returns the sanitised SVG, or an empty
 * string if the input does not look like an SVG document.
 *
 * Each strip pattern is applied in a fixed-point loop: the full set of
 * replacements is repeated until the string stops changing (or the iteration
 * cap is reached, in which case the function fails closed with ''). This
 * eliminates the incomplete-multi-character-sanitization bypass where a single
 * pass leaves behind a reconstructed attack vector.
 */
export function sanitiseSvg(svg: string | undefined): string {
  if (svg === undefined || svg === null || svg === '') {
    return '';
  }
  const trimmed = String(svg).trim();
  if (!/^<svg\b/i.test(trimmed)) {
    // Not an SVG root — refuse rather than risk embedding arbitrary markup.
    return '';
  }

  let current = trimmed;
  for (let i = 0; i < MAX_STRIP_ITERATIONS; i++) {
    const next = applyStrips(current);
    if (next === current) {
      // Fixed point reached — no further changes possible.
      return current;
    }
    current = next;
  }

  // Iteration cap reached — the input is adversarially constructed such that
  // strip patterns keep producing new attack vectors. Fail closed.
  return '';
}

/**
 * Validate a CSS colour literal. Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`,
 * `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, and a small allowlist
 * of CSS named colours. Returns the validated colour, or `undefined` if
 * the input is unsafe (contains `;`, `{`, `}`, `<`, `>`, or `url(`).
 */
export function sanitiseColor(color: string | undefined): string | undefined {
  if (color === undefined || color === null || color === '') {
    return undefined;
  }
  const candidate = String(color).trim();
  if (/[<>{};]/.test(candidate) || /url\s*\(/i.test(candidate)) {
    return undefined;
  }
  // Hex
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate)) {
    return candidate;
  }
  // rgb/rgba/hsl/hsla functional notation
  if (/^(?:rgb|rgba|hsl|hsla)\s*\([0-9,.\s%/-]+\)$/i.test(candidate)) {
    return candidate;
  }
  // Tiny named-colour allowlist (extend as needed)
  const NAMED = new Set([
    'black',
    'white',
    'red',
    'green',
    'blue',
    'gray',
    'grey',
    'navy',
    'teal',
    'orange',
    'purple',
    'maroon',
    'olive',
    'silver',
    'lime',
    'aqua',
    'fuchsia',
    'yellow',
    'transparent',
    'currentcolor',
  ]);
  if (NAMED.has(candidate.toLowerCase())) {
    return candidate;
  }
  return undefined;
}
