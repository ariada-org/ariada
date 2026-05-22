// SPDX-License-Identifier: EUPL-1.2
//
// Minimal glob matcher for path-override resolution. Supports the common
// subset of glob syntax that the policy schema needs:
//
//   *    — match any sequence of non-`/` characters
//   **   — match any sequence of characters (including `/`)
//   ?    — match any single non-`/` character
//
// Zero runtime dependencies. Deterministic across implementations.

/**
 * Compile a glob pattern to a RegExp anchored at both ends.
 */
function globToRegex(pattern: string): RegExp {
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // ** — match across `/`
        re += '.*';
        i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '.' || c === '+' || c === '(' || c === ')' || c === '|' || c === '^' || c === '$' || c === '{' || c === '}' || c === '[' || c === ']' || c === '\\') {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  re += '$';
  return new RegExp(re);
}

/**
 * Match a single path against a glob pattern.
 */
export function matchesGlob(path: string, pattern: string): boolean {
  return globToRegex(pattern).test(path);
}

/**
 * Match a path against an array of glob patterns. Returns true if any matches.
 */
export function matchesAnyGlob(path: string, patterns: readonly string[]): boolean {
  for (const p of patterns) {
    if (matchesGlob(path, p)) return true;
  }
  return false;
}

/**
 * Return the LONGEST matching glob from a list, or null if none match. Used
 * by hierarchical policy resolution where the most-specific override wins
 * (path-wins-over-jurisdiction resolution rule).
 */
export function longestMatchingGlob(
  path: string,
  patterns: readonly string[],
): string | null {
  let best: string | null = null;
  for (const p of patterns) {
    if (matchesGlob(path, p) && (best === null || p.length > best.length)) {
      best = p;
    }
  }
  return best;
}
