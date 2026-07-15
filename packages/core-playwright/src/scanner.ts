// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  runOrchestration,
  type DomainAnalyzer,
  type ScanOptions,
  type ScanResult,
  type Scanner,
} from '@ariada-org/core-engine';
import { ulid } from 'ulid';

import { createPlaywrightBoundingBoxResolver } from './bbox-resolver.js';
import { launchBrowser } from './cdp.js';
import { createLogger } from './logger.js';
import { captureSnapshot } from './snapshot.js';

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
    await handle.page.goto(url, { waitUntil: 'load', timeout: timeoutMs });

    const snapshot = await captureSnapshot(handle.page, {
      scanId,
      url,
      ...(opts.screenshot === false ? { screenshot: false } : {}),
    });

    const analyzers = opts.analyzers ?? (await loadDefaultAnalyzers());
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
