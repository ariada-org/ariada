// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Frame, Page } from 'playwright';
import { describe, expect, it } from 'vitest';

import { listFrames } from '../src/cdp.js';

function makePage(frames: Frame[]): Page {
  return { frames: (): Frame[] => frames } as unknown as Page;
}

describe('listFrames', () => {
  it('returns the page frames verbatim', () => {
    const frames = [{ id: 'main' }, { id: 'child' }] as unknown as Frame[];
    const page = makePage(frames);
    expect(listFrames(page)).toBe(frames);
  });

  it('returns an empty array when the page has no frames', () => {
    expect(listFrames(makePage([]))).toEqual([]);
  });

  it('preserves frame order', () => {
    const a = { name: 'a' } as unknown as Frame;
    const b = { name: 'b' } as unknown as Frame;
    const c = { name: 'c' } as unknown as Frame;
    expect(listFrames(makePage([a, b, c]))).toEqual([a, b, c]);
  });
});
