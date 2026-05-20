// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
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

describe('renderVpatHtml — reproducible builds', () => {
 it('produces byte-identical output for identical inputs + fixed timestamp', () => {
 const report = loadMinimal();
 const opts = { generationTimestamp: '2026-05-19T12:00:00Z', locale: 'en' };
 const a = renderVpatHtml(report, opts);
 const b = renderVpatHtml(report, opts);
 expect(a).toBe(b);
 expect(Buffer.byteLength(a, 'utf-8')).toBe(Buffer.byteLength(b, 'utf-8'));
 });

 it('produces different output when timestamp differs', () => {
 const report = loadMinimal();
 const a = renderVpatHtml(report, { generationTimestamp: '2026-05-19T12:00:00Z' });
 const b = renderVpatHtml(report, { generationTimestamp: '2026-05-19T12:00:01Z' });
 expect(a).not.toBe(b);
 });

 it('produces different output when locale differs', () => {
 const report = loadMinimal();
 const opts = { generationTimestamp: '2026-05-19T12:00:00Z' };
 const en = renderVpatHtml(report, { ...opts, locale: 'en' });
 const sv = renderVpatHtml(report, { ...opts, locale: 'sv' });
 expect(en).not.toBe(sv);
 });
});
