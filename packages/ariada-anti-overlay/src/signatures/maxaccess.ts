// SPDX-License-Identifier: EUPL-1.2
/**
 * MaxAccess (Online ADA).
 *
 * Hosts: `maxaccess.io` and `cdn.maxaccess.io`. Trigger DOM id
 * `maxAccess`. Class prefix `max-access-`. Global SDK `MaxAccess`.
 */

import type { VendorSignature } from '../types.js';

const maxaccess: VendorSignature = {
  id: 'maxaccess',
  displayName: 'MaxAccess (Online ADA)',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\b(?:cdn\.)?maxaccess\.io\b[^"']*["']/i,
      locationHint: 'head>script[src*="maxaccess.io"]',
      label: '(cdn.)maxaccess.io',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']maxAccess["']/,
      locationHint: 'body div#maxAccess',
      label: '#maxAccess',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\bmax-access-[a-z0-9_-]+/i,
      locationHint: 'body *[class^="max-access-"]',
      label: 'class="max-access-*"',
    },
    {
      kind: 'global-js',
      pattern: /\b(?:window\.|globalThis\.)MaxAccess\b/,
      locationHint: 'script body window.MaxAccess',
      label: 'window.MaxAccess',
    },
  ],
};

export default maxaccess;
