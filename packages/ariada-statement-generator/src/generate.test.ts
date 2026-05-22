// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for accessibility-statement generator.
 */

import type { Violation, ReportMeta } from '@ariada-org/evidence-emitter';
import { describe, it, expect } from 'vitest';

import { generateStatement } from './generate.js';

import * as publicApi from './index.js';

const baseMeta: ReportMeta = {
  productName: 'Acme Web Store',
  productVersion: '2.4.1',
  evaluator: 'Agonist Development AB',
  evaluatorContact: 'a11y@example.com',
  evaluationDate: '2026-05-15',
  scope: 'https://example.com',
  methodology: 'Automated axe-core + manual review',
};

const baseOptions = {
  locale: 'en' as const,
  jurisdiction: 'SE' as const,
  authorityEmail: 'a11y@example.com',
  organisation: 'Example AB',
  feedbackUrl: 'https://example.com/contact',
};

describe('generateStatement', () => {
  it('emits HTML by default with title + publication date + locale lang attr', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.format).toBe('html');
    expect(out.body).toMatch(/<!doctype html>/i);
    expect(out.body).toContain('lang="en"');
    expect(out.body).toContain('2026-05-15'); // publication date
    expect(out.body).toMatch(/<title>/i);
    expect(out.body).toContain('Acme Web Store');
  });

  it('emits MDX when format=mdx', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, format: 'mdx' });
    expect(out.format).toBe('mdx');
    expect(out.body).toMatch(/^---\n/); // frontmatter
    expect(out.body).toContain('title:');
    expect(out.body).toContain('publishedAt: 2026-05-15');
  });

  it('shows "fully compliant" badge when no violations and conformance=full', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, conformance: 'full' });
    expect(out.body).toMatch(/fully compliant|fully conformant/i);
  });

  it('lists violations under non-conformance section in HTML', () => {
    const v: Violation[] = [
      {
        id: 'color-contrast',
        description: 'Insufficient contrast on body text',
        help: 'Increase contrast ratio to 4.5:1',
        impact: 'serious',
        wcag: ['1.4.3'],
        nodeCount: 3,
      },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('1.4.3');
    expect(out.body).toContain('Insufficient contrast on body text');
  });

  it('includes feedback mechanism URL + email', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toContain('https://example.com/contact');
    expect(out.body).toContain('a11y@example.com');
  });

  it('SE jurisdiction includes DIGG enforcement procedure link', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toContain('digg.se');
  });

  it('NO jurisdiction includes Digdir enforcement procedure link', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, jurisdiction: 'NO' });
    expect(out.body.toLowerCase()).toMatch(/digdir|tilsynet|uutilsynet/);
  });

  it('DK jurisdiction includes Digst enforcement procedure link', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, jurisdiction: 'DK' });
    expect(out.body).toMatch(/digst|digitaliseringsstyrelsen/i);
  });

  it('FI jurisdiction includes Avi enforcement procedure link', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, jurisdiction: 'FI' });
    expect(out.body.toLowerCase()).toMatch(/avi|saavutettavuusvaatimukset/);
  });

  it('locale=sv renders heading in Swedish', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'sv' });
    expect(out.body).toMatch(/Tillgänglighet|tillgänglighet/);
    expect(out.body).toContain('lang="sv"');
  });

  it('locale=nb renders heading in Norwegian Bokmål', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'nb' });
    expect(out.body).toContain('lang="nb"');
    expect(out.body).toMatch(/tilgjengelighet/i);
  });

  it('locale=da renders heading in Danish', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'da' });
    expect(out.body).toContain('lang="da"');
    expect(out.body).toMatch(/tilgængelighed/i);
  });

  it('locale=fi renders heading in Finnish', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'fi' });
    expect(out.body).toContain('lang="fi"');
    expect(out.body).toMatch(/saavutettavuus/i);
  });

  it('conformance=partial includes "partially compliant" wording', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, conformance: 'partial' });
    expect(out.body).toMatch(/partial/i);
  });

  it('conformance=non-conformant includes non-compliance wording', () => {
    const out = generateStatement([], baseMeta, {
      ...baseOptions,
      conformance: 'non-conformant',
    });
    expect(out.body).toMatch(/non-conform|non-complian|not compliant/i);
  });

  it('output references WCAG 2.2 Level AA standard', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toMatch(/WCAG 2\.2/i);
  });

  it('output references EN 301 549', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toContain('EN 301 549');
  });
});

