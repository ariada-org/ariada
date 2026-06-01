// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/audiovisual/track-has-valid-kind
 *
 * A `<track>` element's `kind` must be one of the values the HTML spec defines —
 * subtitles, captions, descriptions, chapters, metadata. An unknown kind silently
 * falls back to metadata in browsers, so a typo (e.g. `kind="caption"`) means the
 * intended timed text never reaches assistive technology. Subtitles additionally
 * require a `srclang` per the HTML spec, and an absent `kind` defaults to subtitles,
 * so it carries the same language requirement.
 *
 * WCAG SC: 4.1.2 Name, Role, Value (Level A).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/audiovisual-track-has-valid-kind.md';

export const metadata: RuleMetadata = {
  description: 'A <track> kind must be valid, and subtitles must declare srclang (WCAG 4.1.2).',
  help: 'Use kind=subtitles|captions|descriptions|chapters|metadata; add srclang for subtitles.',
  helpUrl: HELP_URL,
  wcag: ['4.1.2'],
  en301549: ['9.4.1.2'],
  eaaAnnexI: ['I.6'],
  impact: 'minor',
};

const VALID_KINDS = new Set(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']);

function looksLikeTrack(node: Element): boolean {
  return node.tagName.toLowerCase() === 'track';
}

export const check: CheckEvaluate = (node) => {
  if (!looksLikeTrack(node)) return true;
  const rawKind = node.getAttribute('kind');
  // An absent kind defaults to subtitles per the HTML spec.
  const kind = rawKind === null ? 'subtitles' : rawKind.trim().toLowerCase();
  if (!VALID_KINDS.has(kind)) return false;
  // Subtitles (including the default) require a non-empty srclang.
  if (kind === 'subtitles') {
    const srclang = (node.getAttribute('srclang') ?? '').trim();
    if (!srclang) return false;
  }
  return true;
};

export const rule: RuleDefinition = {
  id: 'ariada/audiovisual/track-has-valid-kind',
  selector: 'track',
  matches: looksLikeTrack,
  any: ['ariada/audiovisual/track-kind-is-valid'],
  all: [],
  none: [],
  tags: ['cat.media', 'wcag2a', 'wcag412', 'EAA', 'EAA-I6'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/audiovisual/track-kind-is-valid',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Track has a valid kind (and srclang where subtitles require it).',
      fail: 'Track has an invalid kind, or is subtitles without srclang.',
    },
  },
};
