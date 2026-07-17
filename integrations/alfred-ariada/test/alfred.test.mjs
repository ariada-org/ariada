import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildScanArgs, toAlfredItems } from '../scripts/script-filter.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/scan-result.json', import.meta.url), 'utf8'));

test('builds Ariada CLI args for Alfred keyword input', () => {
  assert.deepEqual(buildScanArgs('https://example.test'), ['scan', 'https://example.test', '--format', 'json']);
});

test('returns null for invalid Alfred input', () => {
  assert.equal(buildScanArgs('example'), null);
});

test('emits Alfred Script Filter JSON items', () => {
  const output = toAlfredItems(fixture);
  assert.equal(output.items[0].title, 'SERIOUS image-alt');
  assert.equal(output.items[0].arg, fixture.reportUrl);
});