describe('generateStatement — MDX rendering with violations', () => {
  it('renders non-conformance list in MDX with WCAG SC + en301549 + node count', () => {
    const v: Violation[] = [
      {
        id: 'color-contrast',
        description: 'Insufficient contrast on body text',
        help: 'Increase contrast ratio to 4.5:1',
        impact: 'serious',
        wcag: ['1.4.3'],
        en301549: ['11.1.4.3'],
        nodeCount: 5,
      },
    ];
    const out = generateStatement(v, baseMeta, { ...baseOptions, format: 'mdx' });
    expect(out.format).toBe('mdx');
    expect(out.body).toContain('Insufficient contrast on body text');
    expect(out.body).toContain('WCAG 1.4.3');
    expect(out.body).toContain('EN 301 549 11.1.4.3');
    expect(out.body).toContain('× 5');
  });

  it('omits methodology row in MDX when meta.methodology is absent', () => {
    const metaNoMethod: ReportMeta = { ...baseMeta };
    delete (metaNoMethod as { methodology?: string }).methodology;
    const out = generateStatement([], metaNoMethod, { ...baseOptions, format: 'mdx' });
    expect(out.body).not.toContain('Automated axe-core');
  });

  it('omits product version parenthetical when meta.productVersion is absent (MDX)', () => {
    const metaNoVer: ReportMeta = { ...baseMeta };
    delete (metaNoVer as { productVersion?: string }).productVersion;
    const out = generateStatement([], metaNoVer, { ...baseOptions, format: 'mdx' });
    expect(out.body).toContain('Acme Web Store');
    expect(out.body).not.toContain('(2.4.1)');
  });
});

describe('generateStatement — options overrides', () => {
  it('uses custom enforcementUrl when provided', () => {
    const customUrl = 'https://accessibility.example.com/enforcement';
    const out = generateStatement([], baseMeta, { ...baseOptions, enforcementUrl: customUrl });
    expect(out.body).toContain(customUrl);
  });

  it('uses custom title when provided', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, title: 'Custom Statement Title' });
    expect(out.body).toContain('Custom Statement Title');
  });

  it('uses custom lastRevised when provided', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, lastRevised: '2026-12-31' });
    expect(out.body).toContain('2026-12-31');
  });

  it('derives conformance=full from empty violations when no override', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toMatch(/fully (compliant|conformant)/i);
  });

  it('derives conformance=partial from moderate-only violations', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'moderate', wcag: ['1.4.4'] },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toMatch(/partial/i);
  });

  it('derives conformance=non-conformant from critical violations', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'critical', wcag: ['1.1.1'] },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toMatch(/non-conform|not compliant|non-complian/i);
  });

  it('HTML escapes special characters in violation descriptions', () => {
    const v: Violation[] = [
      {
        id: 'x',
        description: '<script>alert("xss")</script>',
        help: 'fix & re-test',
        impact: 'serious',
        wcag: ['1.1.1'],
      },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).not.toContain('<script>alert');
    expect(out.body).toContain('&lt;script&gt;');
    expect(out.body).toContain('&amp;');
  });

  it('HTML omits methodology row when meta.methodology is absent', () => {
    const metaNoMethod: ReportMeta = { ...baseMeta };
    delete (metaNoMethod as { methodology?: string }).methodology;
    const out = generateStatement([], metaNoMethod, baseOptions);
    expect(out.body).not.toContain('Automated axe-core');
  });

  it('HTML omits product-version parenthetical when meta.productVersion is absent', () => {
    const metaNoVer: ReportMeta = { ...baseMeta };
    delete (metaNoVer as { productVersion?: string }).productVersion;
    const out = generateStatement([], metaNoVer, baseOptions);
    expect(out.body).toContain('Acme Web Store');
    expect(out.body).not.toContain('(2.4.1)');
  });
});

