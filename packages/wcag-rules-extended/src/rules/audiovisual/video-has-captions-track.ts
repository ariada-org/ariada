// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/audiovisual/video-has-captions-track
 *
 * Audiovisual media services that present prerecorded `<video>` with speech must
 * provide synchronised captions so deaf and hard-of-hearing users can follow the
 * dialogue. In-DOM, the caption mechanism is a child `<track kind="captions">`
 * (or `kind="subtitles">`). A muted background video with no controls carries no
 * speech and is exempt, as is a decorative video hidden from assistive technology.
 *
 * WCAG SC: 1.2.2 Captions (Prerecorded) (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/audiovisual-video-has-captions-track.md';

export const metadata: RuleMetadata = {
  description: 'Prerecorded video must carry a captions or subtitles track (WCAG 1.2.2).',
  help: 'Add a child <track kind="captions"> (or kind="subtitles").',
  helpUrl: HELP_URL,
  wcag: ['1.2.2'],
  en301549: ['9.1.2.2'],
  eaaAnnexI: ['I.6'],
  impact: 'serious',
};

function looksLikeCaptionableVideo(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'video') return false;
  // Decorative videos hidden from assistive technology need no captions.
  if ((node.getAttribute('aria-hidden') ?? '').trim().toLowerCase() === 'true') return false;
  // The muted-autoplay-no-controls background pattern carries no speech.
  if (node.hasAttribute('autoplay') && node.hasAttribute('muted') && !node.hasAttribute('controls')) {
    return false;
  }
  return true;
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeCaptionableVideo(node)) return true;
  for (const track of node.querySelectorAll('track')) {
    const kind = (track.getAttribute('kind') ?? '').trim().toLowerCase();
    if (kind === 'captions' || kind === 'subtitles') return true;
  }
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/audiovisual/video-has-captions-track',
  selector: 'video',
  matches: looksLikeCaptionableVideo,
  any: ['ariada/audiovisual/video-has-captions'],
  all: [],
  none: [],
  tags: ['cat.media', 'wcag2a', 'wcag122', 'EAA', 'EAA-I6'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/audiovisual/video-has-captions',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Video provides a captions or subtitles track.',
      fail: 'Video has no captions track — add <track kind="captions">.',
    },
  },
};
