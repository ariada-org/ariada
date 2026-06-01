// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pack E — E-books and dedicated reading software rules.
 *
 * 5 rules covering EAA Annex I §I.5 (e-books and dedicated software). The
 * focus is the reading surface itself: zoomable text, user-overridable
 * spacing, controllable read-aloud audio, per-region language declaration,
 * and a focus order that follows the reading sequence.
 */

import type { RuleDefinition, CheckDefinition, RulePack } from '../../types.js';

import {
  rule as audioControlRule,
  checkDefinition as audioControlCheck,
} from './audio-control-on-autoplay.js';
import {
  rule as positiveTabindexRule,
  checkDefinition as positiveTabindexCheck,
} from './no-positive-tabindex-in-reading.js';
import {
  rule as readingLangRule,
  checkDefinition as readingLangCheck,
} from './reading-content-has-lang.js';
import {
  rule as textSpacingRule,
  checkDefinition as textSpacingCheck,
} from './text-spacing-overridable.js';
import {
  rule as viewportZoomRule,
  checkDefinition as viewportZoomCheck,
} from './viewport-allows-zoom.js';

export const ebooksRules: RuleDefinition[] = [
  viewportZoomRule,
  textSpacingRule,
  audioControlRule,
  readingLangRule,
  positiveTabindexRule,
];

export const ebooksChecks: CheckDefinition[] = [
  viewportZoomCheck,
  textSpacingCheck,
  audioControlCheck,
  readingLangCheck,
  positiveTabindexCheck,
];

export const ebooksPack: RulePack = {
  id: 'ebooks',
  name: 'E-books and dedicated reading software (EAA Annex I §I.5)',
  description:
    'Rule pack targeting EAA-2025 e-books and dedicated reading software: zoomable text, user-overridable spacing, controllable read-aloud audio, per-region language, and reading-order focus.',
  rules: ebooksRules,
  checks: ebooksChecks,
};
