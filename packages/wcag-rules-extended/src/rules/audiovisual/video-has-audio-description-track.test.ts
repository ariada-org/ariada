// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './video-has-audio-description-track.js';

describe('audiovisual/video-has-audio-description-track — check', () => {
  beforeEach(() => resetBody());

  const video = (html: string) =>
    setBodyFromFragment(html).querySelector('video')!;

  it('PASSES a video with a descriptions track', () => {
    expect(
      check(video('<video controls><track kind="descriptions" src="ad.vtt" srclang="en"></video>')),
    ).toBe(true);
  });

  it('PASSES a video with aria-describedby to a non-empty element', () => {
    expect(
      check(
        video(
          '<video controls aria-describedby="d1"><source src="v.mp4"></video><p id="d1">A wide shot of the harbour at dawn.</p>',
        ),
      ),
    ).toBe(true);
  });

  it('FAILS a plain video with no description', () => {
    expect(check(video('<video controls><source src="v.mp4"></video>'))).toBe(false);
  });

  it('FAILS a video with only a captions track', () => {
    expect(
      check(video('<video controls><track kind="captions" src="c.vtt" srclang="en"></video>')),
    ).toBe(false);
  });

  it('FAILS aria-describedby pointing at a missing id', () => {
    expect(
      check(video('<video controls aria-describedby="nope"><source src="v.mp4"></video>')),
    ).toBe(false);
  });

  it('FAILS aria-describedby pointing at an empty element', () => {
    expect(
      check(
        video(
          '<video controls aria-describedby="d1"><source src="v.mp4"></video><p id="d1">   </p>',
        ),
      ),
    ).toBe(false);
  });

  it('SKIPS a muted autoplay background video with no controls', () => {
    expect(check(video('<video autoplay muted loop><source src="bg.mp4"></video>'))).toBe(true);
  });

  it('SKIPS an aria-hidden decorative video', () => {
    expect(check(video('<video controls aria-hidden="true"><source src="d.mp4"></video>'))).toBe(
      true,
    );
  });

  it('SKIPS a non-video element', () => {
    const node = setBodyFromFragment('<audio controls><source src="a.mp3"></audio>').querySelector(
      'audio',
    )!;
    expect(check(node)).toBe(true);
  });
});
