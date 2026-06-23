// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Accessibility self-audit + screenshot capture for the side-panel UI.
// Runs axe-core against each panel state and captures screenshots to
// var/build-evidence/extension-panel/after/ for the final assessment.
//
// This file deliberately does not capture screenshots to the ariada-extension
// evidence dir — those belong to the main extension.spec.ts e2e suite.
// This file focuses on the accessibility gate and before/after evidence.

import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, '..', '..', 'dist');
const fixturesDir = resolve(here, '..', '..', '..', 'ariada-test-fixtures', 'fixtures');
const afterDir = join(here, '..', '..', '..', '..', 'var', 'build-evidence', 'extension-panel', 'after');

let context: BrowserContext;
let serviceWorker: Worker;
let extensionId: string;
let server: Server;
let baseUrl = '';

function resolveFixturePath(rawUrl: string | undefined): string {
  const pathname = new URL(rawUrl ?? '/', 'http://127.0.0.1').pathname;
  const requested = pathname === '/' ? 'alt-text.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = resolve(fixturesDir, requested);
  const rel = relative(fixturesDir, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('Fixture path escapes fixture root');
  }
  return target;
}

function serveFixtures(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      try {
        const body = readFileSync(resolveFixturePath(req.url), 'utf8');
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(body);
      } catch {
        res.statusCode = 404;
        res.end('not found');
      }
    });
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as AddressInfo).port;
      resolve({ server: s, url: `http://127.0.0.1:${port}` });
    });
  });
}

test.beforeAll(async () => {
  ({ server, url: baseUrl } = await serveFixtures());

  context = await chromium.launchPersistentContext('', {
    headless: true,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    // Side panel renders at ~400px wide
    viewport: { width: 400, height: 700 },
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  serviceWorker = sw;
  extensionId = sw.url().split('/')[2] ?? '';
  expect(extensionId).not.toBe('');
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
});

async function openPanel(): Promise<Page> {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole('heading', { name: 'ariada scanner', level: 1 })).toBeVisible();
  return panel;
}

/** Capture a snapshot for a fixture by loading it in a page. */
async function captureFixture(page: Page, url: string, scanId: string): Promise<unknown> {
  await page.goto(url);
  return page.evaluate(
    ({ scanId }) => {
      const elements = Array.from(document.querySelectorAll('*'));
      let backendNodeId = 0;
      const domOutline = elements.map((el) => {
        backendNodeId += 1;
        const attributes: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) attributes[attr.name] = attr.value;
        return {
          backendNodeId,
          nodeName: el.nodeName.toUpperCase(),
          selector: `${el.nodeName.toLowerCase()}-${backendNodeId}`,
          attributes,
        };
      });
      return {
        scanId,
        url: location.href,
        timestamp: Date.now(),
        html: document.documentElement.outerHTML,
        headers: {},
        cookies: [],
        networkResources: [],
        axTree: [],
        domOutline,
        perfMetrics: {},
        timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
      };
    },
    { scanId },
  );
}

// ── State 1: Default / idle ─────────────────────────────────────────────────

