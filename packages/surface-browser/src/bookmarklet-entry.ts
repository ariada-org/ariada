// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Bookmarklet entry point (IIFE).
 *
 * This file is bundled separately to produce a self-contained IIFE ≤ 50 KB.
 * It loads @ariada-org/core-browser from the CDN (or falls back to the
 * package-bundled copy), runs `scan({ document, showOverlay: true })`,
 * and surfaces any errors to the console.
 *
 * Because this file is bundled independently with esbuild, it must NOT import
 * from `@ariada-org/core-browser` directly (that would inline the entire engine
 * into the bundle and exceed the 50 KB budget). Instead, `scan()` from the
 * local `scan.ts` is used, which references `@ariada-org/core-browser` and is
 * bundled together with it.
 *
 * For the bookmarklet bundle, esbuild bundles everything together.
 */

import { scan } from './scan.js';
import { showOverlay, showErrorOverlay, showLoadingOverlay } from './overlay.js';

(async function ariadaBookmarklet(): Promise<void> {
  const returnFocus = document.activeElement;

  // Show loading state immediately so the user knows the scan started.
  showLoadingOverlay(window.document);

  try {
    const result = await scan({
      document: window.document,
      showOverlay: false, // We'll show it ourselves after scan.
    });

    showOverlay(result.scanResult.report, window.document, returnFocus);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[ariada] Bookmarklet scan failed:', err);
    showErrorOverlay(msg, window.document, returnFocus);
  }
})();
