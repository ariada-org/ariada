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
      // The first three name directories at the root of the repository, and a
      // reference to one is relative — `patents/draft-a/spec.md`, never
      // `/patents/...`. A leading slash means something else entirely: a path
      // on the published website, where `/patents/` and `/legal/patent-peace/`
      // are pages anyone can open. Without the lookbehind the rule refused the
      // page list of the workflow that scans that very site, and with it a
      // transfer carrying an unrelated fix to that workflow could not travel.
      //
      // The two below keep matching after a slash, because there a slash is
      // ordinary: `~/.claude/rules/x.md` and `/Users/name/` are exactly the
      // shapes worth catching.
      patterns: [
        String.raw`(?<!/)\bproduct/plans/`,
        String.raw`(?<!/)\bgrants/`,
        String.raw`(?<!/)\bpatents/`,
        String.raw`\.claude/`,
        String.raw`/Users/[a-z0-9_-]+/`,
      ],
    },
  ],
};
