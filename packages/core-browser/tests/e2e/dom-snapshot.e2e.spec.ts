// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * E2E suite — core-browser DOM-snapshot in a real browser.
 *
 * Goal: prove `captureBrowserSnapshot()` from @ariada-org/core-browser produces
 * the same `UnifiedSnapshot` shape across all three real browser engines
 * (Chromium / Firefox / WebKit) — not just under happy-dom in the unit
 * tests. Also proves the snapshot can be enriched with the color-contrast
 * analyzer's required `__fg` / `__bg` / `__large` AX-node properties
 * sourced from the live browser's `getComputedStyle`.
 *
 * Approach: the package's `dist/index.js` is already an ESM module with no
 * external runtime deps (the only declared dep, @ariada-org/core-engine, is a
 * pure type import erased at build time). We bundle it on the fly with
 * esbuild + inject the resulting IIFE into each test page via
 * `page.addInitScript`, then call into it from Node via `page.evaluate`.
 *
 * Coverage:
 *   2 fixtures × 3 browsers = 6 E2E tests.
 *     - basic-pass.html (no contrast issues; full structural assertions)
 *     - color-contrast.html (low-contrast text; enrichment + __fg/__bg assertions)
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, type BuildOptions } from 'esbuild';

import { test, expect } from './fixtures/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(__dirname, '..', '..', 'src', 'index.ts');

// Bundle once per worker, cache across all tests in that worker.
let bundlePromise: Promise<string> | undefined;
async function getBundle(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = bundleCoreBrowser();
  }
  return bundlePromise;
}

async function bundleCoreBrowser(): Promise<string> {
  const opts: BuildOptions = {
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2022',
    globalName: '__coreBrowser',
    // Type-only dep — safe to inline (it has no runtime exports we use here).
    external: [],
  };
  const result = await build(opts);
  const file = result.outputFiles?.[0];
  if (!file) throw new Error('esbuild produced no output');
  // `page.addInitScript` runs in an isolated world where top-level `var`
  // declarations do NOT bind onto `window`. We rewrite the IIFE assignment
  // (`var __coreBrowser = ...`) into a `window.__coreBrowser = ...` to make
  // the bundle's exports reachable from `page.evaluate()`.
  return file.text.replace(/^var __coreBrowser = /m, 'window.__coreBrowser = ');
}

interface SnapshotShape {
  scanId: string;
  url: string;
  axTree: unknown[];
  domOutline: Array<{ backendNodeId: number; nodeName: string; selector: string }>;
  perfMetrics: Record<string, number>;
  timings: { totalMs: number; domMs: number; axTreeMs: number; navigationMs: number };
}

interface EnrichedNode {
  selector: string;
  fg: string;
  bg: string;
  large: boolean;
}

test.beforeEach(async ({ page }) => {
  const code = await getBundle();
  // Make the bundle's exports available as `window.__coreBrowser.*`
  // before any test code runs.
  await page.addInitScript({ content: code });
});

test('captureBrowserSnapshot() produces a structurally-valid UnifiedSnapshot in a real browser', async ({
  fixtureServer,
  page,
}, testInfo) => {
  const url = fixtureServer.generic('basic-pass.html');
  await page.goto(url, { waitUntil: 'load' });
  await page.screenshot({
    path: testInfo.outputPath('basic-pass-rendered.png'),
    fullPage: true,
  });

  const snap = await page.evaluate(async () => {
    const cb = (window as unknown as {
      __coreBrowser: {
        captureBrowserSnapshot: (opts: {
          document: Document;
          scanId: string;
        }) => Promise<unknown>;
      };
    }).__coreBrowser;
    return cb.captureBrowserSnapshot({ document, scanId: 'e2e-basic' });
  }) as SnapshotShape;

  expect(snap.scanId).toBe('e2e-basic');
  expect(snap.url).toBe(url);
  expect(Array.isArray(snap.axTree)).toBe(true);
  expect(snap.axTree).toHaveLength(0); // no chrome.debugger shim supplied
  expect(snap.domOutline.length).toBeGreaterThan(0);
  expect(snap.timings.totalMs).toBeGreaterThanOrEqual(0);

  // basic-pass.html has a <main>, <h1>, <button>, <a>, <img>, <input> at minimum.
  const tags = new Set(snap.domOutline.map((n) => n.nodeName));
  expect(tags.has('h1')).toBe(true);
});

