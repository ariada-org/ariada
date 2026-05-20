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

describe('renderVpatHtml — golden snapshot', () => {
  it('matches the en-locale golden snapshot for minimal fixture', () => {
    const html = renderVpatHtml(loadMinimal(), {
      locale: 'en',
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toMatchSnapshot('minimal-en.html');
  });

  it('matches the sv-locale golden snapshot for minimal fixture', () => {
    const html = renderVpatHtml(loadMinimal(), {
      locale: 'sv',
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toMatchSnapshot('minimal-sv.html');
  });

  it('matches the de-locale golden snapshot for minimal fixture', () => {
    const html = renderVpatHtml(loadMinimal(), {
      locale: 'de',
      generationTimestamp: '2026-05-19T00:00:00Z',
    });
    expect(html).toMatchSnapshot('minimal-de.html');
  });
});
