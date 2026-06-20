// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { RulePack } from '../types.js';

/**
 * `oss-surface` overlay — applied to public open-source surfaces (GitHub repo,
 * the public-interest site, the docs site). Forbids commercial cross-promo,
 * patent disclosures, and internal AI-orchestration codenames. Composes on top
 * of the shared `no-secrets` pack.
 */
export const ossSurfacePack: RulePack = {
  id: 'oss-surface',
  description: 'Commercial / patent / internal-codename content forbidden on OSS surfaces.',
  rules: [
    {
      id: 'commercial-domains',
      description: 'Commercial product domains (cross-promo)',
      action: 'fail',
      category: 'commercial-crosspromo',
      patterns: [
        '\\bariada\\.ai\\b',
        '\\bblamer\\.ai\\b',
        '\\bclamper\\.ai\\b',
        '\\breverter\\.ai\\b',
        '\\bdraculascan\\.com\\b',
      ],
    },
    {
      id: 'patent-app-numbers',
      description: 'Bare USPTO application numbers',
      action: 'fail',
      category: 'patent',
      patterns: ['64/0\\d{2},\\d{3}'],
    },
    {
      id: 'agent-codenames',
      description: 'Internal AI-orchestration scientist codenames',
      action: 'fail',
      category: 'internal-codename',
      // Word-boundary anchored so prose like "gauss" inside another word is safe.
      patterns: [
        '\\b(GAUSS|EULER|RIEMANN|GALOIS|NOETHER|DIRAC|FEYNMAN|LEIBNIZ|HILBERT|TURING|RAMANUJAN|POINCARE|HYPATIA|DIRICHLET)\\b',
      ],
    },
    {
      id: 'ai-coauthor',
      description: 'AI co-authorship trailer',
      action: 'fail',
      category: 'ai-authorship',
      patterns: ['Co-Authored-By:\\s*(Claude|Anthropic)', 'Generated with .*Claude'],
    },
  ],
};
