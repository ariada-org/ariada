// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Locale loader. Static imports of the bundled JSON dictionaries so the
// renderer ships with no filesystem dependency at runtime.
//
// RTL POC: `ar` (Arabic) ships
// as a machine-translated stub. Other RTL locales (he, fa, ur) are NOT
// shipped with dictionaries — they fall back to en but still render
// `dir="rtl"` per `isRtlLocale()` below.

import ar from './locales/ar.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import sv from './locales/sv.json' with { type: 'json' };
import type { LocaleDictionary } from './types.js';

const DICTIONARIES: Readonly<Record<string, LocaleDictionary>> = Object.freeze({
 en: en as LocaleDictionary,
 sv: sv as LocaleDictionary,
 de: de as LocaleDictionary,
 ar: ar as LocaleDictionary,
});

export const SUPPORTED_LOCALES: ReadonlyArray<string> = Object.freeze(['en', 'sv', 'de', 'ar']);

/**
 * BCP-47 base tags whose script is written right-to-left. The renderer
 * emits `dir="rtl"` on `<html>` for these locales (and their regional
 * variants like `ar-EG`, `he-IL`, `fa-IR`). For unsupported RTL locales
 * (e.g. `he` with no dictionary) the renderer still emits `dir="rtl"`
 * but falls back to the `en` dictionary — the visual direction is
 * correct even if the strings aren't translated.
 */
const RTL_LOCALES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Return true if `locale` (post-resolution) is written right-to-left.
 * Accepts both base tags (`ar`) and regional codes (`ar-EG`).
 */
export function isRtlLocale(locale: string): boolean {
 const base = locale.toLowerCase().split('-')[0] ?? '';
 return RTL_LOCALES.has(base);
}

export const DEFAULT_LOCALE = 'en';

/**
 * Resolve a locale to its dictionary. Returns the dictionary plus the
 * resolved locale code (which may differ from the requested code if a
 * fallback was applied).
 */
export function resolveLocale(requested: string | undefined): {
 readonly locale: string;
 readonly i18n: LocaleDictionary;
 readonly fallback: string | undefined;
} {
 const key = (requested ?? DEFAULT_LOCALE).toLowerCase();
 const direct = DICTIONARIES[key];
 if (direct !== undefined) {
 return { locale: key, i18n: direct, fallback: undefined };
 }
 // BCP 47 base-tag fallback (e.g. `sv-SE` → `sv`).
 const base = key.split('-')[0];
 if (base !== undefined && base !== key) {
 const baseDict = DICTIONARIES[base];
 if (baseDict !== undefined) {
 return { locale: base, i18n: baseDict, fallback: key };
 }
 }
 const fallbackDict = DICTIONARIES[DEFAULT_LOCALE];
 // `en` is statically imported and guaranteed present; assert non-null for
 // strict-mode type narrowing.
 if (fallbackDict === undefined) {
 throw new Error('Default locale dictionary missing — packaging bug');
 }
 return { locale: DEFAULT_LOCALE, i18n: fallbackDict, fallback: key };
}
