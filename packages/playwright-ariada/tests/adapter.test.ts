// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What is worth holding in a test adapter, and what is deliberately left out.
//
// The artifact is a seam between two processes: the fixture writes it as an
// attachment, the reporter reads it back after the run. Neither can see the
// other, so the parser's refusals are the whole of the contract — a body that
// parses into the wrong shape becomes a report about a scan that did not happen.
//
// The policy decides whether a build fails. It ranks severities and turns the
// result into an exit code, and the boundary at the threshold is the part that
// matters: one rank either side of it is the difference between a red pipeline
// and a green one.
//
// The scan adapter is given its dependencies rather than a browser. Everything
// it does before and after the capture is ours — the guards, the snapshot
// reshape, the capability report — and all of it can be exercised without
// starting Chromium. What genuinely needs a browser is the capture itself, and
// that belongs to the package that performs it.
//
// The capability report gets its own attention. It is the answer to "did the
// accessibility tree come back", and an adapter that reported it available when
// it was not would let a scan that saw nothing read as a scan that found
// nothing.

import { describe, expect, it, vi } from 'vitest';

import {
  ARIADA_ARTIFACT_SCHEMA,
  AriadaScanBlockedError,
  createAriadaFixture,
  createCompleteArtifact,
  createErrorArtifact,
  createScanAdapter,
  evaluatePolicy,
  parseAriadaArtifact,
  serializeAriadaArtifact,
  toHaveNoBlockingViolations,
  toPropertySnapshot,
  type AriadaScanResult,
} from '../src/index.js';

type Zapis = Record<string, unknown>;

function nahodka(severity: string, ruleId = 'color-contrast'): Zapis {
  return {
    ruleId,
    severity,
    message: 'contrast is too low',
    element: { selector: 'div.a' },
  };
}

/** A report shaped the way the policy walks it: sites × domains × findings. */
function otchet(findings: Zapis[]): Zapis {
  return {
    sites: ['https://example.org/'],
    domains: ['accessibility'],
    grid: { 'https://example.org/': { accessibility: findings } },
    interactions: [],
    crossSite: {},
  };
}

function rezultat(findings: Zapis[] = [], threshold = 'moderate'): AriadaScanResult {
  const report = otchet(findings);
  return {
    report,
    capabilities: {
      browser: 'chromium',
      axTree: { status: 'available', transport: 'cdp', nodeCount: 3 },
      dom: { status: 'available', role: 'supplemental', nodeCount: 5 },
    },
    policy: evaluatePolicy(report as never, threshold as never),
    durationMs: 12,
  } as unknown as AriadaScanResult;
}

describe('the artifact that crosses between the fixture and the reporter', () => {
  it('survives being written and read back', () => {
    const artifact = createCompleteArtifact(rezultat([nahodka('serious')]));
    const back = parseAriadaArtifact(serializeAriadaArtifact(artifact));
    expect(back).toEqual(artifact);
  });

  it('ends with a newline, so the file is a line a shell can read', () => {
    expect(serializeAriadaArtifact(createErrorArtifact(new Error('x')))).toMatch(/\n$/);
  });

  it('records the name and message of a real error, and the text of anything else', () => {
    const izOshibki = createErrorArtifact(new TypeError('bad input'));
    expect(izOshibki.error).toEqual({ name: 'TypeError', message: 'bad input' });
    const izStroki = createErrorArtifact('just a string');
    expect(izStroki.error).toEqual({ name: 'Error', message: 'just a string' });
  });

  it.each([
    ['a body that is not this artifact', JSON.stringify({ hello: 'world' }), /not an Ariada Playwright artifact/],
    ['another schema', JSON.stringify({ $schema: 'other', version: 1 }), /not an Ariada Playwright artifact/],
    ['another version', JSON.stringify({ $schema: ARIADA_ARTIFACT_SCHEMA, version: 2 }), /Unsupported Ariada artifact version/],
    [
      'an error artifact with no message',
      JSON.stringify({ $schema: ARIADA_ARTIFACT_SCHEMA, version: 1, status: 'error', error: {} }),
      /no error message/,
    ],
    [
      'a complete artifact whose result is not one',
      JSON.stringify({ $schema: ARIADA_ARTIFACT_SCHEMA, version: 1, status: 'complete', result: {} }),
      /invalid scan result/,
    ],
    [
      'a status it does not know',
      JSON.stringify({ $schema: ARIADA_ARTIFACT_SCHEMA, version: 1, status: 'partial' }),
      /invalid scan result/,
    ],
  ])('refuses %s', (_name, body, message) => {
    expect(() => parseAriadaArtifact(body)).toThrow(message);
  });
});

