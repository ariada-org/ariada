// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './audio-control-on-autoplay.js';

describe('ebooks/audio-control-on-autoplay — check', () => {
  beforeEach(() => resetBody());

  const media = (html: string, selector: string) =>
    setBodyFromFragment(html).querySelector(selector)!;

  it('PASSES audio without autoplay', () => {
    expect(check(media('<audio src="a.mp3" controls></audio>', 'audio'))).toBe(true);
  });

  it('PASSES autoplay audio with controls', () => {
    expect(check(media('<audio src="a.mp3" autoplay controls></audio>', 'audio'))).toBe(
      true,
    );
  });

  it('PASSES autoplay audio that is muted', () => {
    expect(check(media('<audio src="a.mp3" autoplay muted></audio>', 'audio'))).toBe(true);
  });

  it('FAILS autoplay audio alone', () => {
    expect(check(media('<audio src="a.mp3" autoplay></audio>', 'audio'))).toBe(false);
  });

  it('FAILS autoplay video alone', () => {
    expect(check(media('<video src="a.mp4" autoplay></video>', 'video'))).toBe(false);
  });

  it('PASSES the common hero pattern: autoplay muted video', () => {
    expect(check(media('<video src="a.mp4" autoplay muted></video>', 'video'))).toBe(true);
  });

  it('PASSES autoplay media with both controls and muted', () => {
    expect(
      check(media('<audio src="a.mp3" autoplay controls muted></audio>', 'audio')),
    ).toBe(true);
  });

  it('PASSES autoplay video with controls', () => {
    expect(check(media('<video src="a.mp4" autoplay controls></video>', 'video'))).toBe(
      true,
    );
  });

  it('SKIPS a non-media element with an autoplay attribute', () => {
    const node = setBodyFromFragment('<div autoplay></div>').querySelector('div')!;
    expect(check(node)).toBe(true);
  });

  it('SKIPS a non-media element entirely', () => {
    const node = setBodyFromFragment('<p>chapter text</p>').querySelector('p')!;
    expect(check(node)).toBe(true);
  });
});
