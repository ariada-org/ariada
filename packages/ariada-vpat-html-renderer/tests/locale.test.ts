// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale } from '../src/locales.js';
import type { LocaleDictionary } from '../src/types.js';

describe('resolveLocale', () => {
  it('returns the exact match when locale is supported', () => {
    const { locale, fallback } = resolveLocale('en');
    expect(locale).toBe('en');
    expect(fallback).toBeUndefined();
  });

  it('falls back to default for unknown locale and reports fallback code', () => {
    const { locale, fallback } = resolveLocale('xx');
    expect(locale).toBe(DEFAULT_LOCALE);
    expect(fallback).toBe('xx');
  });

  it('falls back to base tag for BCP 47 regional code', () => {
    const { locale, fallback } = resolveLocale('sv-SE');
    expect(locale).toBe('sv');
    expect(fallback).toBe('sv-se');
  });

  // eslint-disable-next-line vitest/expect-expect -- assertions are inside expectShapeIsComplete helper
  it('returns a dictionary with all required keys', () => {
    for (const code of SUPPORTED_LOCALES) {
      const { i18n } = resolveLocale(code);
      expectShapeIsComplete(i18n);
    }
  });

  it('returns en for undefined input', () => {
    const { locale } = resolveLocale(undefined);
    expect(locale).toBe('en');
  });
});

function expectShapeIsComplete(dict: LocaleDictionary): void {
  expect(typeof dict.skipLink).toBe('string');
  expect(typeof dict.title).toBe('string');
  expect(typeof dict.headings.cover).toBe('string');
  expect(typeof dict.headings.standards).toBe('string');
  expect(typeof dict.headings.toc).toBe('string');
  expect(typeof dict.headings.summary).toBe('string');
  expect(typeof dict.headings.wcagTable).toBe('string');
  expect(typeof dict.headings.fpc).toBe('string');
  expect(typeof dict.headings.hardware).toBe('string');
  expect(typeof dict.headings.software).toBe('string');
  expect(typeof dict.headings.documentation).toBe('string');
  expect(typeof dict.headings.footer).toBe('string');
  expect(typeof dict.tableColumns.criterion).toBe('string');
  expect(typeof dict.tableColumns.name).toBe('string');
  expect(typeof dict.tableColumns.level).toBe('string');
  expect(typeof dict.tableColumns.status).toBe('string');
  expect(typeof dict.tableColumns.remarks).toBe('string');
  expect(typeof dict.status.supports).toBe('string');
  expect(typeof dict.status.partiallySupports).toBe('string');
  expect(typeof dict.status.doesNotSupport).toBe('string');
  expect(typeof dict.status.notApplicable).toBe('string');
  expect(typeof dict.status.notEvaluated).toBe('string');
  expect(typeof dict.meta.product).toBe('string');
  expect(typeof dict.meta.version).toBe('string');
  expect(typeof dict.meta.evaluator).toBe('string');
  expect(typeof dict.meta.contact).toBe('string');
  expect(typeof dict.meta.evaluationDate).toBe('string');
  expect(typeof dict.meta.scope).toBe('string');
  expect(typeof dict.meta.methodology).toBe('string');
  expect(typeof dict.meta.contactNotProvided).toBe('string');
  expect(typeof dict.freshnessWarning).toBe('string');
  expect(typeof dict.notApplicableJustification).toBe('string');
  expect(typeof dict.aaaToggle).toBe('string');
  expect(typeof dict.emptyCriteriaWarning).toBe('string');
  expect(typeof dict.generatedBy).toBe('string');
  expect(typeof dict.maintainedBy).toBe('string');
  expect(typeof dict.licenceNotice).toBe('string');
  expect(typeof dict.summaryNarrative).toBe('string');
}
