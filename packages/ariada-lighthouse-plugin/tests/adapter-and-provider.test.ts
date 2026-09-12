// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// This package is a seam between our scan output and a Lighthouse report, and
// it has three parts that fail in three different ways.
//
// The adapter promises a deterministic table — the word is in the audit's own
// description. A report whose rows move between runs produces a diff nobody can
// read, and the promise is the kind that holds by accident for months on one
// machine's key order. So the ordering is asserted from deliberately shuffled
// input rather than from a fixture that happens to be sorted.
//
// The provider caches by URL, and the interesting half is what it does NOT
// cache: a rejected load must not be remembered, or one transient failure turns
// into a permanently failing audit for the rest of the run.
//
// The plugin declaration names its audits by identifier, and Lighthouse raises
// nothing when a category references an audit that does not exist — the
// category simply renders empty. That is the same shape as a rule pointing at a
// missing check: a report that looks finished and says nothing. It is asserted
// against the audits' own metadata rather than against a copy of the strings.

import { afterEach, describe, expect, it } from 'vitest';

import {
  AriadaConformanceAudit,
  AriadaHighImpactAudit,
  ARIADA_DETAIL_HEADINGS,
  ARIADA_SCAN_OUTPUT_ENV,
  category,
  configureAriadaScanOutput,
  configureAriadaScanProvider,
  contextFromLighthouseUrl,
  extractAriadaReport,
  flattenAriadaFindings,
  loadAriadaScanOutput,
  resetAriadaScanProvider,
  scoreAriadaFindings,
  toAriadaConformanceProduct,
  toAriadaHighImpactProduct,
  type AriadaFinding,
} from '../src/index.js';

function nahodka(over: Partial<AriadaFinding> = {}): AriadaFinding {
  return {
    domain: 'example.org',
    ruleId: 'color-contrast',
    severity: 'serious',
    message: 'contrast is too low',
    ...over,
  } as AriadaFinding;
}

const KONTEKST = {
  requestedUrl: 'https://example.org/',
  mainDocumentUrl: 'https://example.org/',
  finalDisplayedUrl: 'https://example.org/',
};

afterEach(() => {
  resetAriadaScanProvider();
  delete process.env[ARIADA_SCAN_OUTPUT_ENV];
});

describe('reading a scan output', () => {
  it('accepts a report nested under a report key, and one that is the report', () => {
    const report = { findings: [nahodka()] };
    expect(extractAriadaReport({ report }).findings).toHaveLength(1);
    expect(extractAriadaReport(report).findings).toHaveLength(1);
  });

  it('keeps the scan identifier and the address when they are strings', () => {
    const r = extractAriadaReport({ findings: [], scanId: 's-1', url: 'https://example.org/' });
    expect(r.scanId).toBe('s-1');
    expect(r.url).toBe('https://example.org/');
  });

  it('leaves them out rather than carrying them as undefined', () => {
    const r = extractAriadaReport({ findings: [], scanId: 42, url: null });
    expect(Object.hasOwn(r, 'scanId')).toBe(false);
    expect(Object.hasOwn(r, 'url')).toBe(false);
  });

  it.each([
    ['a value that is not an object', 'nope', /must contain a report object/],
    ['an object with no findings', { url: 'x' }, /must contain findings/],
    ['findings that are neither list nor map', { findings: 7 }, /array or a domain map/],
    ['a domain whose value is not a list', { findings: { 'a.example': 7 } }, /are not an array/],
  ])('refuses %s', (_name, input, message) => {
    expect(() => extractAriadaReport(input)).toThrow(message);
  });

  it.each([
    ['is not an object', 'nope', /not an object/],
    ['has no domain', { ruleId: 'r', severity: 'serious', message: 'm' }, /no domain/],
    ['has no rule', { domain: 'd', severity: 'serious', message: 'm' }, /no ruleId/],
    ['has an unknown severity', { domain: 'd', ruleId: 'r', severity: 'annoying', message: 'm' }, /invalid severity/],
    ['has no message', { domain: 'd', ruleId: 'r', severity: 'serious' }, /no message/],
  ])('refuses a finding that %s, and names its position', (_name, finding, message) => {
    expect(() => extractAriadaReport({ findings: [nahodka(), finding] })).toThrow(message);
    expect(() => extractAriadaReport({ findings: [nahodka(), finding] })).toThrow(/index 1/);
  });
});

