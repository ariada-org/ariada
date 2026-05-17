// SPDX-License-Identifier: EUPL-1.2
/**
 * accessiBe (standard JS-injected widget variant).
 *
 * Signatures cover the public CDN host(s), the trigger DOM id, the
 * canonical class prefix, the global window-attached SDK object, and
 * the iframe-src observed on widget-mode pages. Patterns are
 * word-bounded and host-anchored to avoid false positives on
 * unrelated tokens elsewhere on the page.
 */

import type { VendorSignature } from '../types.js';

const accessibe: VendorSignature = {
  id: 'accessibe',
  displayName: 'accessiBe',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\bacsbapp\.com\b[^"']*["']/i,
      locationHint: 'head>script[src*="acsbapp.com"]',
      label: 'acsbapp.com',
    },
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\baccessibe\.com\/access(?:ibility)?\b[^"']*["']/i,
      locationHint: 'head>script[src*="accessibe.com/access"]',
      label: 'accessibe.com/access',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']acsb-trigger["']/i,
      locationHint: 'body button#acsb-trigger',
      label: '#acsb-trigger',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\bacsb-[a-z0-9_-]+/i,
      locationHint: 'body *[class^="acsb-"]',
      label: 'class="acsb-*"',
    },
    {
      kind: 'global-js',
      pattern: /\b(?:window\.|globalThis\.)?acsbJS\b/,
      locationHint: 'script body window.acsbJS',
      label: 'window.acsbJS',
    },
    {
      kind: 'iframe-src',
      pattern: /<iframe[^>]+src=["'][^"']*\baccessibe\.com\b[^"']*["']/i,
      locationHint: 'body iframe[src*="accessibe.com"]',
      label: 'accessibe.com (iframe)',
    },
  ],
};

export default accessibe;
