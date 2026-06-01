// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach } from 'vitest';

import { setBodyFromFragment, resetBody } from '../../test-utils.js';

import { check } from './viewport-allows-zoom.js';

describe('ebooks/viewport-allows-zoom — check', () => {
  beforeEach(() => resetBody());

  const viewport = (content: string) =>
    setBodyFromFragment(`<meta name="viewport" content="${content}">`).querySelector(
      'meta[name="viewport"]',
    )!;

  it('PASSES a responsive viewport with no scale restriction', () => {
    expect(check(viewport('width=device-width, initial-scale=1'))).toBe(true);
  });

  it('PASSES maximum-scale=2 (exactly at the 200% floor)', () => {
    expect(check(viewport('width=device-width, maximum-scale=2'))).toBe(true);
  });

  it('PASSES maximum-scale=5 (well above the floor)', () => {
    expect(check(viewport('width=device-width, maximum-scale=5'))).toBe(true);
  });

  it('FAILS user-scalable=no', () => {
    expect(check(viewport('width=device-width, user-scalable=no'))).toBe(false);
  });

  it('FAILS user-scalable=0 (numeric form of disable)', () => {
    expect(check(viewport('width=device-width, user-scalable=0'))).toBe(false);
  });

  it('FAILS maximum-scale=1 (caps zoom below 200%)', () => {
    expect(check(viewport('width=device-width, maximum-scale=1'))).toBe(false);
  });

  it('FAILS maximum-scale=1.5 (fractional cap below floor)', () => {
    expect(check(viewport('width=device-width, maximum-scale=1.5'))).toBe(false);
  });

  // Edge cases

  it('PASSES when content attribute is empty (no restriction declared)', () => {
    expect(check(viewport(''))).toBe(true);
  });

  it('PASSES user-scalable=yes (explicit allow)', () => {
    expect(check(viewport('width=device-width, user-scalable=yes'))).toBe(true);
  });

  it('is case-insensitive about directive keys and values', () => {
    expect(check(viewport('Width=device-width, User-Scalable=NO'))).toBe(false);
  });

  it('tolerates irregular spacing around directives', () => {
    expect(check(viewport('  width=device-width ,   user-scalable = no '))).toBe(false);
  });

  it('SKIPS a non-viewport meta tag', () => {
    const node = setBodyFromFragment(
      '<meta name="description" content="user-scalable=no">',
    ).querySelector('meta')!;
    expect(check(node)).toBe(true);
  });

  it('ignores malformed directives without an equals sign', () => {
    expect(check(viewport('width=device-width, garbage, user-scalable=no'))).toBe(false);
  });

  it('PASSES when maximum-scale is non-numeric (cannot prove a cap)', () => {
    expect(check(viewport('width=device-width, maximum-scale=abc'))).toBe(true);
  });
});