describe('the order is the same every time', () => {
  // Asserted from shuffled input on purpose. A fixture that happens to be
  // sorted lets an unordered implementation pass for as long as nobody changes
  // the fixture, and the promise of determinism is in the audit's own text.
  const peremeshannye = [
    nahodka({ severity: 'minor', ruleId: 'z-rule' }),
    nahodka({ severity: 'critical', ruleId: 'm-rule' }),
    nahodka({ severity: 'serious', ruleId: 'b-rule' }),
    nahodka({ severity: 'critical', ruleId: 'a-rule' }),
    nahodka({ severity: 'moderate', ruleId: 'q-rule' }),
  ];

  it('sorts by severity first, worst to least', () => {
    const out = flattenAriadaFindings({ findings: peremeshannye });
    expect(out.map((f) => f.severity)).toEqual([
      'critical',
      'critical',
      'serious',
      'moderate',
      'minor',
    ]);
  });

  it('sorts by rule within one severity', () => {
    const out = flattenAriadaFindings({ findings: peremeshannye });
    expect(out.slice(0, 2).map((f) => f.ruleId)).toEqual(['a-rule', 'm-rule']);
  });

  it('gives the same answer for input in any order', () => {
    const pryamoy = flattenAriadaFindings({ findings: peremeshannye });
    const obratnyy = flattenAriadaFindings({ findings: [...peremeshannye].reverse() });
    expect(obratnyy).toEqual(pryamoy);
  });

  it('orders a domain map by domain, whatever order the keys were written in', () => {
    // Named for what it holds and not for how. Removing the sort over domain
    // keys inside the walk leaves this green, because the final ordering sorts
    // everything again and subsumes it — that sort states an intention rather
    // than a behaviour, and no test can tell it from its own absence. What is
    // held here is the ORDER OF THE OUTPUT, which is the promise the audit
    // makes to a reader diffing two reports.
    const po_domenam = {
      findings: {
        'z.example': [nahodka({ domain: 'z.example', severity: 'minor' })],
        'a.example': [nahodka({ domain: 'a.example', severity: 'minor' })],
      },
    };
    expect(flattenAriadaFindings(po_domenam).map((f) => f.domain)).toEqual([
      'a.example',
      'z.example',
    ]);
  });

  it('numbers findings across domains in domain order when it refuses one', () => {
    // The domain sort that IS load-bearing: the position quoted in a refusal is
    // counted while walking the map, so an unsorted walk would name a different
    // index for the same payload on a different key order, and the message
    // would stop being reproducible.
    const s_bracom = {
      findings: {
        'z.example': [nahodka({ domain: 'z.example' })],
        'a.example': [nahodka({ domain: 'a.example' }), { domain: 'a.example' }],
      },
    };
    expect(() => extractAriadaReport(s_bracom)).toThrow(/index 1/);
  });
});

describe('scoring', () => {
  it('scores a clean scan at one', () => {
    expect(scoreAriadaFindings([])).toBe(1);
  });

  it.each([
    ['critical', 0],
    ['serious', 0.25],
    ['moderate', 0.5],
    ['minor', 0.75],
  ] as const)('scores a single %s finding at %s', (severity, expected) => {
    expect(scoreAriadaFindings([nahodka({ severity })])).toBe(expected);
  });

  it('takes the worst finding, not the average', () => {
    // An average would let a page with one critical and twenty minor findings
    // score better than a page with one critical alone, which is backwards.
    expect(
      scoreAriadaFindings([
        nahodka({ severity: 'critical' }),
        nahodka({ severity: 'minor' }),
        nahodka({ severity: 'minor' }),
      ]),
    ).toBe(0);
  });
});

