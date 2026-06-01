// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './video-has-captions-track.js';

describe('audiovisual/video-has-captions-track — check', () => {
  beforeEach(() => resetBody());

  const video = (html: string) =>
    setBodyFromFragment(html).querySelector('video')!;

  it('PASSES a video with a captions track', () => {
    expect(
      check(video('<video controls><track kind="captions" src="c.vtt" srclang="en"></video>')),
    ).toBe(true);
  });

  it('PASSES a video with a subtitles track', () => {
    expect(
      check(video('<video controls><track kind="subtitles" src="s.vtt" srclang="en"></video>')),
    ).toBe(true);
  });

  it('SKIPS a muted autoplay background video with no controls', () => {
    expect(check(video('<video autoplay muted loop><source src="bg.mp4"></video>'))).toBe(true);
  });

  it('SKIPS an aria-hidden decorative video', () => {
    expect(check(video('<video controls aria-hidden="true"><source src="d.mp4"></video>'))).toBe(
      true,
    );
  });

  it('FAILS a plain video with no track', () => {
    expect(check(video('<video controls><source src="v.mp4"></video>'))).toBe(false);
  });

  it('FAILS a video with only a chapters track', () => {
    expect(
      check(video('<video controls><track kind="chapters" src="ch.vtt"></video>')),
    ).toBe(false);
  });

  it('FAILS a video with only a descriptions track', () => {
    expect(
      check(video('<video controls><track kind="descriptions" src="ad.vtt"></video>')),
    ).toBe(false);
  });

  it('is case-insensitive about the kind attribute', () => {
    expect(
      check(video('<video controls><track kind="CAPTIONS" src="c.vtt" srclang="en"></video>')),
    ).toBe(true);
  });

  it('PASSES when one of several tracks is captions', () => {
    expect(
      check(
        video(
          '<video controls><track kind="chapters" src="ch.vtt"><track kind="captions" src="c.vtt" srclang="en"></video>',
        ),
      ),
    ).toBe(true);
  });

  it('SKIPS a non-video element', () => {
    const node = setBodyFromFragment('<audio controls><source src="a.mp3"></audio>').querySelector(
      'audio',
    )!;
    expect(check(node)).toBe(true);
  });
});
