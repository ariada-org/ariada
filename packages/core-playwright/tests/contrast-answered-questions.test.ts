// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The rule library hands over elements it could not decide, and the page can
// decide them. What is held here is the shape of that closing: only an
// undecided contrast question, only where the page gave an answer, and only
// when the answer clears the threshold.
//
// Over-removal is the failure that matters. A finding dropped is a finding
// nobody sees again, so every case below is about something that must survive.

import type { Finding } from '@ariada-org/core-engine';
import { describe, expect, it } from 'vitest';

import { dropAnsweredContrastQuestions } from '../src/contrast.js';

function finding(over: Partial<Finding> & { selector?: string } = {}): Finding {
  const { selector = 'p', ...rest } = over;
  return {
    id: `id-${selector}-${String(rest.ruleId ?? 'color-contrast')}`,
    scanId: 'scan',
    domain: 'accessibility',
    ruleId: 'color-contrast',
    severity: 'serious',
    element: { selector },
    message: 'Elements must meet minimum color contrast ratio thresholds',
    needsReview: true,
    confidence: 0.5,
    ...rest,
  } as Finding;
}

const white = 'rgb(255, 255, 255)';
const black = 'rgb(0, 0, 0)';
const faint = 'rgb(204, 204, 204)';

describe('closing the contrast questions the page answered', () => {
  it('drops an undecided finding whose element clears the threshold', () => {
    const kept = dropAnsweredContrastQuestions(
      [finding({ selector: 'p.ok' })],
      new Map([['p.ok', { fg: black, bg: white, large: false }]]),
    );
    expect(kept).toHaveLength(0);
  });

  it('keeps one whose element does not clear it', () => {
    const kept = dropAnsweredContrastQuestions(
      [finding({ selector: 'p.faint' })],
      new Map([['p.faint', { fg: faint, bg: white, large: false }]]),
    );
    expect(kept).toHaveLength(1);
  });

  it('keeps one the page had no answer for', () => {
    const kept = dropAnsweredContrastQuestions(
      [finding({ selector: 'p.unreachable' })],
      new Map([['p.other', { fg: black, bg: white, large: false }]]),
    );
    expect(kept).toHaveLength(1);
  });

  it('never touches a decided finding, even at the same selector', () => {
    // A violation the rule library was sure of is not ours to reconsider.
    const decided = finding({ selector: 'p.ok', needsReview: false, confidence: 1 });
    const kept = dropAnsweredContrastQuestions(
      [decided],
      new Map([['p.ok', { fg: black, bg: white, large: false }]]),
    );
    expect(kept).toHaveLength(1);
  });

  it('never touches a finding about something else', () => {
    const other = finding({ selector: 'p.ok', ruleId: 'image-alt' });
    const kept = dropAnsweredContrastQuestions(
      [other],
      new Map([['p.ok', { fg: black, bg: white, large: false }]]),
    );
    expect(kept).toHaveLength(1);
  });

  it('applies the large-text threshold where the page says the text is large', () => {
    // 3:1 rather than 4.5:1. This grey sits at 3.36 against white — above the
    // large-text threshold and below the normal one — so it clears exactly one
    // of them, and the flag has to travel with the answer for that to work.
    const grey = 'rgb(140, 140, 140)';
    const asNormal = dropAnsweredContrastQuestions(
      [finding({ selector: 'h1' })],
      new Map([['h1', { fg: grey, bg: white, large: false }]]),
    );
    const asLarge = dropAnsweredContrastQuestions(
      [finding({ selector: 'h1' })],
      new Map([['h1', { fg: grey, bg: white, large: true }]]),
    );
    expect(asNormal).toHaveLength(1);
    expect(asLarge).toHaveLength(0);
  });

  it('keeps everything when the page answered nothing at all', () => {
    const all = [finding({ selector: 'a' }), finding({ selector: 'b' })];
    expect(dropAnsweredContrastQuestions(all, new Map())).toHaveLength(2);
  });

  it('keeps a finding whose colours the page reported unparseably', () => {
    const kept = dropAnsweredContrastQuestions(
      [finding({ selector: 'p.weird' })],
      new Map([['p.weird', { fg: 'color(display-p3 1 1 1)', bg: white, large: false }]]),
    );
    expect(kept).toHaveLength(1);
  });
});