describe('the conformance product', () => {
  it('says so plainly when there is nothing to report', () => {
    const p = toAriadaConformanceProduct({ findings: [] });
    expect(p.score).toBe(1);
    expect(p.numericValue).toBe(0);
    expect(p.displayValue).toBe('No Ariada findings');
  });

  it('counts one finding in the singular and two in the plural', () => {
    expect(toAriadaConformanceProduct({ findings: [nahodka()] }).displayValue).toMatch(
      /^1 Ariada finding \(/,
    );
    expect(
      toAriadaConformanceProduct({ findings: [nahodka(), nahodka()] }).displayValue,
    ).toMatch(/^2 Ariada findings \(/);
  });

  it('breaks the count down by severity, worst first, omitting the empty ones', () => {
    const p = toAriadaConformanceProduct({
      findings: [
        nahodka({ severity: 'minor' }),
        nahodka({ severity: 'critical' }),
        nahodka({ severity: 'critical' }),
      ],
    });
    expect(p.displayValue).toContain('2 critical, 1 minor');
    expect(p.displayValue).not.toContain('serious');
  });

  it('builds a table with the declared headings and one row per finding', () => {
    const p = toAriadaConformanceProduct({ findings: [nahodka(), nahodka({ severity: 'minor' })] });
    const details = p.details as { type: string; headings: unknown; items: unknown[] };
    expect(details.type).toBe('table');
    expect(details.headings).toBe(ARIADA_DETAIL_HEADINGS);
    expect(details.items).toHaveLength(2);
  });

  it('puts an empty string where a finding names no element', () => {
    const p = toAriadaConformanceProduct({ findings: [nahodka()] });
    const items = (p.details as { items: Record<string, unknown>[] }).items;
    expect(items[0]?.['selector']).toBe('');
  });

  it('collects references without repeating one', () => {
    const p = toAriadaConformanceProduct({
      findings: [
        nahodka({
          criterion: '1.4.3',
          wcagMapping: ['1.4.3', '1.4.11'],
          regulatoryMapping: [{ framework: 'EN 301 549', code: '9.1.4.3' }],
        } as Partial<AriadaFinding>),
      ],
    });
    const items = (p.details as { items: Record<string, unknown>[] }).items;
    expect(items[0]?.['references']).toBe('1.4.3, 1.4.11, EN 301 549 9.1.4.3');
  });
});

describe('the high-impact product', () => {
  it('keeps only critical and serious findings', () => {
    const p = toAriadaHighImpactProduct({
      findings: [
        nahodka({ severity: 'critical' }),
        nahodka({ severity: 'serious' }),
        nahodka({ severity: 'moderate' }),
        nahodka({ severity: 'minor' }),
      ],
    });
    expect(p.numericValue).toBe(2);
  });

  it('scores one or zero, with nothing in between', () => {
    // Unlike the conformance audit, this one is a gate: any high-impact finding
    // fails it outright, and a severity-weighted score here would let a page
    // with a critical finding show as mostly fine.
    expect(toAriadaHighImpactProduct({ findings: [] }).score).toBe(1);
    expect(
      toAriadaHighImpactProduct({ findings: [nahodka({ severity: 'minor' })] }).score,
    ).toBe(1);
    expect(
      toAriadaHighImpactProduct({ findings: [nahodka({ severity: 'serious' })] }).score,
    ).toBe(0);
  });

  it('says so plainly when there are none', () => {
    expect(toAriadaHighImpactProduct({ findings: [] }).displayValue).toBe(
      'No critical or serious Ariada findings',
    );
  });
});

describe('finding the address to scan', () => {
  it.each([
    ['prefers the final displayed address', { requestedUrl: 'a', mainDocumentUrl: 'b', finalDisplayedUrl: 'c' }, 'c'],
    ['falls back to the main document', { requestedUrl: 'a', mainDocumentUrl: 'b' }, 'b'],
    ['falls back to what was requested', { requestedUrl: 'a' }, 'a'],
  ])('%s', (_name, artifact, expected) => {
    expect(contextFromLighthouseUrl(artifact).finalDisplayedUrl).toBe(expected);
  });

  it('fills the other two fields rather than leaving them empty', () => {
    const c = contextFromLighthouseUrl({ finalDisplayedUrl: 'c' });
    expect(c.requestedUrl).toBe('c');
    expect(c.mainDocumentUrl).toBe('c');
  });

  it('refuses an artifact with no address at all', () => {
    expect(() => contextFromLighthouseUrl({})).toThrow(/does not contain a target URL/);
  });
});

describe('loading the scan output', () => {
  it('asks the configured provider once per address', async () => {
    let zvali = 0;
    configureAriadaScanProvider(() => {
      zvali += 1;
      return { findings: [] };
    });
    await loadAriadaScanOutput(KONTEKST);
    await loadAriadaScanOutput(KONTEKST);
    expect(zvali).toBe(1);
  });

  it('asks again for a different address', async () => {
    let zvali = 0;
    configureAriadaScanProvider(() => {
      zvali += 1;
      return { findings: [] };
    });
    await loadAriadaScanOutput(KONTEKST);
    await loadAriadaScanOutput({ ...KONTEKST, finalDisplayedUrl: 'https://other.example/' });
    expect(zvali).toBe(2);
  });

  it('does not remember a failure, so a later attempt can succeed', async () => {
    // The half that matters. A cached rejection turns one transient failure
    // into an audit that fails for the rest of the run, and the second failure
    // carries no trace of the first.
    let zvali = 0;
    configureAriadaScanProvider(() => {
      zvali += 1;
      if (zvali === 1) throw new Error('scanner was busy');
      return { findings: [] };
    });
    await expect(loadAriadaScanOutput(KONTEKST)).rejects.toThrow(/scanner was busy/);
    await expect(loadAriadaScanOutput(KONTEKST)).resolves.toEqual({ findings: [] });
    expect(zvali).toBe(2);
  });

  it('forgets what it loaded when a new provider is configured', async () => {
    // Read through the adapter rather than off the loaded value: the loaded
    // type is a union of three envelope shapes, and reaching into one of them
    // here would be asserting against a shape the loader does not promise.
    configureAriadaScanOutput({ findings: [nahodka()] });
    expect(flattenAriadaFindings(await loadAriadaScanOutput(KONTEKST))).toHaveLength(1);
    configureAriadaScanOutput({ findings: [] });
    expect(flattenAriadaFindings(await loadAriadaScanOutput(KONTEKST))).toHaveLength(0);
  });

  it('reads inline JSON from the environment when nothing is configured', async () => {
    process.env[ARIADA_SCAN_OUTPUT_ENV] = JSON.stringify({ findings: [nahodka()] });
    expect(flattenAriadaFindings(await loadAriadaScanOutput(KONTEKST))).toHaveLength(1);
  });

  it('says what to set when nothing is configured at all', async () => {
    await expect(loadAriadaScanOutput(KONTEKST)).rejects.toThrow(
      new RegExp(ARIADA_SCAN_OUTPUT_ENV),
    );
  });
});

describe('the plugin declaration', () => {
  // Lighthouse raises nothing when a category references an audit that does not
  // exist; the category renders empty. Compared against the audits' own
  // metadata rather than against a second copy of the strings.
  it('references audits that exist, by the identifiers they give themselves', () => {
    const zayavlennye = category?.auditRefs.map((r) => r.id).sort((odin, drugoy) => odin.localeCompare(drugoy, 'en'));
    const nastoyashchie = [AriadaConformanceAudit.meta.id, AriadaHighImpactAudit.meta.id].sort((odin, drugoy) => odin.localeCompare(drugoy, 'en'));
    expect(zayavlennye).toEqual(nastoyashchie);
  });

  it('puts every referenced audit in a group the plugin declares', async () => {
    const gruppy = new Set(Object.keys((await import('../src/index.js')).groups));
    for (const ref of category?.auditRefs ?? []) {
      expect(gruppy.has(String(ref.group))).toBe(true);
    }
  });

  it('asks Lighthouse for the artifact the audits actually read', () => {
    for (const audit of [AriadaConformanceAudit, AriadaHighImpactAudit]) {
      expect(audit.meta.requiredArtifacts).toContain('URL');
    }
  });
});
