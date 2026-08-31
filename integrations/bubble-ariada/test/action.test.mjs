import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAriadaResponse, runBubbleAriadaScan } from '../src/action.mjs';

test('normalizes Ariada hosted response into Bubble action values', () => {
  const result = normalizeAriadaResponse(
    {
      reportUrl: 'https://app.ariada.org/scans/demo',
      findings: [
        { id: 'statement', severity: 'serious' },
        { id: 'alt-text', severity: 'moderate' }
      ]
    },
    'https://example.com'
  );

  assert.equal(result.ok, false);
  assert.equal(result.findings_count, 2);
  assert.equal(result.serious_count, 1);
  assert.match(result.summary_text, /2 finding/);
  assert.match(result.findings_json, /statement/);
});

test('rejects Bubble action calls without an http URL', async () => {
  await assert.rejects(() => runBubbleAriadaScan({ url_to_scan: 'not-a-url' }), /requires an http/);
});
