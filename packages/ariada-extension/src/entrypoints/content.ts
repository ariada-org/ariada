// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Content-script capture path. This script is injected on demand by the
// background worker (chrome.scripting.executeScript), scoped to the tab the
// user is actively scanning — there is no static content_scripts entry and no
// broad host permission, so it never runs on a page the user hasn't acted on.
// It listens for a capture request and replies with the live-DOM snapshot
// built in the page's own context; it never touches chrome.* APIs beyond the
// message channel and never injects any visible UI into the page.

import { CAPTURE_REQUEST } from '../lib/messages.js';
import { captureSnapshot } from '../lib/snapshot-capture.js';

chrome.runtime?.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (message !== CAPTURE_REQUEST) return false;
  try {
    const snapshot = captureSnapshot(document, {
      scanId: `scan-${Date.now()}`,
      url: location.href,
    });
    sendResponse({ kind: 'capture_result', snapshot });
  } catch (err) {
    sendResponse({
      kind: 'capture_error',
      message: err instanceof Error ? err.message : 'capture failed',
    });
  }
  return true;
});
