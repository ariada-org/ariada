// SPDX-License-Identifier: EUPL-1.2
/**
 * Recite Me (Recite Limited, UK).
 *
 * Common deployment patterns: `cdn.reciteme.com` script host, a
 * toolbar container with id `rmCustomToolbarContainer`, a `recite-`
 * class prefix, and a global `Recite` object.
 */

import type { VendorSignature } from '../types.js';

const reciteme: VendorSignature = {
  id: 'reciteme',
  displayName: 'Recite Me',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\bcdn\.reciteme\.com\b[^"']*["']/i,
      locationHint: 'head>script[src*="cdn.reciteme.com"]',
      label: 'cdn.reciteme.com',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']rmCustomToolbarContainer["']/i,
      locationHint: 'body div#rmCustomToolbarContainer',
      label: '#rmCustomToolbarContainer',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\brecite-[a-z0-9_-]+/i,
      locationHint: 'body *[class^="recite-"]',
      label: 'class="recite-*"',
    },
    {
      kind: 'global-js',
      // word-bounded to avoid matching `Recitation`, `Recitable`, etc.
      pattern: /\b(?:window\.|globalThis\.)Recite\b/,
      locationHint: 'script body window.Recite',
      label: 'window.Recite',
    },
  ],
};

export default reciteme;
