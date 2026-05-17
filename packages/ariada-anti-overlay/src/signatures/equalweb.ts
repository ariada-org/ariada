// SPDX-License-Identifier: EUPL-1.2
/**
 * EqualWeb (Accessibly) overlay.
 *
 * Hosts: `aacdn.equalweb.com` and `cdn.equalweb.com`. Trigger
 * element id `INDmenu-btn` (legacy from acquisition). Class prefix
 * `equalweb-`. Global SDK install-status flag is
 * `equalweb_install_status`.
 */

import type { VendorSignature } from '../types.js';

const equalweb: VendorSignature = {
  id: 'equalweb',
  displayName: 'EqualWeb / Accessibly',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\b(?:aacdn|cdn)\.equalweb\.com\b[^"']*["']/i,
      locationHint: 'head>script[src*="equalweb.com"]',
      label: '(a)cdn.equalweb.com',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']INDmenu-btn["']/i,
      locationHint: 'body button#INDmenu-btn',
      label: '#INDmenu-btn',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\bequalweb-[a-z0-9_-]+/i,
      locationHint: 'body *[class^="equalweb-"]',
      label: 'class="equalweb-*"',
    },
    {
      kind: 'global-js',
      pattern: /\b(?:window\.|globalThis\.)?equalweb_install_status\b/,
      locationHint: 'script body window.equalweb_install_status',
      label: 'window.equalweb_install_status',
    },
  ],
};

export default equalweb;
