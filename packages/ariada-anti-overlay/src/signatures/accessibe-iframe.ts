// SPDX-License-Identifier: EUPL-1.2
/**
 * accessiBe (iframe-only variant).
 *
 * Some accessiBe deployments inject the widget inside an iframe whose
 * `title` attribute reads "Accessibility Toolbar" — typically when the
 * page does not include the full acsb-* DOM scaffolding. When ONLY
 * the iframe is observed (no acsb-* DOM markers in the parent
 * document) confidence is capped at `medium` per the PRD §3.7 row 7.
 */

import type { VendorSignature } from '../types.js';

const accessibeIframe: VendorSignature = {
  id: 'accessibe-iframe',
  displayName: 'accessiBe (iframe variant)',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  confidenceCap: 'medium',
  signatures: [
    {
      kind: 'iframe-src',
      pattern: /<iframe[^>]+src=["'][^"']*\baccessibe\.com\/accessibility\b[^"']*["']/i,
      locationHint: 'body iframe[src*="accessibe.com/accessibility"]',
      label: 'accessibe.com/accessibility (iframe)',
    },
    {
      kind: 'attribute',
      pattern: /<iframe[^>]+title=["']Accessibility Toolbar["']/i,
      locationHint: 'body iframe[title="Accessibility Toolbar"]',
      label: 'iframe title="Accessibility Toolbar"',
    },
  ],
};

export default accessibeIframe;
