// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Test helper analyzer + snapshot enricher.
 *
 * The bundled `colorContrastAnalyzer` from @ariada-org/core-engine relies on
 * adapter-supplied per-node `__fg` / `__bg` / `__large` AXNode properties.
 * In production, the chrome-extension adapter (or a future `core-playwright`
 * snapshot decorator) is responsible for populating those. For E2E purposes
 * we need to PROVE the same contract works end-to-end against a real
 * browser. This module provides:
 *
 *   1. `enrichSnapshotWithComputedContrast()` — walks the live page,
 *      extracts computed fg/bg/font-size for every element in the DOM
 *      outline, and patches matching AX nodes with `__fg` / `__bg` /
 *      `__large` properties.
 *
 *   2. `createPageContrastAnalyzer()` — a `DomainAnalyzer` that delegates
 *      to the bundled `colorContrastAnalyzer`, after running the enricher
 *      against the supplied snapshot + page. This proves the existing
 *      analyzer interface works with a real-browser-sourced contrast input.
 *
 * Doesn't modify the bundled analyzer source — it composes on top of the
 * stable interface (`DomainAnalyzer.analyze(AnalyzerContext)`).
 */

import {
  colorContrastAnalyzer,
  type AnalyzerContext,
  type AXNode,
  type DomainAnalyzer,
  type Finding,
  type UnifiedSnapshot,
} from '@ariada-org/core-engine';
import type { Page } from 'playwright';

interface ComputedContrast {
  selector: string;
  fg: string;
  bg: string;
  large: boolean;
  text: string;
}

/**
 * Pull computed-style fg/bg + font-size for every element matching the
 * standard "interactive + textual" selector set used by the DOM outline.
 * Walks the document inside the page, returning a flat list of computed
 * contrast records keyed by a CSS-ish selector for matching against the
 * snapshot's domOutline.
 */
async function readComputedContrast(page: Page): Promise<ComputedContrast[]> {
  return page.evaluate(() => {
    const SELECTOR =
      'h1, h2, h3, h4, h5, h6, a, button, img, input, select, textarea, [role], [aria-label], p, li, label, [tabindex]';

    const out: Array<{
      selector: string;
      fg: string;
      bg: string;
      large: boolean;
      text: string;
    }> = [];

    function selectorFor(el: Element, sameTagIdx: number): string {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute('id');
      if (id) return `${tag}#${id}`;
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
      if (cls) return `${tag}.${cls}`;
      return `${tag}:nth-of-type(${sameTagIdx})`;
    }

    function effectiveBg(el: Element): string {
      // Walk up until we find a non-transparent background.
      let cur: Element | null = el;
      while (cur) {
        const cs = window.getComputedStyle(cur);
        const bg = cs.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        cur = cur.parentElement;
      }
      return 'rgb(255, 255, 255)'; // assume page bg = white
    }

    const seenByTag = new Map<string, number>();
    // NodeListOf<Element> not iterable in the page.evaluate context with this tsconfig;
    // keep forEach despite unicorn/no-array-for-each preference.
    // eslint-disable-next-line unicorn/no-array-for-each
    document.querySelectorAll(SELECTOR).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const used = (seenByTag.get(tag) ?? 0) + 1;
      seenByTag.set(tag, used);

      const cs = window.getComputedStyle(el);
      const fg = cs.color;
      const bg = effectiveBg(el);
      // WCAG "large text" = ≥ 18 pt (24 px) OR ≥ 14 pt (18.66 px) bold.
      const sizePx = parseFloat(cs.fontSize || '16');
      const weight = parseInt(cs.fontWeight || '400', 10);
      const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
      const text = (el.textContent ?? '').trim().slice(0, 80);

      out.push({
        selector: selectorFor(el, used),
        fg,
        bg,
        large,
        text,
      });
    });
    return out;
  });
}

/**
 * Patch the snapshot's AX-tree with synthetic AX nodes carrying
 * `__fg` / `__bg` / `__large` properties — one per matched DOM-outline node.
 *
 * Why synthetic? In a non-extension Playwright environment, the AX-tree CDP
 * dump doesn't include style data. Production design is to compose enriched
 * AX nodes from CDP + computed-style; this helper does the composition
 * inline for the E2E test surface.
 *
 * Returns a NEW snapshot — does not mutate the input.
 */
export async function enrichSnapshotWithComputedContrast(
  snapshot: UnifiedSnapshot,
  page: Page,
): Promise<UnifiedSnapshot> {
  const computed = await readComputedContrast(page);

  // Build a selector → record lookup.
  const bySelector = new Map<string, ComputedContrast>();
  for (const c of computed) bySelector.set(c.selector, c);

  const extraNodes: AXNode[] = [];
  let synthId = 1_000_000;
  for (const dom of snapshot.domOutline) {
    const hit = bySelector.get(dom.selector);
    if (!hit) continue;
    extraNodes.push({
      nodeId: `synth-${synthId++}`,
      backendDOMNodeId: dom.backendNodeId,
      role: { type: 'role', value: dom.nodeName },
      name: { type: 'computedString', value: hit.text },
      properties: [
        { name: '__fg', value: { type: 'string', value: hit.fg } },
        { name: '__bg', value: { type: 'string', value: hit.bg } },
        { name: '__large', value: { type: 'boolean', value: hit.large } },
      ],
    });
  }

  return {
    ...snapshot,
    axTree: [...snapshot.axTree, ...extraNodes],
  };
}

/**
 * DomainAnalyzer wrapper that enriches the snapshot in-place from the live
 * page before delegating to the bundled colorContrastAnalyzer. Proves the
 * bundled analyzer works against real-browser-sourced contrast inputs without
 * modifying its source.
 */
export function createPageContrastAnalyzer(): DomainAnalyzer {
  return {
    domain: colorContrastAnalyzer.domain,
    version: colorContrastAnalyzer.version,
    ruleIds: colorContrastAnalyzer.ruleIds,
    async analyze(ctx: AnalyzerContext): Promise<Finding[]> {
      const page = ctx.page as Page;
      const enriched = await enrichSnapshotWithComputedContrast(ctx.snapshot, page);
      const enrichedCtx: AnalyzerContext = {
        snapshot: enriched,
        page: ctx.page,
        logger: ctx.logger,
      };
      return colorContrastAnalyzer.analyze(enrichedCtx);
    },
  };
}
