// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * RTL (Right-to-Left) locale rendering tests — resolves master Testing
 * Strategy
 *
 * Verifies that:
 * 1. `locale: 'ar'` renders `dir="rtl"` AND uses Arabic dictionary strings.
 * 2. `locale: 'he'` (no dictionary shipped) renders `dir="rtl"` with
 * English fallback strings (visual direction correct, content English).
 * 3. `locale: 'en'` continues to render `dir="ltr"` (LTR regression).
 * 4. `locale: 'sv'` continues to render `dir="ltr"` (LTR regression).
 * 5. Regional RTL codes (`ar-EG`, `he-IL`, `fa-IR`, `ur-PK`) all render
 * `dir="rtl"`.
 * 6. `isRtlLocale` helper is deterministic + matches expectation per code.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isRtlLocale, SUPPORTED_LOCALES } from '../src/locales.js';
import { renderVpatHtml } from '../src/render-vpat-html.js';
import type { VpatReport } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadMinimal(): VpatReport {
 return JSON.parse(
 readFileSync(path.join(__dirname, 'fixtures', 'minimal-vpat-2.5.json'), 'utf-8'),
) as VpatReport;
}

describe('renderVpatHtml — RTL rendering', () => {
 it('emits dir="rtl" when locale=ar', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'ar',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="rtl"');
 expect(html).not.toContain('dir="ltr"');
 });

 it('includes Arabic translated strings in the body when locale=ar', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'ar',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 // "skip to main content" in Arabic
 expect(html).toContain('تخطي إلى المحتوى الرئيسي');
 // VPAT title in Arabic
 expect(html).toContain('نموذج إمكانية الوصول الطوعي للمنتج');
 });

 it('renders lang="ar" on <html> when locale=ar', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'ar',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('<html lang="ar" dir="rtl">');
 });

 it('emits dir="rtl" + lang="en" + locale-fallback meta when locale=he (no dictionary)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'he',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 // Direction RTL because Hebrew script is RTL...
 expect(html).toContain('dir="rtl"');
 // ...but lang fallback to en because no he.json shipped yet.
 expect(html).toContain('<html lang="en" dir="rtl">');
 // Fallback meta indicates the fallback path.
 expect(html).toContain('<meta name="ariada-locale-fallback" content="he→en">');
 });

 it('emits dir="rtl" + lang="en" for locale=fa (Persian/Farsi, no dictionary)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'fa',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('<html lang="en" dir="rtl">');
 });

 it('emits dir="rtl" + lang="en" for locale=ur (Urdu, no dictionary)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'ur',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('<html lang="en" dir="rtl">');
 });

 it('emits dir="rtl" for regional RTL code ar-EG (resolves to ar)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'ar-EG',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="rtl"');
 expect(html).toContain('<html lang="ar" dir="rtl">');
 });

 it('emits dir="rtl" for regional code he-IL (resolves to en dict + rtl direction)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'he-IL',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="rtl"');
 expect(html).toContain('lang="en"');
 });
});

describe('renderVpatHtml — LTR regression (must stay LTR)', () => {
 it('emits dir="ltr" when locale=en', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'en',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="ltr"');
 expect(html).not.toContain('dir="rtl"');
 });

 it('emits dir="ltr" when locale=sv', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'sv',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="ltr"');
 });

 it('emits dir="ltr" when locale=de', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'de',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="ltr"');
 });

 it('emits dir="ltr" when locale undefined (default = en)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="ltr"');
 });

 it('emits dir="ltr" for unknown non-RTL locale (e.g. fi → falls back to en)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'fi',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });
 expect(html).toContain('dir="ltr"');
 });
});

describe('isRtlLocale helper', () => {
 it('returns true for the 4 canonical RTL base codes', () => {
 expect(isRtlLocale('ar')).toBe(true);
 expect(isRtlLocale('he')).toBe(true);
 expect(isRtlLocale('fa')).toBe(true);
 expect(isRtlLocale('ur')).toBe(true);
 });

 it('returns true for regional RTL codes', () => {
 expect(isRtlLocale('ar-EG')).toBe(true);
 expect(isRtlLocale('ar-SA')).toBe(true);
 expect(isRtlLocale('he-IL')).toBe(true);
 expect(isRtlLocale('fa-IR')).toBe(true);
 expect(isRtlLocale('ur-PK')).toBe(true);
 });

 it('returns false for LTR locales', () => {
 expect(isRtlLocale('en')).toBe(false);
 expect(isRtlLocale('sv')).toBe(false);
 expect(isRtlLocale('de')).toBe(false);
 expect(isRtlLocale('en-US')).toBe(false);
 expect(isRtlLocale('sv-SE')).toBe(false);
 expect(isRtlLocale('zh')).toBe(false);
 expect(isRtlLocale('ja')).toBe(false);
 });

 it('returns false for empty string', () => {
 expect(isRtlLocale('')).toBe(false);
 });

 it('is case-insensitive', () => {
 expect(isRtlLocale('AR')).toBe(true);
 expect(isRtlLocale('Ar-eg')).toBe(true);
 expect(isRtlLocale('EN')).toBe(false);
 });
});

describe('SUPPORTED_LOCALES includes ar', () => {
 it('includes ar in the canonical list', () => {
 expect(SUPPORTED_LOCALES).toContain('ar');
 });

 it('total supported locales = 4 (en + sv + de + ar)', () => {
 expect(SUPPORTED_LOCALES).toHaveLength(4);
 expect([...SUPPORTED_LOCALES].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual([
 'ar',
 'de',
 'en',
 'sv',
 ]);
 });
});
