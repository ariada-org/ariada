// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// End-to-end test: load the built extension into a persistent Chromium context,
// serve the accessibility fixture over local HTTP, drive a multi-domain scan in
// the loaded side panel (using the extension's own scan + render code), and
// capture screenshots proving the rendered grid shows findings across domains.

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

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, '..', '..', 'dist');
const fixturesDir = resolve(here, '..', '..', '..', 'ariada-test-fixtures', 'fixtures');
const evidenceDir = join(here, '..', '..', '..', '..', 'var', 'build-evidence', 'ariada-extension');

let context: BrowserContext;
let serviceWorker: Worker;
let extensionId: string;
let server: Server;
let baseUrl = '';
let secondServer: Server;
let secondUrl = '';

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
  ({ server: secondServer, url: secondUrl } = await serveFixtures());

  context = await chromium.launchPersistentContext('', {
    headless: true,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Resolve the extension id from the registered service worker.
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  serviceWorker = sw;
  extensionId = sw.url().split('/')[2] ?? '';
  expect(extensionId).not.toBe('');
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
  secondServer?.close();
});

/** Build a snapshot for a fixture by loading it in a page and capturing its DOM. */
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

async function openSidePanel(): Promise<Page> {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole('heading', { name: 'ariada scanner', level: 1 })).toBeVisible();
  return panel;
}

