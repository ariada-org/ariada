// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// This adapter talks to a browser through Selenium, and every part of that
// conversation is injectable — the CDP session, the axe source, the command-line
// scanner it falls back to. So the whole of it can be exercised without a
// browser, and what is left needing one is the browser itself.
//
// Two things get more attention than the rest.
//
// The shape of what comes back from `Runtime.evaluate` is not one shape. The
// value arrives wrapped in a `result` once, sometimes twice, sometimes with a
// `value` inside that, depending on the driver and the transport. The unwrapping
// is written for all of those and tested against all of them, because the
// failure when it guesses wrong is not an error: it is an empty list of
// violations, which reads exactly like a page with nothing wrong.
//
// And an impact the adapter does not recognise is ranked as moderate rather
// than dropped. That is a decision, not an oversight — a finding whose severity
// we cannot read still counts against the threshold, because the alternative is
// that an unfamiliar word makes a violation disappear.

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AriadaPolicyError,
  AriadaScanError,
  ariadaScan,
  runAriadaScan,
} from '../src/index.js';
import type { CdpSessionLike, WebDriverLike } from '../src/types.js';

type Zapis = Record<string, unknown>;

/** A CDP session that answers each method from a table and records the calls. */
function sessiya(otvety: Record<string, unknown> = {}) {
  const zvonki: { method: string; params?: Zapis }[] = [];
  const cdp: CdpSessionLike = {
    send: async (method, params) => {
      zvonki.push({ method, ...(params ? { params } : {}) });
      if (method === 'Accessibility.getFullAXTree') return otvety['axTree'] ?? { nodes: [] };
      if (method === 'Runtime.evaluate') {
        const expression = String((params ?? {})['expression'] ?? '');
        if (expression === 'axe.run()') return otvety['axe'] ?? { result: { value: { violations: [] } } };
        return otvety['inject'] ?? {};
      }
      return {};
    },
  };
  return { cdp, zvonki };
}

const voditel: WebDriverLike = { getCurrentUrl: async () => 'https://example.org/page' };

function narushenie(over: Zapis = {}): Zapis {
  return {
    id: 'color-contrast',
    impact: 'serious',
    help: 'Elements must have sufficient colour contrast',
    tags: ['cat.color', 'wcag2aa', 'wcag143'],
    nodes: [{ target: ['div.a'] }],
    ...over,
  };
}

describe('finding a way to talk to the browser', () => {
  it('prefers a session it was handed', async () => {
    const { cdp, zvonki } = sessiya();
    await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(zvonki[0]?.method).toBe('Accessibility.getFullAXTree');
  });

  it('opens one through the driver when it has that method', async () => {
    const { cdp } = sessiya();
    const otkryto = vi.fn(async () => cdp);
    await ariadaScan(
      { ...voditel, createCDPConnection: otkryto },
      {},
      { loadAxeSource: async () => 'void 0;' },
    );
    expect(otkryto).toHaveBeenCalledWith('page');
  });

  it('falls back to the driver\'s own command channel', async () => {
    const poslano: string[] = [];
    const driver: WebDriverLike = {
      ...voditel,
      sendAndGetDevToolsCommand: async (method) => {
        poslano.push(method);
        return method === 'Runtime.evaluate' ? { result: { value: { violations: [] } } } : { nodes: [] };
      },
    };
    await ariadaScan(driver, {}, { loadAxeSource: async () => 'void 0;' });
    expect(poslano).toContain('Accessibility.getFullAXTree');
  });

  it('refuses, with a code and a way out, when there is no channel at all', async () => {
    // The message names the remedy because the caller cannot be expected to know
    // that a command-line fallback exists.
    const promise = ariadaScan(voditel, {}, { loadAxeSource: async () => 'void 0;' });
    await expect(promise).rejects.toBeInstanceOf(AriadaScanError);
    await expect(promise).rejects.toThrow(/fallback: 'cli'/);
    await expect(promise).rejects.toMatchObject({ code: 'CDP_UNAVAILABLE' });
  });

  it('is exported under both names it has ever had', () => {
    expect(runAriadaScan).toBe(ariadaScan);
  });
});

