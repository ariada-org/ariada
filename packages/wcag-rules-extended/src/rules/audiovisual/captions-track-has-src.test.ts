// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './captions-track-has-src.js';

describe('audiovisual/captions-track-has-src — check', () => {
  beforeEach(() => resetBody());

  const track = (html: string) =>
    setBodyFromFragment(`<video>${html}</video>`).querySelector('track')!;

  it('PASSES a captions track with src', () => {
    expect(check(track('<track kind="captions" src="c.vtt" srclang="en">'))).toBe(true);
  });

  it('FAILS a captions track with no src', () => {
    expect(check(track('<track kind="captions" srclang="en">'))).toBe(false);
  });

  it('FAILS a captions track with src=""', () => {
    expect(check(track('<track kind="captions" src="" srclang="en">'))).toBe(false);
  });

  it('FAILS a subtitles track with an empty src', () => {
    expect(check(track('<track kind="subtitles" src="   " srclang="en">'))).toBe(false);
  });

  it('SKIPS a kind=metadata track', () => {
    expect(check(track('<track kind="metadata">'))).toBe(true);
  });

  it('SKIPS a kind=descriptions track', () => {
    expect(check(track('<track kind="descriptions">'))).toBe(true);
  });

  it('FAILS an absent-kind track (subtitles) with an empty src', () => {
    expect(check(track('<track src="">'))).toBe(false);
  });

  it('PASSES an absent-kind track (subtitles) with src', () => {
    expect(check(track('<track src="s.vtt" srclang="en">'))).toBe(true);
  });
});