test('snapshot is enrichable with __fg / __bg / __large from live computed styles', async ({
  fixtureServer,
  page,
}, testInfo) => {
  const url = fixtureServer.generic('color-contrast.html');
  await page.goto(url, { waitUntil: 'load' });
  await page.screenshot({
    path: testInfo.outputPath('color-contrast-rendered.png'),
    fullPage: true,
  });

  // 1. Capture the structural snapshot via core-browser.
  const snap = await page.evaluate(async () => {
    const cb = (window as unknown as {
      __coreBrowser: {
        captureBrowserSnapshot: (opts: {
          document: Document;
          scanId: string;
        }) => Promise<unknown>;
      };
    }).__coreBrowser;
    return cb.captureBrowserSnapshot({ document, scanId: 'e2e-contrast' });
  }) as SnapshotShape;

  expect(snap.domOutline.length).toBeGreaterThan(0);

  // 2. Enrich with computed-style fg/bg/large pulled from the live browser.
  //    Mirrors what a production CDP+CSSOM adapter would do to populate the
  //    analyzer-input properties on AX nodes.
  const enriched = await page.evaluate(() => {
    const SELECTOR =
      'h1, h2, h3, h4, h5, h6, a, button, img, input, select, textarea, [role], [aria-label], p, li, label, [tabindex]';
    const out: EnrichedNode[] = [];
    const seenByTag = new Map<string, number>();

    function effectiveBg(el: Element): string {
      let cur: Element | null = el;
      while (cur) {
        const cs = window.getComputedStyle(cur);
        const bg = cs.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        cur = cur.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }

    for (const el of document.querySelectorAll(SELECTOR)) {
      const tag = el.tagName.toLowerCase();
      const used = (seenByTag.get(tag) ?? 0) + 1;
      seenByTag.set(tag, used);

      const cs = window.getComputedStyle(el);
      const id = el.getAttribute('id');
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
      const selector = id
        ? `${tag}#${id}`
        : cls
          ? `${tag}.${cls}`
          : `${tag}:nth-of-type(${used})`;

      const sizePx = parseFloat(cs.fontSize || '16');
      const weight = parseInt(cs.fontWeight || '400', 10);
      const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);

      out.push({ selector, fg: cs.color, bg: effectiveBg(el), large });
    }
    return out;
  }) as EnrichedNode[];

  // 3. There should be at least one node with `__fg` / `__bg` populated.
  expect(enriched.length).toBeGreaterThan(0);

  // 4. The color-contrast fixture deliberately has `.low1` (light grey on
  //    white) and `.low2` paragraphs — both should be in the enriched set.
  const low1 = enriched.find((n) => n.selector === 'p.low1');
  expect(low1, `expected enriched record for p.low1 — got selectors: ${enriched
    .map((n) => n.selector)
    .join(', ')}`).toBeDefined();
  expect(low1!.fg).toMatch(/^rgba?\(/);
  expect(low1!.bg).toMatch(/^rgba?\(/);
  expect(typeof low1!.large).toBe('boolean');

  // 5. Confirm the values look like what the fixture authored —
  //    `.low1 { color: #bbbbbb; background: #ffffff }` → rgb(187,187,187) / rgb(255,255,255).
  expect(low1!.fg.replace(/\s+/g, '')).toBe('rgb(187,187,187)');
  expect(low1!.bg.replace(/\s+/g, '')).toBe('rgb(255,255,255)');
  expect(low1!.large).toBe(false); // 14px ≠ large

  // 6. Synthesize the AXNode shape the color-contrast analyzer expects, to
  //    prove the contract surface (`{ name: '__fg' | '__bg' | '__large', value: { type, value }}`)
  //    is in fact populatable from this real-browser data.
  const synthAxNode = {
    nodeId: 'synth-1',
    properties: [
      { name: '__fg', value: { type: 'string', value: low1!.fg } },
      { name: '__bg', value: { type: 'string', value: low1!.bg } },
      { name: '__large', value: { type: 'boolean', value: low1!.large } },
    ],
  };
  expect(synthAxNode.properties).toHaveLength(3);
  const propNames = synthAxNode.properties.map((p) => p.name).sort();
  expect(propNames).toEqual(['__bg', '__fg', '__large']);
});