describe('the policy that decides whether a build fails', () => {
  it('passes a report with no findings, with the exit code that means success', () => {
    const p = evaluatePolicy(otchet([]) as never);
    expect(p.blockingFindings).toEqual([]);
    expect(p.exitCode).toBe(0);
  });

  it.each([
    ['minor', 'minor', true],
    ['minor', 'moderate', false],
    ['moderate', 'moderate', true],
    ['serious', 'moderate', true],
    ['critical', 'minor', true],
  ])('a %s finding against a %s threshold blocks: %s', (severity, threshold, blocks) => {
    // The rank either side of the threshold is the difference between a red
    // pipeline and a green one, so both sides are named rather than sampled.
    const p = evaluatePolicy(otchet([nahodka(severity)]) as never, threshold as never);
    expect(p.blockingFindings.length > 0).toBe(blocks);
    expect(p.exitCode).toBe(blocks ? 1 : 0);
  });

  it('defaults to the moderate threshold when none is given', () => {
    expect(evaluatePolicy(otchet([]) as never).threshold).toBe('moderate');
  });

  it('collects findings across every site and domain, not only the first', () => {
    const shirokiy = {
      sites: ['a', 'b'],
      domains: ['accessibility', 'privacy'],
      grid: {
        a: { accessibility: [nahodka('critical', 'r1')], privacy: [nahodka('critical', 'r2')] },
        b: { accessibility: [nahodka('critical', 'r3')] },
      },
      interactions: [],
      crossSite: {},
    };
    const p = evaluatePolicy(shirokiy as never);
    expect(p.blockingFindings.map((f) => (f as unknown as Zapis)['ruleId'])).toEqual([
      'r1',
      'r2',
      'r3',
    ]);
  });

  it('tolerates a grid with nothing at a site-and-domain pair', () => {
    const dyryavyy = {
      sites: ['a', 'b'],
      domains: ['accessibility'],
      grid: { a: { accessibility: [nahodka('critical')] } },
      interactions: [],
      crossSite: {},
    };
    expect(evaluatePolicy(dyryavyy as never).blockingFindings).toHaveLength(1);
  });
});

describe('reshaping the captured snapshot', () => {
  const minimalnyy = {
    scanId: 's-1',
    url: 'https://example.org/',
    timestamp: '2026-09-07T10:00:00.000Z',
    networkResources: [],
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    timings: {},
  };

  it('substitutes empty values for what the capture did not produce', () => {
    const p = toPropertySnapshot(minimalnyy as never);
    expect(p.html).toBe('');
    expect(p.headers).toEqual({});
    expect(p.cookies).toEqual([]);
  });

  it('leaves optional parts out rather than carrying them as undefined', () => {
    // The snapshot is serialised into an artifact, where a key present with the
    // value undefined and a key absent are two different documents.
    const p = toPropertySnapshot(minimalnyy as never);
    expect(Object.hasOwn(p, 'initialHtml')).toBe(false);
    expect(Object.hasOwn(p, 'axeFindings')).toBe(false);
  });

  it('keeps optional parts that the capture did produce', () => {
    const p = toPropertySnapshot({
      ...minimalnyy,
      initialHtml: '<html></html>',
      axeFindings: [{ id: 'x' }],
    } as never);
    expect(p.initialHtml).toBe('<html></html>');
    expect(p.axeFindings).toHaveLength(1);
  });
});

