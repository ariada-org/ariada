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
  buildElementSelector,
  colorContrastAnalyzer,
  contrastRatio,
  createNullLogger,
  FINDING_ELEMENTS as CONTRAST_ELEMENTS,
  LARGE_TEXT_RATIO,
  NORMAL_TEXT_RATIO,
  parseColor,
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
  // The selector is the key these records are joined to the DOM outline by, so
  // it has to be built by the same function the outline used. Naming the
  // elements here, from their handles, is what keeps the two in step — a second
  // implementation would drift and the join would quietly stop matching,
  // dropping every contrast finding without an error anywhere.
  const handles = await page.$$(CONTRAST_ELEMENTS);
  const selectors = await Promise.all(
    handles.map((handle) =>
      page
        .mainFrame()
        .evaluate(buildElementSelector, handle)
        .catch(() => undefined),
    ),
  );
  await Promise.all(handles.map((handle) => handle.dispose().catch(() => undefined)));

  const styles = await page.evaluate((selector: string) => {
    function effectiveBg(el: Element): string {
      let cur: Element | null = el;
      while (cur) {
        const bg = window.getComputedStyle(cur).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        cur = cur.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }

    // Read in the same query order the handles above were taken in, so record
    // and name line up by position.
    return Array.from(document.querySelectorAll(selector)).map((el) => {
      const cs = window.getComputedStyle(el);
      const sizePx = parseFloat(cs.fontSize || '16');
      const weight = parseInt(cs.fontWeight || '400', 10);
      return {
        fg: cs.color,
        bg: effectiveBg(el),
        large: sizePx >= 24 || (sizePx >= 18.66 && weight >= 700),
        text: (el.textContent ?? '').trim().slice(0, 80),
      };
    });
  }, CONTRAST_ELEMENTS);

  const out: ComputedContrast[] = [];
  for (const [i, style] of styles.entries()) {
    const selector = selectors[i];
    if (selector) out.push({ selector, ...style });
  }
  return out;
}

/**
 * Return a NEW snapshot whose AX tree is augmented with synthetic nodes
 * carrying `__fg` / `__bg` / `__large` for every DOM-outline node that matched
 * a computed-style record. Does not mutate the input.
 */
