// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { RulePack } from '../types.js';

/**
 * Shared `no-secrets` pack — surface-agnostic. Catches credential patterns and
 * private filesystem paths that must never appear in any published content.
 * Imported by every surface profile.
 */
export const noSecretsPack: RulePack = {
  id: 'no-secrets',
  description: 'Credentials and internal filesystem paths — forbidden on any published surface.',
  rules: [
    {
      id: 'api-keys',
      description: 'API keys / tokens',
      action: 'fail',
      category: 'secret',
      patterns: [
        'sk-[a-zA-Z0-9]{20,}',
        'gh[oprs]_[a-zA-Z0-9]{20,}',
        'AKIA[A-Z0-9]{16}',
        'AIza[a-zA-Z0-9_-]{35}',
      ],
    },
    {
      id: 'internal-paths',
      description: 'Internal-only repository paths',
      action: 'fail',
      category: 'internal-path',
      patterns: [
        '\\bproduct/plans/',
        '\\bgrants/',
        '\\bpatents/',
        '\\.claude/',
        '/Users/[a-z0-9_-]+/',
      ],
    },
  ],
};
