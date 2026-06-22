import assert from 'node:assert/strict';
import test from 'node:test';

import { countSanityFindings, createSanityScanPanel, resolveSanityPreviewUrl } from '../dist/index.js';

test('resolves a Sanity preview URL directly', () => {
  assert.equal(resolveSanityPreviewUrl({ previewUrl: 'https://preview.example.test/article' }), 'https://preview.example.test/article');
});

test('resolves a Sanity preview URL from slug and base URL', () => {
  assert.equal(resolveSanityPreviewUrl({ slug: { current: 'news' } }, { baseUrl: 'https://preview.example.test' }), 'https://preview.example.test/news');
});

test('creates a Studio panel scan request', () => {
  assert.equal(createSanityScanPanel({ previewUrl: 'https://preview.example.test/a' }).request.source, 'sanity.document-preview');
  assert.equal(countSanityFindings({ findings: [{ id: 'a' }, { id: 'b' }] }), 2);
});
