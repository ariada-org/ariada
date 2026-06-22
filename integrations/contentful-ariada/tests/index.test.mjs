import assert from 'node:assert/strict';
import test from 'node:test';

import { createContentfulScanRequest, normalizeFindings, resolveContentfulPreviewUrl } from '../dist/index.js';

test('resolves preview URL from a Contentful field', () => {
  assert.equal(resolveContentfulPreviewUrl({ fields: { previewUrl: 'https://preview.example.test/page' } }), 'https://preview.example.test/page');
});

test('builds an Ariada hosted scan request', () => {
  assert.deepEqual(createContentfulScanRequest('https://preview.example.test/page'), {
    domains: ['accessibility'],
    severityThreshold: 'serious',
    source: 'contentful.entry-preview',
    url: 'https://preview.example.test/page',
  });
});

test('normalizes API findings for editor display', () => {
  assert.deepEqual(normalizeFindings({ findings: [{ id: 'axe/image-alt', message: 'Image needs alt', severity: 'critical' }] }), [
    { message: 'Image needs alt', ruleId: 'axe/image-alt', severity: 'critical' },
  ]);
});
