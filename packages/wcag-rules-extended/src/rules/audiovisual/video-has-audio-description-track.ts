// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/audiovisual/video-has-audio-description-track
 *
 * Prerecorded `<video>` whose visuals carry information not conveyed by the
 * soundtrack must provide an audio description so blind users can follow what is
 * shown. In-DOM, the mechanism is a child `<track kind="descriptions">`. An
 * on-page transcript or description referenced via `aria-describedby` is an
 * accepted alternative. Muted background video and decorative video are exempt.
 *
 * WCAG SC: 1.2.5 Audio Description (Prerecorded) (Level AA).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/audiovisual-video-has-audio-description-track.md';

export const metadata: RuleMetadata = {
  description: 'Prerecorded video must carry an audio description (WCAG 1.2.5).',
  help: 'Add a child <track kind="descriptions"> or reference a description via aria-describedby.',
  helpUrl: HELP_URL,
  wcag: ['1.2.5'],
  en301549: ['9.1.2.5'],
  eaaAnnexI: ['I.6'],
  impact: 'moderate',
};

function looksLikeCaptionableVideo(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'video') return false;
  // Decorative videos hidden from assistive technology need no description.
  if ((node.getAttribute('aria-hidden') ?? '').trim().toLowerCase() === 'true') return false;
  // The muted-autoplay-no-controls background pattern carries no information.
  if (node.hasAttribute('autoplay') && node.hasAttribute('muted') && !node.hasAttribute('controls')) {
    return false;
  }
  return true;
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeCaptionableVideo(node)) return true;
  // A descriptions track is the native mechanism.
  for (const track of node.querySelectorAll('track')) {
    const kind = (track.getAttribute('kind') ?? '').trim().toLowerCase();
    if (kind === 'descriptions') return true;
  }
  // An on-page transcript/description referenced via aria-describedby is accepted.
  const desc = node.getAttribute('aria-describedby');
  if (desc) {
    const document = node.ownerDocument;
    const ids = desc.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref && (ref.textContent ?? '').trim()) return true;
    }
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/audiovisual/video-has-audio-description-track',
  selector: 'video',
  matches: looksLikeCaptionableVideo,
  any: ['ariada/audiovisual/video-has-audio-description'],
  all: [],
  none: [],
  tags: ['cat.media', 'wcag2aa', 'wcag125', 'EAA', 'EAA-I6'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/audiovisual/video-has-audio-description',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Video provides an audio description track or a referenced description.',
      fail: 'Video has no audio description — add <track kind="descriptions"> or aria-describedby.',
    },
  },
};