describe('reading the accessibility tree', () => {
  it('counts the nodes it was given', async () => {
    const { cdp } = sessiya({ axTree: { nodes: [{}, {}, {}] } });
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(r.axTreeNodeCount).toBe(3);
    expect(r.axTreeSource).toBe('selenium-session');
    expect(r.mode).toBe('selenium-cdp');
  });

  it('reads a tree wrapped in a result envelope as readily as a bare one', async () => {
    const { cdp } = sessiya({ axTree: { result: { nodes: [{}, {}] } } });
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(r.axTreeNodeCount).toBe(2);
  });

  it('counts nothing rather than failing when the answer has no nodes', async () => {
    const { cdp } = sessiya({ axTree: { nodes: 'not a list' } });
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(r.axTreeNodeCount).toBe(0);
  });
});

describe('unwrapping what the page evaluated', () => {
  // Every one of these is a shape a real driver returns. Guessing wrong does not
  // raise anything — it produces an empty list of violations, which reads as a
  // page with nothing wrong.
  it.each([
    ['a doubly wrapped value', { result: { result: { value: { violations: [narushenie()] } } } }],
    ['a singly wrapped value', { result: { value: { violations: [narushenie()] } } }],
    ['a bare value', { value: { violations: [narushenie()] } }],
    ['the object itself', { violations: [narushenie()] }],
  ])('finds the violations in %s', async (_name, axe) => {
    const { cdp } = sessiya({ axe });
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.ruleId).toBe('color-contrast');
  });

  it('reports nothing rather than throwing when the violations are not a list', async () => {
    const { cdp } = sessiya({ axe: { result: { value: { violations: 'none' } } } });
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(r.findings).toEqual([]);
  });
});

describe('turning a violation into a finding', () => {
  async function skanirovat(v: Zapis) {
    const { cdp } = sessiya({ axe: { result: { value: { violations: [v] } } } });
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    return r.findings[0]!;
  }

  it('carries the rule, the impact, the help text and the first element', async () => {
    const f = await skanirovat(narushenie());
    expect(f).toMatchObject({
      ruleId: 'color-contrast',
      severity: 'serious',
      message: 'Elements must have sufficient colour contrast',
      element: { selector: 'div.a' },
    });
  });

  it('reads the success criterion out of the tag that carries it', async () => {
    expect((await skanirovat(narushenie())).criterion).toBe('143');
  });

  it('leaves the criterion out when no tag names one', async () => {
    const f = await skanirovat(narushenie({ tags: ['cat.color'] }));
    expect(Object.hasOwn(f, 'criterion')).toBe(false);
  });

  it('names a missing rule rather than leaving it blank', async () => {
    // A finding with an empty identifier is worse than one called unknown: it
    // groups with every other empty one wherever findings are counted by rule.
    const f = await skanirovat({});
    expect(f.ruleId).toBe('unknown-rule');
    expect(f.severity).toBe('moderate');
    expect(f.message).toBe('Accessibility violation');
  });

  it('leaves the element out when the violation names no node', async () => {
    const f = await skanirovat(narushenie({ nodes: [] }));
    expect(Object.hasOwn(f, 'element')).toBe(false);
  });

  it('reads a target given as a plain string as well as one in a list', async () => {
    const f = await skanirovat(narushenie({ nodes: [{ target: 'span.b' }] }));
    expect(f.element?.selector).toBe('span.b');
  });
});

