// SPDX-License-Identifier: EUPL-1.2
/**
 * UserWay (Level Access overlay product).
 *
 * Common deployment: a single <script> tag pointing to
 * cdn.userway.org with a `data-account` attribute, which injects an
 * accessibility-icon button (id `userwayAccessibilityIcon`) and a
 * widget container. Class prefixes seen in the wild include `uw-`
 * and `userway-`. Global SDK object is `UserWayWidgetApp`.
 */

import type { VendorSignature } from '../types.js';

const userway: VendorSignature = {
  id: 'userway',
  displayName: 'UserWay',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\bcdn\.userway\.org\b[^"']*["']/i,
      locationHint: 'head>script[src*="cdn.userway.org"]',
      label: 'cdn.userway.org',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']userwayAccessibilityIcon["']/i,
      locationHint: 'body button#userwayAccessibilityIcon',
      label: '#userwayAccessibilityIcon',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\b(?:uw-|userway-)[a-z0-9_-]+/i,
      locationHint: 'body *[class^="uw-"], *[class^="userway-"]',
      label: 'class="uw-*" or "userway-*"',
    },
    {
      kind: 'global-js',
      pattern: /\b(?:window\.|globalThis\.)?UserWayWidgetApp\b/,
      locationHint: 'script body window.UserWayWidgetApp',
      label: 'window.UserWayWidgetApp',
    },
    {
      kind: 'attribute',
      pattern: /<script[^>]+data-account=["'][A-Za-z0-9_-]{4,}["'][^>]*userway/i,
      locationHint: 'head>script[data-account] (userway)',
      label: 'data-account on userway script',
    },
  ],
};

export default userway;