describe('the guards before a scan starts', () => {
  const snimok = {
    scanId: 's-1',
    url: 'https://example.org/',
    timestamp: '2026-09-07T10:00:00.000Z',
    html: '<html><body>hi</body></html>',
    networkResources: [],
    axTree: [{ role: 'button' }],
    domOutline: [{ tag: 'body' }],
    perfMetrics: {},
    timings: {},
  };

  function stranica(over: Zapis = {}) {
    return {
      isClosed: () => false,
      url: () => 'https://example.org/',
      context: () => ({ browser: () => ({ browserType: () => ({ name: () => 'chromium' }) }) }),
      ...over,
    } as never;
  }

  function adapter(over: Zapis = {}) {
    return createScanAdapter({
      capture: vi.fn(async () => snimok as never),
      scan: vi.fn(async () => otchet([]) as never),
      domains: () => [{ id: 'accessibility' } as never],
      ...over,
    } as never);
  }

  it('refuses a page that has already closed', async () => {
    await expect(adapter()(stranica({ isClosed: () => true }))).rejects.toThrow(/closed/);
  });

  it('refuses a severity threshold it does not rank', async () => {
    await expect(
      adapter()(stranica(), { severityThreshold: 'catastrophic' as never }),
    ).rejects.toThrow(/Unsupported Ariada severity threshold/);
  });

  it('refuses to scan with no domain module at all', async () => {
    // Otherwise the run finishes, finds nothing, and is indistinguishable from a
    // page with nothing wrong — which is the failure this product exists to
    // prevent, arriving through its own adapter.
    await expect(adapter({ domains: () => [] })(stranica())).rejects.toThrow(
      /at least one canonical domain/,
    );
  });

  it('refuses a capture that produced neither markup nor an outline', async () => {
    const pustoy = { ...snimok, html: '', domOutline: [] };
    await expect(
      adapter({ capture: async () => pustoy as never })(stranica()),
    ).rejects.toThrow(/neither rendered HTML nor a DOM outline/);
  });

  it('gives the capture the address of the page and a scan identifier', async () => {
    const capture = vi.fn(async () => snimok as never);
    await adapter({ capture })(stranica(), { scanId: 's-42' });
    expect(capture).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ url: 'https://example.org/', scanId: 's-42', screenshot: false }),
    );
  });

  it('invents a scan identifier when the caller gives none', async () => {
    // The spy is typed by its own implementation, which takes no arguments, so
    // its recorded calls are an empty tuple as far as the compiler is concerned.
    // Read through the recorded values rather than by index.
    const vidennye: Zapis[] = [];
    const capture = vi.fn(async (_page: unknown, options: unknown) => {
      vidennye.push(options as Zapis);
      return snimok as never;
    });
    await adapter({ capture })(stranica());
    expect(String(vidennye[0]?.['scanId'])).toMatch(/[0-9a-f-]{36}/);
  });
});