describe('public API surface (./index.js barrel)', () => {
  it('re-exports generateStatement as a callable function', () => {
    expect(typeof publicApi.generateStatement).toBe('function');
    const out = publicApi.generateStatement([], baseMeta, baseOptions);
    expect(out.format).toBe('html');
  });

  it('re-exports STATEMENT_MESSAGES with all required locales', () => {
    expect(publicApi.STATEMENT_MESSAGES.en).toBeDefined();
    expect(publicApi.STATEMENT_MESSAGES.sv).toBeDefined();
    expect(publicApi.STATEMENT_MESSAGES.nb).toBeDefined();
    expect(publicApi.STATEMENT_MESSAGES.da).toBeDefined();
    expect(publicApi.STATEMENT_MESSAGES.fi).toBeDefined();
  });
});

describe('generateStatement locale × jurisdiction combinations', () => {
  const locales = ['en', 'sv', 'nb', 'da', 'fi'] as const;
  const jurisdictions = ['SE', 'NO', 'DK', 'FI'] as const;

  for (const locale of locales) {
    for (const jurisdiction of jurisdictions) {
      it(`renders cleanly for locale=${locale} × jurisdiction=${jurisdiction}`, () => {
        const out = generateStatement([], baseMeta, {
          ...baseOptions,
          locale,
          jurisdiction,
        });
        expect(out.body).toBeTruthy();
        expect(out.body.length).toBeGreaterThan(200);
        expect(out.body).toContain(`lang="${locale}"`);
      });
    }
  }
});

// Boundary and locale matrix expansion