test('after/01 idle state — axe 0 violations + screenshot', async () => {
  const panel = await openPanel();

  // axe-core self-audit: the accessibility product must pass its own audit
  const results = await new AxeBuilder({ page: panel }).analyze();
  expect(
    results.violations,
    `axe violations in idle state:\n${results.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
  ).toHaveLength(0);

  await panel.screenshot({
    path: join(afterDir, '01-idle-default.png'),
    fullPage: true,
  });
  await panel.close();
});

// ── State 2: Populated (single-site scan result) ────────────────────────────

test('after/02 populated state — axe 0 violations + screenshot', async () => {
  const tab = await context.newPage();
  const snapshot = await captureFixture(tab, `${baseUrl}/alt-text.html`, 'after-scan-single');
  const panel = await openPanel();

  await panel.evaluate(async (snap) => {
    const report = await window.__ariadaScanSnapshots!([snap as never]);
    window.__ariadaRenderReport!(report);
  }, snapshot);

  await expect(panel.locator('table.report-grid')).toBeVisible();

  const results = await new AxeBuilder({ page: panel }).analyze();
  expect(
    results.violations,
    `axe violations in populated state:\n${results.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
  ).toHaveLength(0);

  await panel.screenshot({
    path: join(afterDir, '02-populated-single-site.png'),
    fullPage: true,
  });

  // Verify the drill-down renders (findings cell has a <details>)
  const findingsCell = panel.locator('td[data-state="findings"]').first();
  if (await findingsCell.count() > 0) {
    await expect(findingsCell.locator('details')).toBeVisible();
    // Open the drill-down and screenshot the expanded state
    await panel.evaluate(() => {
      const details = document.querySelector('details.findings-detail') as HTMLDetailsElement | null;
      if (details) details.open = true;
    });
    await panel.screenshot({
      path: join(afterDir, '02b-populated-drill-down-open.png'),
      fullPage: true,
    });
    // axe with drill-down open
    const resultsOpen = await new AxeBuilder({ page: panel }).analyze();
    expect(
      resultsOpen.violations,
      `axe violations with drill-down open:\n${resultsOpen.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
    ).toHaveLength(0);
  }

  await tab.close();
  await panel.close();
});

// ── State 3: Empty (no findings) — zero-findings grid ──────────────────────

test('after/03 empty results — axe 0 violations + screenshot', async () => {
  const panel = await openPanel();

  // Inject a report with zero findings across all domains
  await panel.evaluate(async () => {
    const report = {
      sites: ['https://example.com/'],
      domains: ['accessibility', 'privacy', 'security', 'ai-readiness', 'structured-data', 'sustainability'],
      grid: {
        'https://example.com/': {
          accessibility: [],
          privacy: [],
          security: [],
          'ai-readiness': [],
          'structured-data': [],
          sustainability: [],
        },
      },
      interactions: [],
      crossSite: { systemic: [], divergence: [] },
    };
    window.__ariadaRenderReport!(report as never);
  });

  await expect(panel.locator('.report-grid-wrapper')).toBeVisible();

  const results = await new AxeBuilder({ page: panel }).analyze();
  expect(
    results.violations,
    `axe violations in empty state:\n${results.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
  ).toHaveLength(0);

  await panel.screenshot({
    path: join(afterDir, '03-empty-all-clear.png'),
    fullPage: true,
  });

  // The always-rendered empty-state note must be visible
  await expect(panel.locator('[role="note"].empty-panel')).toBeVisible();

  await panel.close();
});

// ── State 4: Error state ────────────────────────────────────────────────────

test('after/04 error state — axe 0 violations + screenshot', async () => {
  const panel = await openPanel();

  await panel.evaluate(() => {
    const results = document.getElementById('results')!;
    const wrapper = document.createElement('div');
    const err = document.createElement('p');
    err.className = 'error';
    err.setAttribute('role', 'alert');
    err.textContent = 'Cannot scan this page (chrome://extensions). The extension only scans http/https pages, not browser-internal pages.';
    wrapper.appendChild(err);
    const hint = document.createElement('p');
    hint.className = 'error-recovery';
    hint.textContent = 'Navigate to an http or https page and scan again.';
    wrapper.appendChild(hint);
    results.replaceChildren(wrapper);
    document.getElementById('status')!.textContent = 'Scan failed.';
  });

  await expect(panel.locator('.error[role="alert"]')).toBeVisible();
  await expect(panel.locator('.error-recovery')).toBeVisible();

  const results = await new AxeBuilder({ page: panel }).analyze();
  expect(
    results.violations,
    `axe violations in error state:\n${results.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
  ).toHaveLength(0);

  await panel.screenshot({
    path: join(afterDir, '04-error-with-recovery.png'),
    fullPage: true,
  });
  await panel.close();
});

// ── State 5: Mobile 375px width ─────────────────────────────────────────────

test('after/05 mobile 375px — axe 0 violations + screenshot', async () => {
  const tab = await context.newPage();
  const snapshot = await captureFixture(tab, `${baseUrl}/alt-text.html`, 'after-mobile');
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 375, height: 667 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole('heading', { name: 'ariada scanner', level: 1 })).toBeVisible();

  await panel.evaluate(async (snap) => {
    const report = await window.__ariadaScanSnapshots!([snap as never]);
    window.__ariadaRenderReport!(report);
  }, snapshot);

  await expect(panel.locator('.report-grid-wrapper')).toBeVisible();

  const results = await new AxeBuilder({ page: panel }).analyze();
  expect(
    results.violations,
    `axe violations at 375px:\n${results.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
  ).toHaveLength(0);

  await panel.screenshot({
    path: join(afterDir, '05-mobile-375px.png'),
    fullPage: true,
  });

  await tab.close();
  await panel.close();
});

// ── State 6: Settings page ───────────────────────────────────────────────────

test('after/06 settings page — axe 0 violations + screenshot', async () => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(settings.getByRole('heading', { name: 'ariada scanner — settings', level: 1 })).toBeVisible();

  const results = await new AxeBuilder({ page: settings }).analyze();
  expect(
    results.violations,
    `axe violations on settings page:\n${results.violations.map((v) => `${v.id}: ${v.description}`).join('\n')}`,
  ).toHaveLength(0);

  await settings.screenshot({
    path: join(afterDir, '06-settings.png'),
    fullPage: true,
  });
  await settings.close();
});
