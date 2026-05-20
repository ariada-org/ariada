// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { BoundingBox, BoundingBoxResolver } from '@ariada/core-engine';

/**
 * DOM-backed bounding-box resolver. Returns a (0,0,0,0) box when the selector
 * doesn't match anything reachable from `document`, mirroring the Playwright
 * adapter's safe-fallback behaviour so element-iter event ordering stays
 * identical across runtimes.
 */
export function createDomBoundingBoxResolver(doc: Document): BoundingBoxResolver {
  return {
    async resolve(selector: string): Promise<BoundingBox> {
      try {
        const el = doc.querySelector(selector);
        if (!el) return { x: 0, y: 0, w: 0, h: 0 };
        // happy-dom's Element exposes getBoundingClientRect; jsdom returns
        // { x: 0, y: 0, ... } by default which is fine for our schema.
        const rect = (el as unknown as { getBoundingClientRect?: () => DOMRect })
          .getBoundingClientRect?.();
        if (!rect) return { x: 0, y: 0, w: 0, h: 0 };
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      } catch {
        return { x: 0, y: 0, w: 0, h: 0 };
      }
    },
  };
}
