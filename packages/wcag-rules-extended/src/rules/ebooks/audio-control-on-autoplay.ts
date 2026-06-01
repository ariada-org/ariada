// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/ebooks/audio-control-on-autoplay
 *
 * Read-aloud e-books and dedicated reading software often embed `<audio>` (or
 * the audio track of `<video>`) that starts automatically. WCAG 1.4.2 requires
 * a mechanism to pause or stop any sound that plays for more than 3 seconds
 * without the user initiating it. The in-DOM stop mechanism is the native
 * `controls` UI; a `muted` element produces no sound at all and is therefore
 * exempt. Autoplaying audio with neither is a violation.
 *
 * WCAG SC: 1.4.2 Audio Control (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/ebooks-audio-control-on-autoplay.md';

export const metadata: RuleMetadata = {
  description: 'Autoplaying media must expose controls or be muted (WCAG 1.4.2).',
  help: 'Add the controls attribute, or mute the element if it should be silent.',
  helpUrl: HELP_URL,
  wcag: ['1.4.2'],
  en301549: ['9.1.4.2'],
  eaaAnnexI: ['I.5'],
  impact: 'serious',
};

function looksLikeAutoplayAudio(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== 'audio' && tag !== 'video') return false;
  return node.hasAttribute('autoplay');
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeAutoplayAudio(node)) return true;
  // A muted element makes no sound; a controls element lets the user stop it.
  // Either one satisfies 1.4.2; lacking both is a violation.
  if (node.hasAttribute('muted')) return true;
  if (node.hasAttribute('controls')) return true;
  return false;
};

export const rule: RuleDefinition = {
  id: 'ariada/ebooks/audio-control-on-autoplay',
  selector: 'audio[autoplay], video[autoplay]',
  matches: looksLikeAutoplayAudio,
  any: ['ariada/ebooks/autoplay-has-stop-mechanism'],
  all: [],
  none: [],
  tags: ['cat.media', 'wcag2a', 'wcag142', 'EAA', 'EAA-I5'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/ebooks/autoplay-has-stop-mechanism',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Autoplaying media exposes controls or is muted.',
      fail: 'Autoplaying media has no stop mechanism — add controls or mute it.',
    },
  },
};
