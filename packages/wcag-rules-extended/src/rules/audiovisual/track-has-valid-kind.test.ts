// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './track-has-valid-kind.js';

describe('audiovisual/track-has-valid-kind — check', () => {
  beforeEach(() => resetBody());

  const track = (html: string) =>
    setBodyFromFragment(`<video>${html}</video>`).querySelector('track')!;

  it('PASSES kind=captions with srclang=en', () => {
    expect(check(track('<track kind="captions" src="c.vtt" srclang="en">'))).toBe(true);
  });

  it('PASSES kind=metadata (no srclang needed)', () => {
    expect(check(track('<track kind="metadata" src="m.vtt">'))).toBe(true);
  });

  it('PASSES kind=descriptions', () => {
    expect(check(track('<track kind="descriptions" src="ad.vtt">'))).toBe(true);
  });

  it('FAILS an unknown kind', () => {
    expect(check(track('<track kind="bogus" src="x.vtt">'))).toBe(false);
  });

  it('FAILS kind=subtitles with no srclang', () => {
    expect(check(track('<track kind="subtitles" src="s.vtt">'))).toBe(false);
  });

  it('FAILS an absent kind with no srclang (defaults to subtitles)', () => {
    expect(check(track('<track src="s.vtt">'))).toBe(false);
  });

  it('PASSES an absent kind WITH srclang (default subtitles satisfied)', () => {
    expect(check(track('<track src="s.vtt" srclang="en">'))).toBe(true);
  });

  it('is case-insensitive about the kind attribute', () => {
    expect(check(track('<track kind="CAPTIONS" src="c.vtt" srclang="en">'))).toBe(true);
  });

  it('SKIPS a non-track element', () => {
    const node = setBodyFromFragment('<video controls><source src="v.mp4"></video>').querySelector(
      'video',
    )!;
    expect(check(node)).toBe(true);
  });

  it('FAILS kind=subtitles with whitespace-only srclang', () => {
    expect(check(track('<track kind="subtitles" src="s.vtt" srclang="  ">'))).toBe(false);
  });
});
