import assert from 'node:assert/strict';
import test from 'node:test';

import { createPayloadPluginConfig, createPayloadScanRequest, resolvePayloadPreviewUrl } from '../dist/index.js';

test('resolves a Payload preview URL directly', () => {
  assert.equal(resolvePayloadPreviewUrl({ previewUrl: 'https://preview.example.test/post' }), 'https://preview.example.test/post');
});

test('creates a Payload scan request from collection config', () => {
  const config = createPayloadPluginConfig('posts', { baseUrl: 'https://site.example.test' });
  assert.deepEqual(createPayloadScanRequest({ slug: 'hello' }, config), {
    domains: ['accessibility'],
    source: 'payload.posts',
    url: 'https://site.example.test/hello',
  });
});
