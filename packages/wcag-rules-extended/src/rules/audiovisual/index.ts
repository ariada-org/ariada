// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pack F — Audiovisual media services rules.
 *
 * 5 rules covering EAA Annex I §I.6 (audiovisual media services). The focus is
 * timed-text and player accessibility: captions, audio description, a named
 * player, valid track kinds, and caption tracks that actually point at a file.
 */

import type { RuleDefinition, CheckDefinition, RulePack } from '../../types.js';

import {
  rule as captionsSourceRule,
  checkDefinition as captionsSourceCheck,
} from './captions-track-has-src.js';
import {
  rule as mediaNameRule,
  checkDefinition as mediaNameCheck,
} from './media-element-has-accessible-name.js';
import {
  rule as trackKindRule,
  checkDefinition as trackKindCheck,
} from './track-has-valid-kind.js';
import {
  rule as audioDescriptionRule,
  checkDefinition as audioDescriptionCheck,
} from './video-has-audio-description-track.js';
import {
  rule as captionsTrackRule,
  checkDefinition as captionsTrackCheck,
} from './video-has-captions-track.js';

export const audiovisualRules: RuleDefinition[] = [
  captionsTrackRule,
  audioDescriptionRule,
  mediaNameRule,
  trackKindRule,
  captionsSourceRule,
];

export const audiovisualChecks: CheckDefinition[] = [
  captionsTrackCheck,
  audioDescriptionCheck,
  mediaNameCheck,
  trackKindCheck,
  captionsSourceCheck,
];

export const audiovisualPack: RulePack = {
  id: 'audiovisual',
  name: 'Audiovisual media services (EAA Annex I §I.6)',
  description:
    'Rule pack targeting EAA-2025 audiovisual media services: captions, audio description, named players, and valid timed-text tracks.',
  rules: audiovisualRules,
  checks: audiovisualChecks,
};
