import assert from 'node:assert/strict';
import test from 'node:test';

import { createScanRequest, handleGhostPostPublished, selectGhostPostUrl } from '../src/index.js';

test('selects a rendered Ghost post URL from the webhook payload', () => {
  assert.equal(selectGhostPostUrl({ post: { current: { url: 'https://example.test/post/' } } }), 'https://example.test/post/');
});

test('builds an Ariada render-then-scan request', () => {
  assert.deepEqual(createScanRequest('https://example.test/post/'), {
    domains: ['accessibility'],
    severityThreshold: 'serious',
    source: 'ghost.post.published',
    url: 'https://example.test/post/',
  });
});

test('runs the scanner for post.published only', async () => {
  const result = await handleGhostPostPublished(
    { event: 'post.published', post: { current: { url: 'https://example.test/post/' } } },
    async (request) => ({ findings: [], scanned: request.url }),
  );
  assert.equal(result.report.scanned, 'https://example.test/post/');
});
