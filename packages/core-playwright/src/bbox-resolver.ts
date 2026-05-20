// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { BoundingBox, BoundingBoxResolver } from '@ariada/core-engine';
import type { Page } from 'playwright';

/**
 * Playwright-backed bounding-box resolver. Returns a (0,0,0,0) box for any
 * selector the page-context can't reach within the timeout, mirroring the
 * pre-split `safeBoundingBox` behaviour so element-iter events stay aligned.
 */
export function createPlaywrightBoundingBoxResolver(
  page: Page,
  timeoutMs = 1500,
): BoundingBoxResolver {
  return {
    async resolve(selector: string): Promise<BoundingBox> {
      try {
        const box = await page.locator(selector).first().boundingBox({ timeout: timeoutMs });
        if (box) return { x: box.x, y: box.y, w: box.width, h: box.height };
      } catch {
        // selector unreachable
      }
      return { x: 0, y: 0, w: 0, h: 0 };
    },
  };
}
