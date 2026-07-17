// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  backstagePluginId,
  renderFindingsCard,
  summarizeForCatalogCard,
} from '../dist/src/index.js';

test('declares a stable plugin id', () => {
  assert.equal(backstagePluginId, 'ariada');
});

test('renders a catalog-card summary from a mocked scan payload', () => {
  const summary = {
    entityRef: 'component:default/docs-site',
    score: 91,
    status: 'warn',
    critical: 0,
    serious: 1,
    moderate: 2,
    minor: 4,
    reportUrl: 'https://ariada.example/reports/123',
  };

  assert.match(summarizeForCatalogCard(summary), /7 findings/u);
  assert.match(renderFindingsCard(summary), /Ariada accessibility/u);
  assert.match(renderFindingsCard(summary), /Open report/u);
});
