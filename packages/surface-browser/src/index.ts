// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { DomainAnalyzer, ScanResult } from '@ariada-org/core-engine';

// Re-export the overlay API for callers that want to render manually.
export {
  showOverlay,
  showErrorOverlay,
  showLoadingOverlay,
  removeOverlay,
  highlightElement,
  removeHighlight,
  buildLoadingContent,
} from './overlay.js';
// Re-export the first-party guard helpers for testing and advanced callers.
export { isSameOrigin, applyFirstPartyGuard } from './first-party-guard.js';
// Re-export the scan function.
export { scan } from './scan.js';

/**
 * Options for the `scan()` surface adapter.
 */
export interface ScanOpts {
  /**
   * The document to scan. Defaults to `window.document` when available.
   * Pass explicitly when running in an iframe or test environment.
   */
  document?: Document;
  /**
   * Explicit URL override — required when `document.URL` is `about:blank`
   * (e.g. inside an iframe or a test harness).
   */
  url?: string;
  /**
   * Domain analyzers to activate. In cross-origin contexts, this list is
   * silently filtered to built-in first-party analyzers only.
   */
  analyzers?: DomainAnalyzer[];
  /**
   * When `true`, an inline shadow-DOM overlay is injected into the document
   * after the scan completes, showing findings grouped by domain with
   * per-finding drill-down, score headline, and regulatory mapping badges.
   *
   * Defaults to `false` when used as an ES module; the bookmarklet entry
   * sets this to `true` automatically.
   */
  showOverlay?: boolean;
}

/**
 * The structured result returned by `scan()`.
 */
export interface ScanSurfaceResult {
  /** The engine result: `.report` is the full `UnifiedReport`. */
  scanResult: ScanResult;
  /**
   * `true` when the first-party guard reduced the analyzer list because the
   * scan ran in a cross-origin context.
   */
  firstPartyOnly: boolean;
  /** Domain IDs that were activated during this scan. */
  activeDomains: string[];
}
