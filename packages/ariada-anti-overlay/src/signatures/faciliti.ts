// SPDX-License-Identifier: EUPL-1.2
/**
 * FACIL'iti (FACIL-iti SAS, France).
 *
 * Hosts: `widget.facil-iti.com` and `assets.facil-iti.com`. Class
 * prefix `faciliti-`. Global SDK `FACILiti`.
 */

import type { VendorSignature } from '../types.js';

const faciliti: VendorSignature = {
  id: 'faciliti',
  displayName: "FACIL'iti",
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\b(?:widget|assets)\.facil-iti\.com\b[^"']*["']/i,
      locationHint: 'head>script[src*="facil-iti.com"]',
      label: '(widget|assets).facil-iti.com',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\bfaciliti-[a-z0-9_-]+/i,
      locationHint: 'body *[class^="faciliti-"]',
      label: 'class="faciliti-*"',
    },
    {
      kind: 'global-js',
      pattern: /\b(?:window\.|globalThis\.)FACILiti\b/,
      locationHint: 'script body window.FACILiti',
      label: 'window.FACILiti',
    },
  ],
};

export default faciliti;
