import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildScanArgs, toRaycastItems } from '../dist/ariada.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/scan-result.json', import.meta.url), 'utf8'));

test('builds Ariada CLI scan args for Raycast command input', () => {
  assert.deepEqual(buildScanArgs('https://example.test'), ['scan', 'https://example.test', '--format', 'json']);
});

test('maps Ariada CLI JSON to Raycast list items', () => {
  const items = toRaycastItems(fixture);
  assert.equal(items[0].title, 'SERIOUS image-alt');
  assert.equal(items[0].actions[1].url, fixture.reportUrl);
});