describe('the policy', () => {
  async function skanirovat(violations: Zapis[], options: Zapis = {}) {
    const { cdp } = sessiya({ axe: { result: { value: { violations } } } });
    return ariadaScan(voditel, options, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
  }

  it('passes when nothing reaches the threshold', async () => {
    const r = await skanirovat([narushenie({ impact: 'minor' })]);
    expect(r.policy).toMatchObject({ threshold: 'moderate', blockingCount: 0, passed: true });
  });

  it.each([
    ['minor', 'minor', 1],
    ['minor', 'moderate', 0],
    ['moderate', 'moderate', 1],
    ['critical', 'serious', 1],
    ['serious', 'critical', 0],
  ])('a %s finding against a %s threshold blocks %s', async (impact, threshold, count) => {
    const r = await skanirovat([narushenie({ impact })], { severityThreshold: threshold });
    expect(r.policy.blockingCount).toBe(count);
  });

  it('ranks an impact it does not recognise as moderate rather than dropping it', async () => {
    // A decision, not an oversight: a severity we cannot read still counts, or
    // an unfamiliar word would make a violation disappear.
    const r = await skanirovat([narushenie({ impact: 'catastrophic' })]);
    expect(r.policy.blockingCount).toBe(1);
  });

  it('raises, carrying the whole result, when asked to fail on violations', async () => {
    const promise = skanirovat([narushenie({ impact: 'critical' })], { failOnViolation: true });
    await expect(promise).rejects.toBeInstanceOf(AriadaPolicyError);
    await expect(promise).rejects.toMatchObject({
      result: { policy: { blockingCount: 1, passed: false } },
    });
  });

  it('stays quiet about violations when it was not asked to fail', async () => {
    const r = await skanirovat([narushenie({ impact: 'critical' })]);
    expect(r.policy.passed).toBe(false);
  });
});

describe('the command-line fallback', () => {
  async function podgotovit(findings: unknown) {
    const dir = await mkdtemp(join(tmpdir(), 'selenium-ariada-'));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'scan.json'), JSON.stringify({ report: { findings } }), 'utf8');
    return dir;
  }

  it('runs the scanner at the address the driver is on, and reads its report', async () => {
    const dir = await podgotovit([narushenie({ impact: 'critical' })]);
    const runScan = vi.fn(async () => 0);
    const r = await ariadaScan(voditel, { fallback: 'cli', outputDir: dir }, { runScan });
    expect(runScan).toHaveBeenCalledWith(
      'https://example.org/page',
      expect.objectContaining({ outputDir: dir, format: 'json' }),
    );
    expect(r.findings).toHaveLength(1);
  });

  it('says plainly that the tree could not be had from a driver', async () => {
    // Not a count of zero on its own: "the tree was empty" and "this transport
    // cannot give a tree" are the same number and different facts.
    const dir = await podgotovit([]);
    const r = await ariadaScan(voditel, { fallback: 'cli', outputDir: dir }, { runScan: async () => 0 });
    expect(r.mode).toBe('dom-fallback');
    expect(r.axTreeSource).toBe('unavailable-from-webdriver');
    expect(r.axTreeNodeCount).toBe(0);
  });

  it('reads findings grouped by domain as readily as a flat list', async () => {
    const dir = await podgotovit({ 'a.example': [narushenie()], 'b.example': [narushenie()] });
    const r = await ariadaScan(voditel, { fallback: 'cli', outputDir: dir }, { runScan: async () => 0 });
    expect(r.findings).toHaveLength(2);
  });

  it('reports no findings when the report names none at all', async () => {
    const dir = await podgotovit(undefined);
    const r = await ariadaScan(voditel, { fallback: 'cli', outputDir: dir }, { runScan: async () => 0 });
    expect(r.findings).toEqual([]);
  });

  it('tells the caller where it put the output', async () => {
    const dir = await podgotovit([]);
    const r = await ariadaScan(voditel, { fallback: 'cli', outputDir: dir }, { runScan: async () => 0 });
    expect(r.outputDir).toBe(dir);
  });

  it('leaves the output location out of a scan that wrote nowhere', async () => {
    const { cdp } = sessiya();
    const r = await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => 'void 0;' });
    expect(Object.hasOwn(r, 'outputDir')).toBe(false);
  });

  it('applies the policy to the fallback too, not only to the tree path', async () => {
    const dir = await podgotovit([narushenie({ impact: 'critical' })]);
    await expect(
      ariadaScan(
        voditel,
        { fallback: 'cli', outputDir: dir, failOnViolation: true },
        { runScan: async () => 0 },
      ),
    ).rejects.toBeInstanceOf(AriadaPolicyError);
  });
});

describe('injecting the rule engine', () => {
  it('evaluates the source it was given before asking for results', async () => {
    const { cdp, zvonki } = sessiya();
    await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => '/* axe */' });
    const vyrazheniya = zvonki
      .filter((z) => z.method === 'Runtime.evaluate')
      .map((z) => String((z.params ?? {})['expression']));
    expect(vyrazheniya).toEqual(['/* axe */', 'axe.run()']);
  });

  it('waits for the injection rather than firing and hoping', async () => {
    const { cdp, zvonki } = sessiya();
    await ariadaScan(voditel, {}, { cdpSession: cdp, loadAxeSource: async () => '/* axe */' });
    const vnedrenie = zvonki.find(
      (z) => z.method === 'Runtime.evaluate' && (z.params ?? {})['expression'] === '/* axe */',
    );
    expect((vnedrenie?.params ?? {})['awaitPromise']).toBe(true);
  });
});
