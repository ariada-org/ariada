import assert from 'node:assert/strict';
import test from 'node:test';

import { createDirectusPanelState, resolveDirectusItemUrl } from '../dist/index.js';

test('resolves a Directus item URL', () => {
  assert.equal(resolveDirectusItemUrl({ slug: 'guides/accessibility' }, { baseUrl: 'https://site.example.test' }), 'https://site.example.test/guides/accessibility');
});

test('creates a Directus panel request', () => {
  assert.equal(createDirectusPanelState({ path: 'home' }, { baseUrl: 'https://site.example.test', slugField: 'path' }).request.source, 'directus.item-panel');
});
