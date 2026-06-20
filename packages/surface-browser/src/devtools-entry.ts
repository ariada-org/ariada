// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { ScanSurfaceResult } from './index.js';

/**
 * DevTools panel entry point.
 *
 * Exposes `scanInspectedWindow()` — the hook that the Chrome extension layer
 * calls. The browser surface does NOT implement Chrome extension lifecycle
 * (MV3 background service worker, `chrome.storage`, `chrome.tabs`) — that is
 * the extension's responsibility.
 *
 * Because `chrome.devtools.inspectedWindow` does not expose a live `Document`
 * object (the panel runs in a separate context from the inspected page), we
 * use `chrome.devtools.inspectedWindow.eval()` to inject the scan function
 * into the inspected page's context and receive the serialised JSON result.
 *
 * The pattern is: inject the bundled `scan()` IIFE into the page via eval,
 * run it, JSON-serialise the result, and post it back. The extension layer
 * handles the full lifecycle; this file provides the scan invocation and
 * result deserialization.
 */

/** Minimal ambient type for the Chrome DevTools API used here. */
declare const chrome: {
  devtools: {
    inspectedWindow: {
      eval(
        expression: string,
        callback: (result: unknown, exceptionInfo: { isException: boolean; value: string }) => void,
      ): void;
    };
  };
};

/**
 * Inject `scan()` into the inspected page via `chrome.devtools.inspectedWindow.eval`
 * and return the deserialized `ScanSurfaceResult`.
 *
 * Called by the Chrome extension. This function is the boundary between the
 * DevTools panel context and the inspected page's JavaScript environment.
 */
export async function scanInspectedWindow(): Promise<ScanSurfaceResult> {
  return new Promise((resolve, reject) => {
    // Expression evaluated in the inspected page's context.
    // It relies on `__ariadaScan` being already injected by the extension
    // content script (the extension layer's responsibility).
    const expression = `
      (function() {
        if (typeof __ariadaScan !== 'function') {
          return JSON.stringify({ error: '__ariadaScan not available — content script may not be loaded' });
        }
        return __ariadaScan({ document: document, showOverlay: false })
          .then(function(r) { return JSON.stringify(r); })
          .catch(function(e) { return JSON.stringify({ error: String(e) }); });
      })()
    `;

    chrome.devtools.inspectedWindow.eval(
      expression,
      (result: unknown, exceptionInfo: { isException: boolean; value: string }) => {
        if (exceptionInfo.isException) {
          reject(new Error(`DevTools eval exception: ${exceptionInfo.value}`));
          return;
        }
        try {
          const parsed = JSON.parse(String(result)) as Record<string, unknown>;
          if ('error' in parsed) {
            reject(new Error(String(parsed['error'])));
            return;
          }
          resolve(parsed as unknown as ScanSurfaceResult);
        } catch (e) {
          reject(new Error(`Failed to deserialize scan result: ${String(e)}`));
        }
      },
    );
  });
}
