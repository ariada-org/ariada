// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildAriadaScanCommand, renderXdSelectionHtml } from '../src/adapter.mjs';

test('renders an Adobe XD selection fixture as a scan-ready HTML export', async () => {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/xd-selection.json', import.meta.url), 'utf8'));
  const html = renderXdSelectionHtml(fixture);

  assert.match(html, /Launch accessibility evidence from Adobe XD/);
  assert.match(html, /<button class="xd-node xd-button"/);
  assert.match(html, /<img class="xd-node xd-image"/);
  assert.doesNotMatch(html, /<img[^>]+alt=/);
});

test('builds an Ariada CLI scan command instead of running local rule logic', () => {
  const command = buildAriadaScanCommand({
    cliPath: '/repo/packages/ariada-cli/dist/bin.js',
    outputDir: '/tmp/ariada-output',
    url: 'http://127.0.0.1:4400/',
  });

  assert.deepEqual(command.slice(1, 6), [
    '/repo/packages/ariada-cli/dist/bin.js',
    'scan',
    'http://127.0.0.1:4400/',
    '--format',
    'both',
  ]);
  assert.equal(command.includes('--severity-threshold'), true);
});

test('adapter source contains no contrast implementation', async () => {
  const source = await readFile(new URL('../src/adapter.mjs', import.meta.url), 'utf8');

  assert.equal(/contrastRatio|luminance|relative luminance|WCAG formula/i.test(source), false);
});