describe('what the scan says about what it could see', () => {
  const s_derevom = {
    scanId: 's-1',
    url: 'https://example.org/',
    timestamp: '2026-09-07T10:00:00.000Z',
    html: '<html></html>',
    networkResources: [],
    axTree: [{ role: 'button' }, { role: 'link' }],
    domOutline: [{ tag: 'body' }],
    perfMetrics: {},
    timings: {},
  };
  const bez_dereva = { ...s_derevom, axTree: [] };

  function adapter(snapshot: unknown, browserName?: string) {
    return createScanAdapter({
      capture: async () => snapshot as never,
      scan: async () => otchet([]) as never,
      domains: () => [{ id: 'accessibility' } as never],
    } as never)(
      {
        isClosed: () => false,
        url: () => 'https://example.org/',
        context: () => ({
          browser: () =>
            browserName === undefined
              ? undefined
              : { browserType: () => ({ name: () => browserName }) },
        }),
      } as never,
    );
  }

  it('reports the tree as available, and the DOM as supplementary, when the tree came back', async () => {
    const r = await adapter(s_derevom, 'chromium');
    expect(r.capabilities.axTree).toMatchObject({ status: 'available', nodeCount: 2 });
    expect(r.capabilities.dom.role).toBe('supplemental');
  });

  it('reports the tree as unavailable, with a reason, when it did not', async () => {
    // Not silence and not a zero count on its own: "the tree was empty" and
    // "there was no tree to read" are the same number and opposite facts.
    const r = await adapter(bez_dereva, 'chromium');
    expect(r.capabilities.axTree.status).toBe('unavailable');
    expect(
      (r.capabilities.axTree as unknown as Zapis)['reason'],
    ).toMatch(/returned no nodes/);
    expect(r.capabilities.dom.role).toBe('fallback');
  });

  it('names the engine that cannot expose the tree at all, rather than blaming the page', async () => {
    const r = await adapter(bez_dereva, 'firefox');
    expect((r.capabilities.axTree as unknown as Zapis)['reason']).toMatch(/firefox does not expose/);
  });

  it('says the engine is unknown rather than guessing when it cannot be read', async () => {
    const r = await adapter(bez_dereva, undefined);
    expect(r.capabilities.browser).toBe('unknown');
  });

  it('measures how long the scan took', async () => {
    const r = await adapter(s_derevom, 'chromium');
    expect(typeof r.durationMs).toBe('number');
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('the assertion a test writer uses', () => {
  it('passes when nothing blocks, and says so in the other direction', () => {
    const { pass, message } = toHaveNoBlockingViolations(rezultat([]));
    expect(pass).toBe(true);
    expect(message()).toMatch(/but none was found/);
  });

  it('fails with the rule, severity, selector and message of each blocker', () => {
    const { pass, message } = toHaveNoBlockingViolations(rezultat([nahodka('critical')]));
    expect(pass).toBe(false);
    const text = message();
    expect(text).toContain('color-contrast');
    expect(text).toContain('[critical]');
    expect(text).toContain('div.a');
  });

  it('shows twenty and counts the rest, rather than printing hundreds', () => {
    const mnogo = Array.from({ length: 25 }, (_, i) => nahodka('critical', `r${i}`));
    const text = toHaveNoBlockingViolations(rezultat(mnogo)).message();
    expect(text).toContain('found 25');
    expect(text).toContain('and 5 more');
    expect(text).toContain('r19');
    expect(text).not.toContain('r20 ');
  });
});

describe('the fixture that attaches what happened to the test', () => {
  function testInfo() {
    const vlozheno: { name: string; body: string }[] = [];
    return {
      info: {
        testId: 't-1',
        attach: async (name: string, o: { body: Buffer }) =>
          void vlozheno.push({ name, body: o.body.toString('utf8') }),
      } as never,
      vlozheno,
    };
  }

  it('attaches a complete artifact and returns the result', async () => {
    const { info, vlozheno } = testInfo();
    const ozhidaemyy = rezultat([]);
    const fixture = createAriadaFixture(info, {}, async () => ozhidaemyy);
    await expect(fixture.scan({} as never)).resolves.toBe(ozhidaemyy);
    expect(vlozheno).toHaveLength(1);
    expect(parseAriadaArtifact(vlozheno[0]!.body).status).toBe('complete');
  });

  it('attaches an error artifact when the scan fails, and still raises', async () => {
    // The attachment matters more here than in the passing case: a scan that
    // could not run and left nothing behind is indistinguishable, in the report,
    // from a test that never asked for one.
    const { info, vlozheno } = testInfo();
    const fixture = createAriadaFixture(info, {}, async () => {
      throw new Error('capture failed');
    });
    await expect(fixture.scan({} as never)).rejects.toBeInstanceOf(AriadaScanBlockedError);
    expect(parseAriadaArtifact(vlozheno[0]!.body).status).toBe('error');
  });

  it('keeps the original failure as the cause rather than replacing it', async () => {
    const { info } = testInfo();
    const iskhodnaya = new Error('capture failed');
    const fixture = createAriadaFixture(info, {}, async () => {
      throw iskhodnaya;
    });
    await expect(fixture.scan({} as never)).rejects.toMatchObject({ cause: iskhodnaya });
  });

  it('numbers repeated scans within one test so their artifacts do not collide', async () => {
    const { info } = testInfo();
    const vidennye: string[] = [];
    const fixture = createAriadaFixture(info, {}, async (_p, o) => {
      vidennye.push(String(o?.scanId));
      return rezultat([]);
    });
    await fixture.scan({} as never);
    await fixture.scan({} as never);
    expect(vidennye).toEqual(['t-1-1', 't-1-2']);
  });

  it('applies the default threshold only when the caller named none', async () => {
    const { info } = testInfo();
    const vidennye: (string | undefined)[] = [];
    const fixture = createAriadaFixture(info, { severityThreshold: 'critical' }, async (_p, o) => {
      vidennye.push(o?.severityThreshold);
      return rezultat([]);
    });
    await fixture.scan({} as never);
    await fixture.scan({} as never, { severityThreshold: 'minor' });
    expect(vidennye).toEqual(['critical', 'minor']);
  });
});
