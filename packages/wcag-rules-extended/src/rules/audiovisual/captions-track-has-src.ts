// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/audiovisual/captions-track-has-src
 *
 * A caption or subtitle `<track>` must point at a real timed-text resource via
 * `src`. A captions track with no `src` (or an empty one) loads nothing, so the
 * media appears to offer captions while presenting none — worse than declaring
 * no track at all, because the player exposes a non-functional caption control.
 * An absent `kind` defaults to subtitles per the HTML spec and is covered too.
 *
 * WCAG SC: 1.2.2 Captions (Prerecorded) (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/audiovisual-captions-track-has-src.md';

export const metadata: RuleMetadata = {
  description: 'A captions or subtitles track must have a non-empty src (WCAG 1.2.2).',
  help: 'Set the src attribute to the timed-text (.vtt) resource.',
  helpUrl: HELP_URL,
  wcag: ['1.2.2'],
  en301549: ['9.1.2.2'],
  eaaAnnexI: ['I.6'],
  impact: 'serious',
};

function looksLikeCaptionsTrack(node: Element): boolean {
  if (node.tagName.toLowerCase() !== 'track') return false;
  const rawKind = node.getAttribute('kind');
  // An absent kind defaults to subtitles per the HTML spec.
  const kind = rawKind === null ? 'subtitles' : rawKind.trim().toLowerCase();
  return kind === 'captions' || kind === 'subtitles';
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeCaptionsTrack(node)) return true;
  const source = (node.getAttribute('src') ?? '').trim();
  return source.length > 0;
};

export const rule: RuleDefinition = {
  id: 'ariada/audiovisual/captions-track-has-src',
  selector: 'track',
  matches: looksLikeCaptionsTrack,
  any: ['ariada/audiovisual/captions-track-points-somewhere'],
  all: [],
  none: [],
  tags: ['cat.media', 'wcag2a', 'wcag122', 'EAA', 'EAA-I6'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/audiovisual/captions-track-points-somewhere',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Captions track points at a timed-text resource.',
      fail: 'Captions track has no src — it provides no captions.',
    },
  },
};
