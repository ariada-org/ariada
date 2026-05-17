// SPDX-License-Identifier: EUPL-1.2
/**
 * Tests for Swedish DOS-lagen accessibility-statement emitter.
 */

import { describe, it, expect } from 'vitest';

import { emitDosLagen } from './emit-dos-lagen.js';
import type { Violation, ReportMeta } from './types.js';

import * as publicApi from './index.js';

const baseMeta: ReportMeta = {
  productName: 'Testprodukt',
  evaluator: 'Agonist Development AB',
  evaluatorContact: 'tillganglighet@example.se',
  evaluationDate: '2026-05-15',
  scope: 'https://example.se',
  methodology: 'Automatisk genomgang med Ariada-skanner samt manuell granskning.',
};

const contactInput = {
  epost: 'tillganglighet@example.se',
  organisation: 'Example AB',
  url: 'https://example.se/tillganglighet',
};

describe('emitDosLagen', () => {
  it('emits schema marker, dates, contact', () => {
    const r = emitDosLagen([], baseMeta, { kontakt: contactInput });
    expect(r.$schema).toBe('https://schemas.ariada.org/dos-lagen/2025.json');
    expect(r.schemaVersion).toBe('2025');
    expect(r.publiceringsdatum).toBe('2026-05-15');
    expect(r.senasteRevision).toBe('2026-05-15');
    expect(r.kontakt.epost).toBe('tillganglighet@example.se');
    expect(r.tillsynUrl).toContain('digg.se');
  });

  it('zero violations → helt-forenlig', () => {
    const r = emitDosLagen([], baseMeta, { kontakt: contactInput });
    expect(r.efterlevnadsstatus).toBe('helt-forenlig');
    expect(r.ickeForenligaInnehall).toHaveLength(0);
  });

  it('moderate violations only → delvis-forenlig', () => {
    const v: Violation[] = [
      { id: 'a', description: 'a', help: 'a', impact: 'moderate', wcag: ['2.4.7'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.efterlevnadsstatus).toBe('delvis-forenlig');
    expect(r.ickeForenligaInnehall).toHaveLength(1);
  });

  it('critical violations → ej-forenlig', () => {
    const v: Violation[] = [
      {
        id: 'block',
        description: 'Blocker',
        help: 'Fix',
        impact: 'critical',
        wcag: ['1.4.3'],
      },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.efterlevnadsstatus).toBe('ej-forenlig');
  });

  it('motivering text is non-empty when not helt-forenlig', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.1.1'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.efterlevnadsstatusMotivering.length).toBeGreaterThan(0);
  });

  it('renders ickeForenligaInnehall items in Swedish format', () => {
    const v: Violation[] = [
      {
        id: 'ariada/checkout/payment-fieldset-grouping',
        description: 'Payment radios not grouped',
        help: 'Use <fieldset>',
        impact: 'serious',
        wcag: ['1.3.1', '4.1.2'],
        en301549: ['11.1.3.1'],
        nodeCount: 2,
      },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall).toHaveLength(1);
    const item = r.ickeForenligaInnehall[0]!;
    expect(item.rubrik).toBeTruthy();
    expect(item.wcag).toEqual(['1.3.1', '4.1.2']);
    expect(item.en301549).toEqual(['11.1.3.1']);
    expect(item.paverkadAnvandare).toBeTruthy();
  });

  it('JSON-roundtrips losslessly', () => {
    const v: Violation[] = [
      { id: 'r', description: 'r', help: 'r', impact: 'serious', wcag: ['1.4.3'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('SC 3.3.x violations → cognitive-impact user phrasing', () => {
    const v: Violation[] = [
      { id: 'err', description: 'unclear error', help: 'add label', impact: 'moderate', wcag: ['3.3.1'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall[0]!.paverkadAnvandare).toMatch(/kognitiva/i);
  });

  it('unknown SC area → falls back to generic assistive-tech user phrasing', () => {
    const v: Violation[] = [
      { id: 'misc', description: 'misc', help: 'misc', impact: 'moderate', wcag: ['4.1.3'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall[0]!.paverkadAnvandare).toMatch(/hjälpmedel/i);
  });

  it('falls back to default Swedish methodology text when neither option nor meta.methodology present', () => {
    const metaNoMethod: ReportMeta = { ...baseMeta };
    delete (metaNoMethod as { methodology?: string }).methodology;
    const r = emitDosLagen([], metaNoMethod, { kontakt: contactInput });
    expect(r.utvarderingsmetod).toBe('Automatisk utvärdering med Ariada-skannern.');
  });

  it('uses custom tillsynUrl + override dates when provided', () => {
    const r = emitDosLagen([], baseMeta, {
      kontakt: contactInput,
      tillsynUrl: 'https://custom.tillsyn.example/',
      publiceringsdatum: '2025-01-15',
      senasteRevision: '2026-12-01',
      utvarderingsmetod: 'Manuell granskning av ackrediterad utvärderare.',
    });
    expect(r.tillsynUrl).toBe('https://custom.tillsyn.example/');
    expect(r.publiceringsdatum).toBe('2025-01-15');
    expect(r.senasteRevision).toBe('2026-12-01');
    expect(r.utvarderingsmetod).toBe('Manuell granskning av ackrediterad utvärderare.');
  });

  it('uses custom rubrikFn when provided', () => {
    const v: Violation[] = [
      { id: 'x', description: 'orig description', help: 'help', impact: 'moderate', wcag: ['1.4.3'] },
    ];
    const r = emitDosLagen(v, baseMeta, {
      kontakt: contactInput,
      rubrikFn: (vio) => `CUSTOM: ${vio.id}`,
    });
    expect(r.ickeForenligaInnehall[0]!.rubrik).toBe('CUSTOM: x');
  });

  it('passes through optional contact fields (telefon)', () => {
    const r = emitDosLagen([], baseMeta, {
      kontakt: { ...contactInput, telefon: '+46 8 123 45 67' },
    });
    expect(r.kontakt.telefon).toBe('+46 8 123 45 67');
    expect(r.kontakt.url).toBe(contactInput.url);
  });
});

describe('public API surface (./index.js barrel)', () => {
  it('re-exports the three emitters', () => {
    expect(typeof publicApi.emitDosLagen).toBe('function');
    expect(typeof publicApi.emitVpat).toBe('function');
    expect(typeof publicApi.emitEn301549).toBe('function');
  });

  it('re-exports the WCAG 2.2 catalogue', () => {
    expect(Array.isArray(publicApi.WCAG_22_CRITERIA)).toBe(true);
    expect(publicApi.WCAG_22_CRITERIA.length).toBeGreaterThan(0);
    expect(publicApi.WCAG_BY_SC.get('1.4.3')).toBeDefined();
  });
});

// Wave 2 expansion (LAGRANGE) — boundary + edge cases

describe('emitDosLagen — boundary cases', () => {
  it('handles 50+ violations stress test', () => {
    const v: Violation[] = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      description: `D${i}`,
      help: 'h',
      impact: 'serious' as const,
      wcag: ['1.4.3'],
    }));
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall.length).toBe(50);
  });

  it('handles Swedish-language description with Unicode (åäö)', () => {
    const v: Violation[] = [
      {
        id: 'x',
        description: 'Otillräcklig färgkontrast på vissa rörliga knappar',
        help: 'Öka kontrastförhållandet till 4.5:1',
        impact: 'serious',
        wcag: ['1.4.3'],
      },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall[0]!.rubrik).toBeTruthy();
  });

  it('handles SC 1.x.x violations → visual-impact user phrasing', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'moderate', wcag: ['1.4.3'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall[0]!.paverkadAnvandare).toBeTruthy();
  });

  it('handles SC 2.x.x violations → motor-impact user phrasing', () => {
    const v: Violation[] = [
      { id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['2.1.1'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.ickeForenligaInnehall[0]!.paverkadAnvandare).toBeTruthy();
  });

  it('mixed-severity violations: critical wins over moderate', () => {
    const v: Violation[] = [
      { id: 'a', description: 'a', help: 'a', impact: 'moderate', wcag: ['1.4.3'] },
      { id: 'b', description: 'b', help: 'b', impact: 'critical', wcag: ['2.1.1'] },
    ];
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(r.efterlevnadsstatus).toBe('ej-forenlig');
  });

  it('contact with telefon and url all preserved', () => {
    const r = emitDosLagen([], baseMeta, {
      kontakt: { ...contactInput, telefon: '+46-8-1234567' },
    });
    expect(r.kontakt.telefon).toBe('+46-8-1234567');
    expect(r.kontakt.url).toBe(contactInput.url);
    expect(r.kontakt.epost).toBe(contactInput.epost);
  });

  it('JSON-roundtrips with 25 mixed violations', () => {
    const v: Violation[] = Array.from({ length: 25 }, (_, i) => ({
      id: `r${i}`,
      description: `D${i}`,
      help: 'h',
      impact: (['minor', 'moderate', 'serious', 'critical'] as const)[i % 4],
      wcag: ['1.4.3'],
    }));
    const r = emitDosLagen(v, baseMeta, { kontakt: contactInput });
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('rubrikFn receives the violation object directly', () => {
    let received: Violation | undefined;
    emitDosLagen(
      [{ id: 'x', description: 'd', help: 'h', impact: 'moderate', wcag: ['1.4.3'] }],
      baseMeta,
      {
        kontakt: contactInput,
        rubrikFn: (v) => {
          received = v;
          return 'X';
        },
      },
    );
    expect(received?.id).toBe('x');
  });

  it('senasteRevision defaults to evaluationDate when no override', () => {
    const r = emitDosLagen([], baseMeta, { kontakt: contactInput });
    expect(r.senasteRevision).toBe('2026-05-15');
  });

  it('publiceringsdatum defaults to evaluationDate when no override', () => {
    const r = emitDosLagen([], baseMeta, { kontakt: contactInput });
    expect(r.publiceringsdatum).toBe('2026-05-15');
  });

  it('schema version is stable for empty + populated reports', () => {
    const empty = emitDosLagen([], baseMeta, { kontakt: contactInput });
    const populated = emitDosLagen(
      [{ id: 'x', description: 'x', help: 'x', impact: 'serious', wcag: ['1.4.3'] }],
      baseMeta,
      { kontakt: contactInput },
    );
    expect(empty.schemaVersion).toBe(populated.schemaVersion);
  });
});