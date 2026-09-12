// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What this package is, and the one property worth more than the rest.
//
// It adapts our rule definitions into the shape axe-core's `configure` accepts.
// Nothing here decides anything about a page; it is a translation, and a
// translation is held by whether everything crossed and whether what crossed is
// still connected.
//
// The connection is the part that matters. A rule names its checks by
// identifier, and axe does not complain about a rule whose check is missing —
// it simply never runs it. The scan then finishes, reports nothing, and looks
// exactly like a page with no accessibility problems. That is the failure this
// whole product exists to prevent, arriving through its own ruleset, so the
// reference from every rule to a check that actually exists is asserted first
// and separately.
//
// The last case hands the payload to real axe-core rather than to our own idea
// of it. A shape we believe is right and axe rejects is not a working ruleset,
// and no amount of checking our own adaptation would say so.

import { allChecks, allRules } from '@ariada-org/wcag-rules-extended';
import { describe, expect, it } from 'vitest';

import {
  ariadaAxeRuleset,
  checks,
  registerAriadaRules,
  rules,
  type AxeConfigurable,
} from '../src/index.js';

describe('everything crosses', () => {
  it('adapts every rule and every check, losing none', () => {
    expect(rules).toHaveLength(allRules.length);
    expect(checks).toHaveLength(allChecks.length);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('keeps the identifiers it was given, and adds none of its own', () => {
    expect(new Set(rules.map((r) => r.id))).toEqual(new Set(allRules.map((r) => r.id)));
    expect(new Set(checks.map((c) => c.id))).toEqual(new Set(allChecks.map((c) => c.id)));
  });

  it('offers the payload as the same two collections, not copies of them', () => {
    expect(ariadaAxeRuleset.rules).toBe(rules);
    expect(ariadaAxeRuleset.checks).toBe(checks);
  });
});

describe('every rule still reaches its checks', () => {
  // Asserted before anything else about shape, because axe does not object to a
  // rule whose check is absent — it declines to run it, the scan reports
  // nothing, and nothing distinguishes that from a clean page.
  const izvestnye = new Set(checks.map((c) => c.id));

  it('names a check for every rule, in at least one of the three lists', () => {
    const pustye = rules.filter(
      (r) => (r.any?.length ?? 0) + (r.all?.length ?? 0) + (r.none?.length ?? 0) === 0,
    );
    expect(pustye.map((r) => r.id)).toEqual([]);
  });

  it.each(['any', 'all', 'none'] as const)(
    'resolves every check named in %s to a check that exists',
    (spisok) => {
      const propavshie: string[] = [];
      for (const rule of rules) {
        for (const id of rule[spisok] ?? []) {
          if (typeof id === 'string' && !izvestnye.has(id)) {
            propavshie.push(`${rule.id} → ${id}`);
          }
        }
      }
      expect(propavshie).toEqual([]);
    },
  );

  it('gives every check something to run', () => {
    const bez_tela = checks.filter((c) => typeof c.evaluate !== 'function' && c.evaluate === undefined);
    expect(bez_tela.map((c) => c.id)).toEqual([]);
  });
});

describe('the adaptation does not share state with its source', () => {
  // Every list, not a sample of them. The first version of this case named two
  // of the four, and a removal check that shared the third one stayed green —
  // which is the only way that omission would ever have been noticed.
  it.each(['any', 'all', 'none', 'tags'] as const)(
    'copies %s rather than handing over the original array',
    (pole) => {
      // Two collections that look identical and are the same array behave
      // identically until one of them is edited, and then the source of the
      // edit is the last place anyone looks.
      const razdelennye: string[] = [];
      for (const rule of rules) {
        const source = allRules.find((r) => r.id === rule.id);
        if (source !== undefined && rule[pole] === source[pole]) razdelennye.push(rule.id);
      }
      expect(razdelennye).toEqual([]);
    },
  );
});

describe('optional parts are absent rather than present and undefined', () => {
  it('omits matches on rules that do not define one', () => {
    // The distinction is invisible in the types and decisive to axe, which
    // reads the property and would be handed undefined where it expects a
    // function.
    const bez_matches = allRules.filter((r) => r.matches === undefined).map((r) => r.id);
    const adaptirovannye = rules.filter((r) => bez_matches.includes(r.id));
    expect(adaptirovannye.length).toBeGreaterThan(0);
    for (const r of adaptirovannye) expect(Object.hasOwn(r, 'matches')).toBe(false);
  });

  it('omits metadata on checks that carry none', () => {
    const bez_metadannyh = allChecks.filter((c) => c.metadata === undefined).map((c) => c.id);
    for (const id of bez_metadannyh) {
      const adapted = checks.find((c) => c.id === id);
      expect(adapted && Object.hasOwn(adapted, 'metadata')).toBe(false);
    }
  });
});

describe('registering on an axe instance', () => {
  it('hands over the payload itself, unaltered', () => {
    const peredano: unknown[] = [];
    const poddelnyy: AxeConfigurable = { configure: (spec) => void peredano.push(spec) };
    registerAriadaRules(poddelnyy);
    expect(peredano).toEqual([ariadaAxeRuleset]);
    expect(peredano[0]).toBe(ariadaAxeRuleset);
  });

  it('is accepted by real axe-core', async () => {
    // The end of the line, and the only case here that can fail for a reason we
    // did not think of. Everything above checks our adaptation against our own
    // expectations; this checks it against the thing that has to accept it.
    const axe = (await import('axe-core')).default;
    expect(() => registerAriadaRules(axe)).not.toThrow();
    // Leave the shared instance as it was found: axe.configure mutates a
    // module-level registry, and a later suite in the same process would
    // otherwise inherit our rules.
    axe.reset();
  });
});