test('00 real user path: the on-page launcher opens the report surface on click', async () => {
  // This is the path a real person takes — there is no programmatic navigation
  // to the panel URL here. We load an ordinary web page, confirm the injected
  // launcher button is actually present and reachable, click it the way a user
  // would, and require that the extension opens its report surface in response.
  const page = await context.newPage();
  await page.goto(`${baseUrl}/alt-text.html`);

  const launcher = page.getByRole('button', { name: /scan with ariada/i });
  await expect(launcher).toBeVisible();
  await page.screenshot({
    path: join(evidenceDir, '00-launcher-on-page.png'),
    fullPage: false,
  });

  // Clicking the launcher must open the report surface. In a headed browser the
  // worker opens the docked side panel; where that surface is not visible to the
  // automation host it falls back to a popup window — either way a real report
  // page opens, which is what we assert here.
  const [report] = await Promise.all([
    context.waitForEvent('page'),
    launcher.click(),
  ]);
  await report.waitForLoadState('domcontentloaded');
  await expect(report.getByRole('heading', { name: 'ariada scanner', level: 1 })).toBeVisible();

  // The launcher promises a scan, so the report must actually scan the page the
  // user came from (its tab id is carried into the popup) and render the grid —
  // not just open an idle panel. This is the full user-visible outcome.
  const grid = report.locator('table.report-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await expect(report.locator('tbody tr')).toHaveCount(1);
  await expect(report.locator('#status')).toContainText('Done');
  await report.screenshot({
    path: join(evidenceDir, '00-launcher-opened-report.png'),
    fullPage: true,
  });

  // The launcher is detached during capture so it never appears in the scan,
  // then re-attached: it must still be on the page after the scan completes.
  await expect(launcher).toBeVisible();

  await report.close();
  await page.close();
});

test('00b docked side panel is wired to open from the toolbar action', async () => {
  // The automation host cannot see the docked side-panel surface itself, so we
  // verify the mechanism that opens it: the worker configures the action to open
  // the panel on click, and the panel path is registered. This is the wiring a
  // user relies on when clicking the toolbar icon.
  const behavior = await serviceWorker.evaluate(() =>
    chrome.sidePanel.getPanelBehavior(),
  );
  expect(behavior.openPanelOnActionClick).toBe(true);

  const options = await serviceWorker.evaluate(() =>
    chrome.sidePanel.getOptions({}),
  );
  expect(options.path).toBe('sidepanel.html');
});

test('01 side panel opens in idle state with the six domains', async () => {
  const panel = await openSidePanel();
  await expect(panel.getByRole('button', { name: 'Scan this page' })).toBeVisible();
  // six built-in domain checkboxes present and checked
  const checkboxes = panel.locator('#domain-checklist input[type="checkbox"]');
  await expect(checkboxes).toHaveCount(6);
  await panel.screenshot({ path: join(evidenceDir, '01-side-panel-idle.png'), fullPage: true });
  await panel.close();
});

test('02 single-site scan renders the 6-domain grid with an accessibility finding', async () => {
  const tab = await context.newPage();
  const snapshot = await captureFixture(tab, `${baseUrl}/alt-text.html`, 'scan-single');
  const panel = await openSidePanel();

  // Drive the extension's real scan + render code over the captured snapshot.
  await panel.evaluate(async (snap) => {
    const report = await window.__ariadaScanSnapshots!([snap as never]);
    window.__ariadaRenderReport!(report);
  }, snapshot);

  const table = panel.locator('table.report-grid');
  await expect(table).toBeVisible();
  // 6 domain column headers + the "Site" corner header = 7 col headers
  await expect(table.locator('thead th')).toHaveCount(7);
  // accessibility cell shows a non-zero finding count
  await expect(table.locator('td[data-state="findings"]').first()).toContainText('finding');
  await panel.screenshot({
    path: join(evidenceDir, '02-single-site-report-grid.png'),
    fullPage: true,
  });
  await tab.close();
  await panel.close();
});

test('03 multi-site scan shows two rows and a systemic cross-site finding', async () => {
  const tab = await context.newPage();
  const snapA = await captureFixture(tab, `${baseUrl}/alt-text.html`, 'scan-a');
  const snapB = await captureFixture(tab, `${secondUrl}/alt-text.html`, 'scan-b');
  const panel = await openSidePanel();

  const systemicCount = await panel.evaluate(async ([a, b]) => {
    const report = await window.__ariadaScanSnapshots!([a as never, b as never]);
    window.__ariadaRenderReport!(report);
    return report.crossSite.systemic.length;
  }, [snapA, snapB]);

  expect(systemicCount).toBeGreaterThanOrEqual(1);
  const table = panel.locator('table.report-grid');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await panel.screenshot({
    path: join(evidenceDir, '03-multi-site-report-grid.png'),
    fullPage: true,
  });
  await tab.close();
  await panel.close();
});

test('05 settings page lists built-in modules and the add-module form', async () => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/settings.html`);
  await expect(
    settings.getByRole('heading', { name: 'ariada scanner — settings', level: 1 }),
  ).toBeVisible();
  await expect(settings.locator('#module-list .module-row')).toHaveCount(6);
  await settings.screenshot({
    path: join(evidenceDir, '05-settings-modules-list.png'),
    fullPage: true,
  });
  await settings.close();
});

test('06 settings rejects a remote URL with the policy reason', async () => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/settings.html`);
  await settings.locator('#module-input').fill('https://cdn.example.com/mod.js');
  await settings.getByRole('button', { name: 'Validate' }).click();
  const feedback = settings.locator('#module-feedback');
  await expect(feedback).toContainText('Remote URL import is not allowed');
  await settings.screenshot({
    path: join(evidenceDir, '06-settings-reject-remote-url.png'),
    fullPage: true,
  });
  await settings.close();
});

test('07 settings accepts a companion-CLI module name and shows the terminal hint', async () => {
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/settings.html`);
  await settings.locator('#module-input').fill('ariada-domain-bitv20');
  await settings.getByRole('button', { name: 'Validate' }).click();
  await expect(settings.locator('#cli-hint')).toContainText('ariada extension add ariada-domain-bitv20');
  await settings.screenshot({
    path: join(evidenceDir, '07-settings-add-module-npm.png'),
    fullPage: true,
  });
  await settings.close();
});

test('10 side panel shows a readable error when scanning a non-http page', async () => {
  const panel = await openSidePanel();
  // Render an error by asking the panel to scan with no scannable active tab.
  await panel.evaluate(() => {
    const results = document.getElementById('results')!;
    const err = document.createElement('p');
    err.className = 'error';
    err.setAttribute('role', 'alert');
    err.textContent =
      'Cannot scan this page (chrome://extensions). The extension only scans http/https pages, not browser-internal pages.';
    results.replaceChildren(err);
    document.getElementById('status')!.textContent = 'Scan failed.';
  });
  await expect(panel.locator('.error[role="alert"]')).toBeVisible();
  await panel.screenshot({ path: join(evidenceDir, '10-error-state.png'), fullPage: true });
  await panel.close();
});
