// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { scanCurrentDocument } from '@ariada-org/core-browser';
import type { DomainAnalyzer, ScanResult } from '@ariada-org/core-engine';

import { applyFirstPartyGuard, isSameOrigin } from './first-party-guard.js';
import { showOverlay } from './overlay.js';
import type { ScanOpts, ScanSurfaceResult } from './index.js';

/**
 * Core adapter: captures `PropertySnapshot` via `scanCurrentDocument()`,
 * applies the first-party guard, and returns the structured `ScanSurfaceResult`.
 *
 * This is the single call-site for the scan engine in the browser surface. No additional DOM
 * traversal is performed here — all capture happens inside `scanCurrentDocument()`.
 */
export async function scan(opts: ScanOpts = {}): Promise<ScanSurfaceResult> {
  const targetDoc = opts.document ?? (typeof document !== 'undefined' ? document : null);
  if (!targetDoc) {
    throw new Error('surface-browser: no document available — pass opts.document explicitly');
  }

  const requestedAnalyzers: DomainAnalyzer[] = opts.analyzers ?? [];

  // Determine whether we are in a cross-origin context.
  // Prefer the document's own window (defaultView) as the origin source, since
  // the global `window` in a DevTools panel or test harness may differ from
  // the page's actual window. Fall back to the global `window` if defaultView
  // is not available.
  const docView = targetDoc.defaultView;
  const windowOrigin =
    docView?.location.origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'null');
  const docUrl = opts.url ?? targetDoc.URL ?? '';
  const crossOrigin = !isSameOrigin(windowOrigin, docUrl);

  const { filtered, firstPartyOnly } = applyFirstPartyGuard(requestedAnalyzers, crossOrigin);

  const scanResult: ScanResult = await scanCurrentDocument({
    document: targetDoc,
    analyzers: filtered,
    ...(opts.url !== undefined ? { url: opts.url } : {}),
  });

  const activeDomains = scanResult.report.stats.analyzersRun;

  const result: ScanSurfaceResult = {
    scanResult,
    firstPartyOnly,
    activeDomains,
  };

  // Render the inline overlay when requested (default: false for module use).
  if (opts.showOverlay === true) {
    showOverlay(scanResult.report, targetDoc, null);
  }

  return result;
}
