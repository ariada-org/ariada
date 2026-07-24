// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/// <reference lib="dom" />
/**
 * Production contrast pass for the Playwright capture path.
 *
 * The `readComputedContrast` body runs inside `page.evaluate` (browser
 * context), so it uses DOM globals (`document`, `window`, `Element`); the
 * `dom` lib reference above supplies their types for this file only.
 *
 * The bundled `colorContrastAnalyzer` (@ariada-org/core-engine) computes SC
 * 1.4.3 contrast, but only for AX nodes that carry adapter-supplied
 * `__fg` / `__bg` / `__large` colour properties. A plain CDP AX-tree dump has
 * no style data, so without this enrichment the analyzer runs but finds
 * nothing — which is exactly how the reference contrast checks went silent.
 *
 * This module walks the live page's computed styles, patches the assembled
 * snapshot's AX tree with the colour properties, and runs the bundled analyzer
 * — yielding DEFINITE contrast violations (e.g. white-on-white 1:1) rather than
 * only axe's needs-review bucket.
 */
import {
  colorContrastAnalyzer,
  createNullLogger,
  type AXNode,
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
 * Pull computed-style foreground/background/large-text for every textual or
 * interactive element, keyed by a selector that matches the DOM outline's
 * selector convention (so the records can be joined to AX nodes).
 */
async function readComputedContrast(page: Page): Promise<ComputedContrast[]> {
  return page.evaluate(() => {
    const SELECTOR =
      'h1, h2, h3, h4, h5, h6, a, button, img, input, select, textarea, [role], [aria-label], p, li, label, [tabindex]';

    function selectorFor(el: Element, sameTagIdx: number): string {
      const tag = el.tagName.toLowerCase();
      const id = el.getAttribute('id');
      if (id) return `${tag}#${id}`;
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
      if (cls) return `${tag}.${cls}`;
      return `${tag}:nth-of-type(${sameTagIdx})`;
    }

    function effectiveBg(el: Element): string {
      let cur: Element | null = el;
      while (cur) {
        const bg = window.getComputedStyle(cur).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        cur = cur.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }

    const out: ComputedContrast[] = [];
    const seenByTag = new Map<string, number>();
    // eslint-disable-next-line unicorn/no-array-for-each
    document.querySelectorAll(SELECTOR).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const used = (seenByTag.get(tag) ?? 0) + 1;
      seenByTag.set(tag, used);
      const cs = window.getComputedStyle(el);
      const sizePx = parseFloat(cs.fontSize || '16');
      const weight = parseInt(cs.fontWeight || '400', 10);
      out.push({
        selector: selectorFor(el, used),
        fg: cs.color,
        bg: effectiveBg(el),
        large: sizePx >= 24 || (sizePx >= 18.66 && weight >= 700),
        text: (el.textContent ?? '').trim().slice(0, 80),
      });
    });
    return out;
  });
}

/**
 * Return a NEW snapshot whose AX tree is augmented with synthetic nodes
 * carrying `__fg` / `__bg` / `__large` for every DOM-outline node that matched
 * a computed-style record. Does not mutate the input.
 */
export async function enrichSnapshotWithComputedContrast(
  snapshot: UnifiedSnapshot,
  page: Page,
): Promise<UnifiedSnapshot> {
  const computed = await readComputedContrast(page);
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

  return { ...snapshot, axTree: [...snapshot.axTree, ...extraNodes] };
}

/**
 * Enrich the assembled snapshot with live computed-style colours and run the
 * bundled contrast analyzer, returning its findings. Never throws — a contrast
 * pass failure must not fail the whole capture; it returns `[]` instead.
 */
export async function computeContrastFindings(
  snapshot: UnifiedSnapshot,
  page: Page,
): Promise<Finding[]> {
  try {
    const enriched = await enrichSnapshotWithComputedContrast(snapshot, page);
    return await colorContrastAnalyzer.analyze({
      snapshot: enriched,
      page,
      logger: createNullLogger(),
    });
  } catch {
    return [];
  }
}
