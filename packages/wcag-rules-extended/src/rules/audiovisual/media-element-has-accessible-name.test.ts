// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './media-element-has-accessible-name.js';

describe('audiovisual/media-element-has-accessible-name — check', () => {
  beforeEach(() => resetBody());

  const media = (html: string, sel: string) =>
    setBodyFromFragment(html).querySelector(sel)!;

  it('PASSES a video with controls and aria-label', () => {
    expect(
      check(media('<video controls aria-label="Product demo"><source src="v.mp4"></video>', 'video')),
    ).toBe(true);
  });

  it('PASSES an audio with controls and title', () => {
    expect(
      check(media('<audio controls title="Episode 4"><source src="a.mp3"></audio>', 'audio')),
    ).toBe(true);
  });

  it('PASSES aria-labelledby pointing at text', () => {
    expect(
      check(
        media(
          '<p id="t1">Keynote recording</p><video controls aria-labelledby="t1"><source src="v.mp4"></video>',
          'video',
        ),
      ),
    ).toBe(true);
  });

  it('FAILS a video with controls and no name', () => {
    expect(check(media('<video controls><source src="v.mp4"></video>', 'video'))).toBe(false);
  });

  it('FAILS an audio with controls and no name', () => {
    expect(check(media('<audio controls><source src="a.mp3"></audio>', 'audio'))).toBe(false);
  });

  it('FAILS a whitespace-only aria-label', () => {
    expect(
      check(media('<video controls aria-label="   "><source src="v.mp4"></video>', 'video')),
    ).toBe(false);
  });

  it('SKIPS a video without controls', () => {
    expect(check(media('<video aria-label="bg"><source src="v.mp4"></video>', 'video'))).toBe(true);
  });
});
