import assert from 'node:assert/strict';
import test from 'node:test';

import { createStrapiScanRoute, resolveStrapiEntryUrl } from '../dist/index.js';

test('resolves a Strapi entry URL from content type base and slug', () => {
  assert.equal(
    resolveStrapiEntryUrl({ slug: 'about' }, { baseUrlByContentType: { page: 'https://site.example.test' }, contentType: 'page' }),
    'https://site.example.test/about',
  );
});

test('creates a Strapi server route body for Ariada', () => {
  const route = createStrapiScanRoute({ entry: { slug: 'about' }, options: { baseUrlByContentType: { page: 'https://site.example.test' }, contentType: 'page' } });
  assert.equal(route.body.source, 'strapi.page');
  assert.equal(route.body.url, 'https://site.example.test/about');
});
