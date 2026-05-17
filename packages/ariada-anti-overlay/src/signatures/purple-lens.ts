// SPDX-License-Identifier: EUPL-1.2
/**
 * Purple Lens / PurpleHat / Purple Cube family.
 *
 * Hosts: `widget.purplelens.io` and `cdn.purplehat.com`. Trigger DOM
 * id `purple-lens-widget`. Class prefixes `purplelens-` and
 * `purple-cube-`.
 */

import type { VendorSignature } from '../types.js';

const purpleLens: VendorSignature = {
  id: 'purple-lens',
  displayName: 'Purple Lens (PurpleHat / Purple Cube)',
  firstSeen: '2026-05-20',
  lastVerified: '2026-05-20',
  signatures: [
    {
      kind: 'script-src',
      pattern: /<script[^>]+src=["'][^"']*\b(?:widget\.purplelens\.io|cdn\.purplehat\.com)\b[^"']*["']/i,
      locationHint: 'head>script[src*="purplelens.io" / "purplehat.com"]',
      label: 'widget.purplelens.io / cdn.purplehat.com',
    },
    {
      kind: 'dom-id',
      pattern: /\bid=["']purple-lens-widget["']/i,
      locationHint: 'body div#purple-lens-widget',
      label: '#purple-lens-widget',
    },
    {
      kind: 'class-prefix',
      pattern: /\bclass=["'][^"']*\b(?:purplelens-|purple-cube-)[a-z0-9_-]+/i,
      locationHint: 'body *[class^="purplelens-"], *[class^="purple-cube-"]',
      label: 'class="purplelens-*" or "purple-cube-*"',
    },
  ],
};

export default purpleLens;
