// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/audiovisual/media-element-has-accessible-name
 *
 * A media player exposed to the user — `<video controls>` or `<audio controls>` —
 * presents an interactive control set. Screen-reader users need a name to know
 * which media the player belongs to ("Episode 4 audio", "Product demo video").
 * Without an accessible name the control is announced only by its role, leaving
 * the user unable to distinguish multiple players on a page.
 *
 * WCAG SC: 4.1.2 Name, Role, Value (Level A).
 */

import { getAccessibleNameLite } from '../../helpers.js';
import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/audiovisual-media-element-has-accessible-name.md';

export const metadata: RuleMetadata = {
  description: 'A media player with controls must have an accessible name (WCAG 4.1.2).',
  help: 'Add aria-label, aria-labelledby, or title naming the media.',
  helpUrl: HELP_URL,
  wcag: ['4.1.2'],
  en301549: ['9.4.1.2'],
  eaaAnnexI: ['I.6'],
  impact: 'serious',
};

function looksLikeControllableMedia(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== 'video' && tag !== 'audio') return false;
  return node.hasAttribute('controls');
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeControllableMedia(node)) return true;
  // Prefer the computed accessible name; fall back to the raw naming attributes
  // that ACCNAME-Lite does not cover for media elements.
  let name = getAccessibleNameLite(node).trim();
  if (!name) name = (node.getAttribute('title') ?? '').trim();
  if (!name) name = (node.getAttribute('aria-label') ?? '').trim();
  if (!name) {
    const labelledby = node.getAttribute('aria-labelledby');
    if (labelledby) {
      const document = node.ownerDocument;
      const ids = labelledby.split(/\s+/).filter(Boolean);
      const parts: string[] = [];
      for (const id of ids) {
        const ref = document.getElementById(id);
        if (ref?.textContent) parts.push(ref.textContent.trim());
      }
      name = parts.join(' ').trim();
    }
  }
  return name.length > 0;
};

export const rule: RuleDefinition = {
  id: 'ariada/audiovisual/media-element-has-accessible-name',
  selector: 'video[controls], audio[controls]',
  matches: looksLikeControllableMedia,
  any: ['ariada/audiovisual/media-has-accessible-name'],
  all: [],
  none: [],
  tags: ['cat.media', 'wcag2a', 'wcag412', 'EAA', 'EAA-I6'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/audiovisual/media-has-accessible-name',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Media player has an accessible name.',
      fail: 'Media player has no accessible name — add aria-label, aria-labelledby, or title.',
    },
  },
};
