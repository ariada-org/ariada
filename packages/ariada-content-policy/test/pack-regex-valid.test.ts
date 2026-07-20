// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { builtinPacks } from '../src/index.js';

/**
 * Both the deterministic matcher (matchPattern in evaluate.ts) and the prefilter
 * factory (createRulePackPrefilter in recursive.ts) compile every rule pattern
 * with `new RegExp(...)` inside a try/catch that swallows a malformed pattern
 * silently. That runtime catch is deliberate — a single broken rule must not
 * crash the whole gate at scan time — but it also means a typo in a builtin
 * pack would make that rule stop matching with no signal. In the org's own
 * leak-prevention engine, a rule that silently never fires is exactly the
 * false-clean failure this suite exists to prevent.
 *
 * So the catch stays for runtime resilience, and this build-time test proves
 * every shipped builtin pattern actually compiles. If someone adds a malformed
 * pattern, CI fails here instead of the leak slipping through in production.
 */
describe('builtin rule-pack patterns compile', () => {
  it('exposes at least one builtin pack with rules and patterns', () => {
    expect(builtinPacks.length).toBeGreaterThan(0);
    const totalPatterns = builtinPacks
      .flatMap((pack) => pack.rules)
      .flatMap((rule) => rule.patterns).length;
    expect(totalPatterns).toBeGreaterThan(0);
  });

  for (const pack of builtinPacks) {
    for (const rule of pack.rules) {
      for (const [index, src] of rule.patterns.entries()) {
        it(`${pack.id}:${rule.id} pattern[${index}] is a valid RegExp`, () => {
          // Same flags the runtime uses (matchPattern → 'gi', prefilter → 'i');
          // if either construction throws, the rule would silently stop matching.
          expect(() => new RegExp(src, 'gi')).not.toThrow();
          expect(() => new RegExp(src, 'i')).not.toThrow();
        });
      }
    }
  }
});
