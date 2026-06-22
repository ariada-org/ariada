// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { backstagePluginId, renderFindingsCard, summarizeForCatalogCard } from '../src/index.js';

describe('Backstage Ariada findings card', () => {
  it('declares a stable plugin id', () => {
    expect(backstagePluginId).toBe('ariada');
  });

  it('renders a catalog-card summary from a mocked scan payload', () => {
    const summary = {
      entityRef: 'component:default/docs-site',
      score: 91,
      status: 'warn' as const,
      critical: 0,
      serious: 1,
      moderate: 2,
      minor: 4,
      reportUrl: 'https://ariada.example/reports/123',
    };

    expect(summarizeForCatalogCard(summary)).toContain('7 findings');
    expect(renderFindingsCard(summary)).toContain('Ariada accessibility');
    expect(renderFindingsCard(summary)).toContain('Open report');
  });
});
