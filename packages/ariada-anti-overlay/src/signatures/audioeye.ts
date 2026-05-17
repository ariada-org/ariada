// SPDX-License-Identifier: EUPL-1.2
/**
 * AudioEye (overlay-mode deployment).
 *
 * Note: AudioEye also offers a monitoring-only / remediation-services
 * mode that does not inject a runtime widget. This signature is
 * intentionally narrow to the overlay-mode markers — overlay-free
 * deployments will not trigger detection.
 */

import type { VendorSignature } from '../types.js';

const audioeye: VendorSignature = {
  id: 'audioeye',
  displayName: 'AudioEye (overlay-mode)',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\b(?:wsmcdn|ws)\.audioeye\.com\b[^"']*["']/i,
      locationHint: 'head>script[src*="audioeye.com"]',
      label: 'wsmcdn/ws.audioeye.com',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']ae_launcher["']/i,
      locationHint: 'body button#ae_launcher',
      label: '#ae_launcher',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\b(?:ae-|audioeye-)[a-z0-9_-]+/i,
      locationHint: 'body *[class^="ae-"], *[class^="audioeye-"]',
      label: 'class="ae-*" or "audioeye-*"',
    },
    {
      kind: 'global-js',
      pattern: /\b(?:window\.|globalThis\.)?__AudioEyeSiteHash\b/,
      locationHint: 'script body window.__AudioEyeSiteHash',
      label: 'window.__AudioEyeSiteHash',
    },
    {
      kind: 'iframe-src',
      pattern: /<iframe[^>]+src=["'][^"']*\baudioeye\.com\b[^"']*["']/i,
      locationHint: 'body iframe[src*="audioeye.com"]',
      label: 'audioeye.com (iframe)',
    },
  ],
};

export default audioeye;
