// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { classifyRole, isDocument } from './classify.js';
import { selectInDepthSample, selectSimplifiedSample } from './select.js';
import type { DiscoveredPage } from './types.js';

/** A small municipal site, of the shape the methodology was written for. */
const site: DiscoveredPage[] = [
  { url: 'https://kommun.example/', depth: 0, title: 'Startsida' },
  { url: 'https://kommun.example/logga-in', linkText: 'Logga in' },
  { url: 'https://kommun.example/webbkarta', linkText: 'Webbkarta' },
  { url: 'https://kommun.example/kontakta-oss', linkText: 'Kontakta oss' },
  { url: 'https://kommun.example/hjalp', linkText: 'Hjälp' },
  { url: 'https://kommun.example/juridisk-information', linkText: 'Juridisk information' },
  { url: 'https://kommun.example/tillganglighetsredogorelse', linkText: 'Tillgänglighetsredogörelse' },
  { url: 'https://kommun.example/synpunkter', linkText: 'Lämna synpunkter' },
  { url: 'https://kommun.example/sok', linkText: 'Sök' },
  { url: 'https://kommun.example/bygglov/ansokan', linkText: 'Ansök om bygglov' },
  { url: 'https://kommun.example/bygglov/handlaggning', linkText: 'Handläggning' },
  { url: 'https://kommun.example/skola/anmalan', linkText: 'Anmälan till skola' },
  { url: 'https://kommun.example/nyheter/2026-08', linkText: 'Nyheter' },
  { url: 'https://kommun.example/blanketter/ansokan.pdf', contentType: 'application/pdf' },
];

const seed = { randomSeed: 'monitoring-2026' };

describe('classifyRole', () => {
  it('recognises the role from a non-English URL, not only from English words', () => {
    expect(classifyRole({ url: 'https://x.example/kontakta-oss' })).toBe('contact');
    expect(classifyRole({ url: 'https://x.example/erklarung-zur-barrierefreiheit' })).toBe(
      'accessibility-statement',
    );
    expect(classifyRole({ url: 'https://x.example/deklaracja-dostepnosci' })).toBe(
      'accessibility-statement',
    );
    expect(classifyRole({ url: 'https://x.example/dichiarazione-di-accessibilita' })).toBe(
      'accessibility-statement',
    );
  });

  it('matches through diacritics, because URLs and labels disagree about them', () => {
    expect(classifyRole({ url: 'https://x.example/x', linkText: 'Tillgänglighetsredogörelse' })).toBe(
      'accessibility-statement',
    );
  });

  it('does not file the accessibility statement under legal pages', () => {
    // Several legal-page terms are substrings of statement terms. Getting this
    // wrong silently drops the one clause an accessibility audit cannot skip.
    const role = classifyRole({ url: 'https://x.example/tillganglighetsredogorelse' });
    expect(role).toBe('accessibility-statement');
    expect(role).not.toBe('legal');
  });

  it('treats a downloadable document as a document, whatever its language', () => {
    expect(isDocument({ url: 'https://x.example/blanketter/ansokan.pdf' })).toBe(true);
    expect(isDocument({ url: 'https://x.example/x', contentType: 'application/pdf' })).toBe(true);
    expect(isDocument({ url: 'https://x.example/nyheter' })).toBe(false);
  });

  it('returns nothing for an ordinary content page rather than guessing', () => {
    expect(classifyRole({ url: 'https://x.example/nyheter/2026-08' })).toBeUndefined();
  });
});