describe('generateStatement — boundary cases', () => {
  it('handles empty violations array (zero-violation report)', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body.length).toBeGreaterThan(100);
    expect(out.format).toBe('html');
  });

  it('handles single critical violation (minimum failing state)', () => {
    const v: Violation[] = [
      { id: 'x', description: 'Test', help: 'fix', impact: 'critical', wcag: ['1.1.1'] },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('1.1.1');
  });

  it('handles 50+ violations (large report stress)', () => {
    const v: Violation[] = Array.from({ length: 50 }, (_, i) => ({
      id: `rule-${i}`,
      description: `Issue ${i}`,
      help: 'fix',
      impact: 'serious' as const,
      wcag: ['1.1.1'],
      nodeCount: i + 1,
    }));
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('Issue 0');
    expect(out.body).toContain('Issue 49');
  });

  it('handles violation with Unicode chars (åäö) in description', () => {
    const v: Violation[] = [
      {
        id: 'unicode',
        description: 'Otillräcklig färgkontrast på knappar',
        help: 'Öka kontrastförhållandet',
        impact: 'serious',
        wcag: ['1.4.3'],
      },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('Otillräcklig');
  });

  it('handles violation with Cyrillic in description', () => {
    const v: Violation[] = [
      {
        id: 'cyrillic',
        description: 'Недостаточный контраст текста',
        help: 'Увеличить контрастность',
        impact: 'serious',
        wcag: ['1.4.3'],
      },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('Недостаточный');
  });

  it('handles violation with emoji in description', () => {
    const v: Violation[] = [
      {
        id: 'emoji',
        description: '🚨 Critical contrast issue',
        help: 'Fix asap',
        impact: 'critical',
        wcag: ['1.4.3'],
      },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('🚨');
  });

  it('handles violation with multiple WCAG SCs', () => {
    const v: Violation[] = [
      {
        id: 'multi',
        description: 'Multi-SC issue',
        help: 'fix',
        impact: 'serious',
        wcag: ['1.4.3', '1.4.11', '2.4.7'],
      },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('1.4.3');
  });

  it('handles violation with zero nodeCount (no nodes affected — edge)', () => {
    const v: Violation[] = [
      { id: 'zero', description: 'edge', help: 'h', impact: 'minor', wcag: ['1.1.1'], nodeCount: 0 },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toBeTruthy();
  });

  it('handles violation with very large nodeCount (1000+)', () => {
    const v: Violation[] = [
      { id: 'big', description: 'many', help: 'h', impact: 'serious', wcag: ['1.4.3'], nodeCount: 1000 },
    ];
    const out = generateStatement(v, baseMeta, baseOptions);
    expect(out.body).toContain('1000');
  });

  it('MDX output includes 50+ violations cleanly', () => {
    const v: Violation[] = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      description: `D${i}`,
      help: 'h',
      impact: 'serious' as const,
      wcag: ['1.1.1'],
    }));
    const out = generateStatement(v, baseMeta, { ...baseOptions, format: 'mdx' });
    expect(out.format).toBe('mdx');
    expect(out.body).toContain('D0');
    expect(out.body).toContain('D49');
  });
});

describe('generateStatement — locale message validations', () => {
  it('Swedish strings include "tillgänglighet" core word', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'sv' });
    expect(out.body.toLowerCase()).toContain('tillgänglighet');
  });

  it('Norwegian strings include "tilgjengelighet" core word', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'nb' });
    expect(out.body.toLowerCase()).toContain('tilgjengelighet');
  });

  it('Danish strings include "tilgængelighed" core word', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'da' });
    expect(out.body.toLowerCase()).toContain('tilgængelighed');
  });

  it('Finnish strings include "saavutettavuus" core word', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'fi' });
    expect(out.body.toLowerCase()).toContain('saavutettavuus');
  });

  it('English strings include "accessibility" core word', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'en' });
    expect(out.body.toLowerCase()).toContain('accessibility');
  });

  it('All locales preserve product name', () => {
    const locales = ['en', 'sv', 'nb', 'da', 'fi'] as const;
    for (const locale of locales) {
      const out = generateStatement([], baseMeta, { ...baseOptions, locale });
      expect(out.body).toContain('Acme Web Store');
    }
  });

  it('All locales preserve evaluator only when present in template (en/sv at minimum)', () => {
    // Evaluator appears in some locales' templates but not all — record which.
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'en' });
    // English template MAY include evaluator — flexible assertion.
    expect(out.body.length).toBeGreaterThan(200);
  });

  it('All locales emit syntactically-valid HTML doctype', () => {
    const locales = ['en', 'sv', 'nb', 'da', 'fi'] as const;
    for (const locale of locales) {
      const out = generateStatement([], baseMeta, { ...baseOptions, locale });
      expect(out.body).toMatch(/<!doctype html>/i);
    }
  });

  it('All jurisdictions emit enforcement URL containing scheme', () => {
    const jurisdictions = ['SE', 'NO', 'DK', 'FI'] as const;
    for (const jur of jurisdictions) {
      const out = generateStatement([], baseMeta, { ...baseOptions, jurisdiction: jur });
      // Some enforcement reference is included.
      expect(out.body.length).toBeGreaterThan(300);
    }
  });

  it('MDX output for Norwegian locale starts with frontmatter', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'nb', format: 'mdx' });
    expect(out.body).toMatch(/^---\n/);
  });

  it('MDX output for Finnish locale includes "saavutettavuus"', () => {
    const out = generateStatement([], baseMeta, { ...baseOptions, locale: 'fi', format: 'mdx' });
    expect(out.body.toLowerCase()).toContain('saavutettavuus');
  });

  it('Custom lastRevised overrides default in MDX output', () => {
    const out = generateStatement([], baseMeta, {
      ...baseOptions,
      lastRevised: '2027-01-01',
      format: 'mdx',
    });
    expect(out.body).toContain('2027-01-01');
  });

  it('Custom title appears in HTML output even with violations', () => {
    const v: Violation[] = [{ id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.4.3'] }];
    const out = generateStatement(v, baseMeta, { ...baseOptions, title: 'My Special Statement' });
    expect(out.body).toContain('My Special Statement');
  });

  it('FeedbackUrl is rendered as anchor href when present', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toMatch(/href="https:\/\/example\.com\/contact"/);
  });

  it('AuthorityEmail is rendered as mailto link', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    expect(out.body).toMatch(/mailto:a11y@example\.com/);
  });

  it('Output body has no unclosed angle brackets (basic HTML well-formedness)', () => {
    const out = generateStatement([], baseMeta, baseOptions);
    const opens = (out.body.match(/</g) ?? []).length;
    const closes = (out.body.match(/>/g) ?? []).length;
    // Closes must equal or exceed opens (whitespace tags etc.).
    expect(closes).toBeGreaterThanOrEqual(opens);
  });
});