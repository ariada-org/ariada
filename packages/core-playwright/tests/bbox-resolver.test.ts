// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { Page } from 'playwright';
import { describe, expect, it } from 'vitest';

import { createPlaywrightBoundingBoxResolver } from '../src/bbox-resolver.js';

function makePage(behaviour: {
  box?: { x: number; y: number; width: number; height: number } | null;
  throws?: boolean;
}): Page {
  const fake = {
    locator(_: string) {
      return {
        first() {
          return {
            async boundingBox(): Promise<
              { x: number; y: number; width: number; height: number } | null
            > {
              if (behaviour.throws) throw new Error('locator timeout');
              return behaviour.box ?? null;
            },
          };
        },
      };
    },
  };
  return fake as unknown as Page;
}

describe('createPlaywrightBoundingBoxResolver', () => {
  it('maps Playwright box → ariada bbox shape', async () => {
    const resolver = createPlaywrightBoundingBoxResolver(
      makePage({ box: { x: 10, y: 20, width: 100, height: 50 } }),
    );
    expect(await resolver.resolve('h1')).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });

  it('returns zero-box when locator throws', async () => {
    const resolver = createPlaywrightBoundingBoxResolver(makePage({ throws: true }));
    expect(await resolver.resolve('h1')).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('returns zero-box when locator returns null', async () => {
    const resolver = createPlaywrightBoundingBoxResolver(makePage({ box: null }));
    expect(await resolver.resolve('h1')).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
