// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  runOrchestration,
  type AnalyzerContext,
  type DomainAnalyzer,
  type Finding,
  type ScanOptions,
  type ScanResult,
  type Scanner,
  type UnifiedSnapshot,
} from '@ariada-org/core-engine';
import type { Page } from 'playwright';
import { ulid } from 'ulid';

import { createPlaywrightBoundingBoxResolver } from './bbox-resolver.js';
import { launchBrowser } from './cdp.js';
import { createLogger } from './logger.js';
import { captureSnapshot } from './snapshot.js';

// Consent-overlay accept buttons for English and the Nordic languages
// (Finnish, Swedish, Norwegian, Danish). Best-effort: a missing or
// unclickable button is ignored.
const CONSENT_ACCEPT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  'button:has-text("Godkänn alla")',
  'button:has-text("Tillåt alla")',
  'button:has-text("Acceptera alla")',
  'button:has-text("Godkänn")',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept")',
  'button[aria-label*="accept" i]',
];

/**
 * Let a single-page app render past `load`, then dismiss a cookie-consent
 * overlay, so the captured DOM is the real page rather than a near-empty shell
 * behind a consent wall. Every step is best-effort and never throws — capture
 * must proceed even if the site never goes network-idle or has no consent UI.
 */
async function settlePage(page: Page, timeoutMs: number): Promise<void> {
  await page
    .waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 10_000) })
    .catch(() => undefined);
  for (const selector of CONSENT_ACCEPT_SELECTORS) {
    const button = page.locator(selector).first();
    const visible = await button.isVisible({ timeout: 400 }).catch(() => false);
    if (visible) {
      await button.click({ timeout: 1500 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
      break;
    }
  }
  await page.waitForTimeout(1200);
}

/**
 * Main orchestrator. One browser navigation; UnifiedSnapshot captured once;
 * analyzers fanned out in parallel; cross-domain detector aggregates.
 */
export async function scan(url: string, opts: ScanOptions = {}): Promise<ScanResult> {
  return createScanner(opts).scan(url, opts);
}

/**
 *
 */
export function createScanner(defaults: ScanOptions = {}): Scanner {
  return {
    async scan(url: string, opts: ScanOptions = {}): Promise<ScanResult> {
      const merged: ScanOptions = { ...defaults, ...opts };
      return runScan(url, merged);
    },
  };
}

/**
 * Capture one rich {@link UnifiedSnapshot} for a URL: a single navigation, then
 * the AXTree, DOM outline, rendered HTML, cookies, network resources, perf
 * metrics, and the full rule-library findings run against the live page. No
 * orchestration and no per-element iteration — this is the capture primitive the
 * multi-domain path consumes, so the snapshot rules and the multi-domain engine
 * both see real WCAG findings without running the browser twice.
 */
export async function capture(url: string, opts: ScanOptions = {}): Promise<UnifiedSnapshot> {
  const scanId = ulid();
  const rootLogger = opts.logger ?? createLogger();
  const logger = rootLogger.child({ scanId, url });

  const browserName = opts.playwright?.browser ?? 'chromium';
  const headless = opts.playwright?.headless ?? true;
  const handle = await launchBrowser(browserName, headless);

  try {
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const collected = collectNetworkResources(handle.page);
    await handle.page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    await settlePage(handle.page, timeoutMs);

    const analyzers = opts.analyzers ?? (await loadDefaultAnalyzers());
    const runAxe = makeAxeRunner(scanId, url, analyzers, logger);
    const snapshot = await captureSnapshot(handle.page, {
      scanId,
      url,
      ...(opts.screenshot === false ? { screenshot: false } : {}),
      ...(runAxe ? { runAxe } : {}),
    });
    snapshot.networkResources = collected.resources();
    snapshot.headers = collected.mainHeaders();
    return snapshot;
  } finally {
    await handle.close();
  }
}

async function runScan(url: string, opts: ScanOptions): Promise<ScanResult> {
  const scanId = ulid();
  const rootLogger = opts.logger ?? createLogger();
  const logger = rootLogger.child({ scanId, url });

  const browserName = opts.playwright?.browser ?? 'chromium';
  const headless = opts.playwright?.headless ?? true;

  const handle = await launchBrowser(browserName, headless);
  const startedAt = Date.now();

  try {
    const timeoutMs = opts.timeoutMs ?? 30_000;

    const collected = collectNetworkResources(handle.page);
    await handle.page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    await settlePage(handle.page, timeoutMs);

    const analyzers = opts.analyzers ?? (await loadDefaultAnalyzers());

    // The orchestration path runs the analyzers (axe among them) directly over
    // the live page, so it does not need the capture-time rule-library run.
    const snapshot = await captureSnapshot(handle.page, {
      scanId,
      url,
      ...(opts.screenshot === false ? { screenshot: false } : {}),
    });
    snapshot.networkResources = collected.resources();
    snapshot.headers = collected.mainHeaders();

    const bboxResolver = createPlaywrightBoundingBoxResolver(handle.page);

    return await runOrchestration({
      scanId,
      url,
      startedAt,
      snapshot,
      analyzers,
      page: handle.page,
      logger,
      bboxResolver,
      ...(opts.emitter !== undefined ? { emitter: opts.emitter } : {}),
      ...(opts.elementIter !== undefined ? { elementIter: opts.elementIter } : {}),
    });
  } finally {
    await handle.close();
  }
}

interface CollectedNetwork {
  resources: () => UnifiedSnapshot['networkResources'];
  /** Response headers of the top-level document (lower-cased keys), for the
   *  security and AI-readiness domains. Empty until the main document responds. */
  mainHeaders: () => Record<string, string>;
}

/**
 * Subscribe to network responses for the lifetime of one navigation and return
 * getters for the collected resource list and the main document's response
 * headers. Subscribed before `goto` so the initial document and its
 * sub-resources are all recorded. Playwright already lower-cases header keys.
 */
function collectNetworkResources(page: Page): CollectedNetwork {
  const resources: UnifiedSnapshot['networkResources'] = [];
  let mainHeaders: Record<string, string> = {};
  page.on('response', (response) => {
    try {
      const headers = response.headers();
      // Keep the headers of the top-level document response (not sub-resources,
      // not iframes). A redirect chain ends on the final document; the last such
      // response wins, matching what the browser ultimately rendered.
      if (
        response.request().resourceType() === 'document' &&
        response.frame() === page.mainFrame()
      ) {
        mainHeaders = headers;
      }
      const lenRaw = headers['content-length'];
      const size = lenRaw ? Number.parseInt(lenRaw, 10) : undefined;
      resources.push({
        url: response.url(),
        status: response.status(),
        ...(headers['content-type'] ? { mimeType: headers['content-type'] } : {}),
        ...(size !== undefined && Number.isFinite(size) ? { size } : {}),
      });
    } catch {
      // A response may already be gone; skip it rather than fail the scan.
    }
  });
  return { resources: () => resources, mainHeaders: () => mainHeaders };
}

/**
 * Build the capture-time hook that runs the full rule library against the live
 * page. It reuses the `a11y` analyzer (axe-core via the rule-library package),
 * which already maps the library output to the `Finding` shape. Returns undefined
 * when no such analyzer is present, so capture simply records no library findings.
 */
function makeAxeRunner(
  scanId: string,
  url: string,
  analyzers: readonly DomainAnalyzer[],
  logger: ScannerLogger,
): ((page: Page) => Promise<Finding[]>) | undefined {
  const a11y = analyzers.find((a) => a.domain === 'a11y');
  if (!a11y) return undefined;
  return async (page: Page): Promise<Finding[]> => {
    const ctx: AnalyzerContext = {
      snapshot: { scanId, url } as unknown as UnifiedSnapshot,
      page,
      logger,
    };
    try {
      return await a11y.analyze(ctx);
    } catch (err) {
      logger.error({ err }, 'capture-time rule library run failed');
      return [];
    }
  };
}

type ScannerLogger = Parameters<typeof runOrchestration>[0]['logger'];

interface RulesAxeModule {
  createA11yAnalyzer: () => DomainAnalyzer;
}

/**
 * Indirection through a local string variable so tsc doesn't statically follow
 * `@ariada-org/rules-axe`'s declaration file at type-check time. Following it would
 * pull in rules-axe's peerDependency on `@ariada-org/core` (the shim), which in
 * turn re-imports from this package — forming a TS resolution loop that
 * breaks idempotent tsc builds with TS5055 (input/output collision).
 *
 * The runtime behaviour is identical: dynamic ESM import of `@ariada-org/rules-axe`.
 */
const RULES_AXE_PACKAGE = '@ariada-org/rules-axe';

async function loadDefaultAnalyzers(): Promise<DomainAnalyzer[]> {
  try {
    const mod = (await import(RULES_AXE_PACKAGE)) as RulesAxeModule;
    return [mod.createA11yAnalyzer()];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Default a11y analyzer unavailable. Install @ariada-org/rules-axe or pass options.analyzers. (${msg})`,
    );
  }
}
