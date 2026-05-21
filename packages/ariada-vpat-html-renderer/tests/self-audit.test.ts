// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Self-audit: eat-our-own-dog-food. The rendered VPAT must itself satisfy
// the WCAG 2.2 AA tagging discipline that the @ariada-org/core-engine scanner
// emits. We run a fast structural / static analysis here. The heavier
// axe-core + Playwright integration lives in tests/axe-zero-violations
// (added separately as part of the eaa-pipeline e2e suite).
//
// The checks below cover the spec acceptance subset that can be
// verified without a browser:
// * exactly one <h1>; no skipped heading levels
// * skip link exists and targets #main
// * <main id="main"> + <header role="banner"> + <footer role="contentinfo">
// + <nav role="navigation"> present
// * no inline JS / no external <script src> / no external <link rel="stylesheet">
// * status indicators always carry text label, not colour-only
// * <html lang> present
// * <meta charset> + viewport present
//
// Additional axe-core run via @ariada-org/core-engine analyser fan-out can be
// wired later behind a separate test command; tests here are guaranteed
// to run in plain Node without browser deps.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderVpatHtml } from '../src/render-vpat-html.js';
import type { VpatReport } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadMinimal(): VpatReport {
 return JSON.parse(
 readFileSync(path.join(__dirname, 'fixtures', 'minimal-vpat-2.5.json'), 'utf-8'),
) as VpatReport;
}

function countMatches(html: string, re: RegExp): number {
 return html.match(re)?.length ?? 0;
}

describe('renderVpatHtml — self-audit (spec)', () => {
 const html = renderVpatHtml(loadMinimal(), {
 locale: 'en',
 generationTimestamp: '2026-05-19T00:00:00Z',
 });

 it('declares <!DOCTYPE html>', () => {
 expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
 });

 it('declares <html lang="..."> non-empty', () => {
 expect(html).toMatch(/<html lang="[a-z-]+"/);
 });

 it('declares <meta charset="utf-8"> and viewport', () => {
 expect(html).toContain('<meta charset="utf-8">');
 expect(html).toMatch(/<meta name="viewport"/);
 });

 it('has exactly one <h1>', () => {
 expect(countMatches(html, /<h1[\s>]/g)).toBe(1);
 });

 it('does not skip heading levels (no <h3> before any <h2>)', () => {
 const firstH2 = html.search(/<h2[\s>]/);
 const firstH3 = html.search(/<h3[\s>]/);
 if (firstH3 !== -1) {
 expect(firstH2).toBeLessThan(firstH3);
 }
 });

 it('skip link exists targeting #main', () => {
 expect(html).toMatch(/<a href="#main" class="skip-link">/);
 });

 it('has <main id="main">', () => {
 expect(html).toMatch(/<main id="main"/);
 });

 it('has banner / navigation / contentinfo landmarks', () => {
 expect(html).toMatch(/<header role="banner">/);
 expect(html).toMatch(/role="navigation"/);
 expect(html).toMatch(/<footer role="contentinfo">/);
 });

 it('contains no inline JS (no <script> outside JSON-LD)', () => {
 // The only allowed <script> is the application/ld+json structured-data
 // block. Any other <script> tag is a violation.
 const allScripts = html.match(/<script\b[^>]*>/g) ?? [];
 for (const tag of allScripts) {
 expect(tag).toMatch(/type="application\/ld\+json"/);
 }
 });

 it('contains no external stylesheet <link rel="stylesheet">', () => {
 expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
 });

 it('contains no on*= inline event handlers', () => {
 expect(html).not.toMatch(/\son[a-z]+\s*=\s*['"]/i);
 });

 it('contains no external <script src>', () => {
 expect(html).not.toMatch(/<script[^>]+src=/);
 });

 it('every status badge carries a textual status label (no colour-only)', () => {
 // Every <span class="status-label"> ... </span> must be non-empty.
 const labels = [...html.matchAll(/<span class="status-label">([^<]*)<\/span>/g)];
 expect(labels.length).toBeGreaterThan(0);
 for (const [, text] of labels) {
 expect(text?.trim().length ?? 0).toBeGreaterThan(0);
 }
 });

 it('status rows carry both a symbol and a text label (WCAG 1.4.1)', () => {
 expect(html).toMatch(/aria-hidden="true" class="status-symbol"/);
 expect(html).toContain('class="status-label"');
 });

 it('table headers use scope= attribute (WCAG 1.3.1)', () => {
 expect(html).toMatch(/scope="col"/);
 expect(html).toMatch(/scope="row"/);
 });

 it('external links carry rel="noopener noreferrer"', () => {
 const externalLinks = [...html.matchAll(/<a href="https?:\/\/[^"]+"([^>]*)>/g)];
 expect(externalLinks.length).toBeGreaterThan(0);
 for (const [tag, attrs] of externalLinks) {
 expect(`${tag} ${attrs}`).toMatch(/rel="noopener noreferrer"/);
 }
 });

 it('rendered HTML is at least 10 KB (AC-1)', () => {
 expect(Buffer.byteLength(html, 'utf-8')).toBeGreaterThanOrEqual(10 * 1024);
 });

 it('rendered HTML is below the 500 KB envelope without brand SVG (AC-12)', () => {
 expect(Buffer.byteLength(html, 'utf-8')).toBeLessThan(500 * 1024);
 });
});