export async function enrichSnapshotWithComputedContrast(
  snapshot: UnifiedSnapshot,
  page: Page,
  precomputed?: ComputedContrast[],
): Promise<UnifiedSnapshot> {
  const computed = precomputed ?? await readComputedContrast(page);
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
 * Ask the page about specific selectors, in the dialect they were written in.
 *
 * The first attempt at closing undecided findings tried to join two sets of
 * selectors, and they are not the same language: the outline says
 * `li:nth-of-type(1) > strong:nth-of-type(1)` where the rule library says
 * `li:nth-child(1) > strong`. Two correct selectors for one element, and no
 * string comparison will ever put them together.
 *
 * So there is no join. Each undecided selector is handed back to the page that
 * produced it, and the page says what the element's colours are. A selector
 * that matches nothing, or more than one thing, gets no answer — a question
 * about an element we cannot pick out is still open.
 */
export async function contrastForSelectors(
  page: Page,
  selectors: readonly string[],
): Promise<Map<string, { fg: string; bg: string; large: boolean }>> {
  const answers = new Map<string, { fg: string; bg: string; large: boolean }>();
  if (selectors.length === 0) return answers;

  const raw = await page.evaluate((list: readonly string[]) => {
    // The same walk up the ancestors appears in the pass above. It cannot be
    // shared: the body of an evaluate is serialised and run inside the page,
    // where nothing from this module exists, and the only ways to inject a
    // function across that boundary build it from a string — which a page with
    // a strict content policy refuses, on exactly the sites a scanner must not
    // fail on.
    // eslint-disable-next-line sonarjs/no-identical-functions
    function effectiveBg(el: Element): string {
      let cur: Element | null = el;
      while (cur) {
        const bg = window.getComputedStyle(cur).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        cur = cur.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }
    return list.map((selector) => {
      let matches: Element[];
      try {
        matches = Array.from(document.querySelectorAll(selector));
      } catch {
        return { selector, ok: false as const };
      }
      // Exactly one, or the answer is about some other element as much as this.
      if (matches.length !== 1) return { selector, ok: false as const };
      const el = matches[0]!;
      const cs = window.getComputedStyle(el);
      const sizePx = parseFloat(cs.fontSize || '16');
      const weight = parseInt(cs.fontWeight || '400', 10);
      return {
        selector,
        ok: true as const,
        fg: cs.color,
        bg: effectiveBg(el),
        large: sizePx >= 24 || (sizePx >= 18.66 && weight >= 700),
      };
    });
  }, selectors);

  for (const entry of raw) {
    if (entry.ok) answers.set(entry.selector, { fg: entry.fg, bg: entry.bg, large: entry.large });
  }
  return answers;
}

/** What the computed-colour pass found, and which elements it was able to judge. */
export interface ComputedContrastPass {
  /** Elements whose ratio misses the threshold. */
  findings: Finding[];
  /**
   * Selectors the browser resolved a foreground and background for.
   *
   * This set is the point. The rule library hands us elements it could not
   * decide, and this pass decides them — but it returns only the failures, so
   * "resolved and compliant" used to be indistinguishable from "could not
   * resolve", and an undecided finding could never be closed. Measured on this
   * project's own site: eleven questions at serious severity for which the
   * answer had already been obtained in the same run and thrown away.
   */
  resolved: Set<string>;
  /** Of those, the ones that failed — by selector, so the two sets subtract. */
  failed: Set<string>;
}

/**
 * Enrich the assembled snapshot with live computed-style colours and run the
 * bundled contrast analyzer. Never throws — a contrast pass failure must not
 * fail the whole capture; it returns an empty pass instead.
 */
export async function computeContrastFindings(
  snapshot: UnifiedSnapshot,
  page: Page,
): Promise<ComputedContrastPass> {
  try {
    const computed = await readComputedContrast(page);
    const resolved = new Set(computed.map((c) => c.selector));
    const enriched = await enrichSnapshotWithComputedContrast(snapshot, page, computed);
    const findings = await colorContrastAnalyzer.analyze({
      snapshot: enriched,
      page,
      logger: createNullLogger(),
    });

    // The analyzer names its element by backend node id; the outline is what
    // turns that back into the selector the rule library speaks.
    const selectorByBackendId = new Map<number, string>();
    for (const dom of snapshot.domOutline) selectorByBackendId.set(dom.backendNodeId, dom.selector);
    const failed = new Set<string>();
    for (const finding of findings) {
      const id = finding.element.backendNodeId;
      const selector = id === undefined ? undefined : selectorByBackendId.get(id);
      if (selector !== undefined) failed.add(selector);
    }

    return { findings, resolved, failed };
  } catch {
    return { findings: [], resolved: new Set(), failed: new Set() };
  }
}

/**
 * Drop the undecided contrast findings the page has now answered in the
 * affirmative, and keep every other finding untouched.
 *
 * Pure, and separate from the capture, because this is the part worth being
 * sure of: it decides what a report does not say. Over-removal is the failure
 * that matters — a finding dropped is a finding nobody sees again — so the
 * conditions are all conjunctive and the default is to keep.
 */
export function dropAnsweredContrastQuestions(
  findings: readonly Finding[],
  answers: ReadonlyMap<string, { fg: string; bg: string; large: boolean }>,
): Finding[] {
  const cleared = new Set<string>();
  for (const [selector, colours] of answers) {
    const fg = parseColor(colours.fg);
    const bg = parseColor(colours.bg);
    if (fg === null || bg === null) continue;
    const threshold = colours.large ? LARGE_TEXT_RATIO : NORMAL_TEXT_RATIO;
    if (contrastRatio(fg, bg) + 1e-9 >= threshold) cleared.add(selector);
  }
  if (cleared.size === 0) return [...findings];

  return findings.filter(
    (f) =>
      !(
        f.needsReview === true &&
        /contrast/i.test(f.ruleId) &&
        typeof f.element.selector === 'string' &&
        cleared.has(f.element.selector)
      ),
  );
}