describe('selectInDepthSample', () => {
  const sample = selectInDepthSample(site, seed);

  it('includes every page clause (a) names', () => {
    const roles = sample.pages.filter((p) => p.clause === 'a-core-pages').map((p) => p.role);
    expect(roles).toEqual(
      expect.arrayContaining(['home', 'login', 'sitemap', 'contact', 'help', 'legal']),
    );
  });

  it('includes the accessibility statement and the feedback mechanism under clause (c)', () => {
    const roles = sample.pages
      .filter((p) => p.clause === 'c-statement-feedback')
      .map((p) => p.role);
    expect(roles).toEqual(expect.arrayContaining(['accessibility-statement', 'feedback']));
  });

  it('includes a downloadable document under clause (e)', () => {
    const docs = sample.pages.filter((p) => p.clause === 'e-documents');
    expect(docs).toHaveLength(1);
    expect(docs[0]?.url).toContain('.pdf');
  });

  it('explains why every page is in the sample', () => {
    // An audit sample that cannot say why it looked somewhere is not evidence.
    for (const page of sample.pages) {
      expect(page.reason.length).toBeGreaterThan(10);
    }
  });

  it('never lists the same page twice', () => {
    const urls = sample.pages.map((p) => p.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('is reproducible: the same seed gives the same sample', () => {
    const again = selectInDepthSample(site, seed);
    expect(again.pages.map((p) => p.url)).toEqual(sample.pages.map((p) => p.url));
  });

  it('changes the random pages when the seed changes, but keeps the mandated ones', () => {
    const other = selectInDepthSample(site, { randomSeed: 'different' });
    const mandated = (s: typeof sample): string[] =>
      s.pages.filter((p) => p.clause === 'a-core-pages' || p.clause === 'c-statement-feedback')
        .map((p) => p.url)
        .sort();
    expect(mandated(other)).toEqual(mandated(sample));
  });

  it('reports clauses it could not satisfy instead of silently returning less', () => {
    const bare = selectInDepthSample([{ url: 'https://bare.example/', depth: 0 }], seed);
    expect(bare.unsatisfiedClauses).toContain('c-statement-feedback');
    expect(bare.unsatisfiedClauses).toContain('e-documents');
  });

  it('takes every step of a process once any step is sampled', () => {
    // Point 3.3: a checkout that is accessible on step one and impassable on
    // step three is an inaccessible checkout.
    const withProcess: DiscoveredPage[] = [
      ...site,
      { url: 'https://kommun.example/ansok/steg-1', processId: 'ansok', processStep: 1 },
      { url: 'https://kommun.example/ansok/steg-2', processId: 'ansok', processStep: 2 },
      { url: 'https://kommun.example/ansok/steg-3', processId: 'ansok', processStep: 3 },
    ];
    const s = selectInDepthSample(withProcess, seed);
    const steps = s.pages.filter((p) => p.url.includes('/ansok/steg-'));
    expect(steps).toHaveLength(3);
  });

  it('records the seed, so the sample can be re-derived by someone else', () => {
    expect(sample.randomSeed).toBe('monitoring-2026');
    expect(sample.method).toBe('in-depth');
  });

  it('adds pages the monitoring body chose, and never invents them', () => {
    const withBody = selectInDepthSample(site, {
      ...seed,
      bodySelectedUrls: ['https://kommun.example/special'],
    });
    const f = withBody.pages.filter((p) => p.clause === 'f-body-selected');
    expect(f).toHaveLength(1);
    expect(selectInDepthSample(site, seed).pages.some((p) => p.clause === 'f-body-selected')).toBe(
      false,
    );
  });
});

describe('selectSimplifiedSample', () => {
  it('always includes the home page, as point 3.4 requires', () => {
    const s = selectSimplifiedSample(site, seed);
    expect(s.pages[0]?.role).toBe('home');
    expect(s.method).toBe('simplified');
  });

  it('scales the number of pages with the size of the site', () => {
    const small = selectSimplifiedSample(site.slice(0, 4), seed);
    const large = selectSimplifiedSample(site, seed);
    expect(large.pages.length).toBeGreaterThan(small.pages.length);
  });

  it('says so when there is no home page rather than returning a sample anyway', () => {
    const s = selectSimplifiedSample([{ url: 'https://x.example/deep/page' }], seed);
    expect(s.unsatisfiedClauses).toContain('a-core-pages');
  });
});
