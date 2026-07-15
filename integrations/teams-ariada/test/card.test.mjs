import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildAdaptiveCard } from '../dist/card.js';
import { handleTeamsActivity, parseScanCommand } from '../dist/handler.js';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/scan-result.json', import.meta.url), 'utf8'),
);

test('builds an Adaptive Card from Ariada CLI JSON', () => {
  const card = buildAdaptiveCard(fixture);
  assert.equal(card.type, 'AdaptiveCard');
  assert.equal(card.body[0].text, 'Ariada accessibility gate: FAIL');
  assert.equal(card.body[1].facts[1].value, '2');
  assert.equal(card.actions[0].url, fixture.reportUrl);
});

test('parses a Teams scan command', () => {
  assert.deepEqual(parseScanCommand('/ariada scan https://example.test'), {
    url: 'https://example.test',
  });
});

test('handles posted scan results without hosting scanner logic', () => {
  const response = handleTeamsActivity({ value: fixture });
  assert.equal(response.body[0].text, 'Ariada accessibility gate: FAIL');
});
