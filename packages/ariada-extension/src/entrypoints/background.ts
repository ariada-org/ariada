// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Background service worker. Two jobs: open the docked side panel when the
// toolbar action is clicked, and capture the active tab's DOM on request by
// injecting a small extraction function into the page. Capturing via
// chrome.scripting keeps the page footprint minimal on any http/https tab —
// there is no static content_scripts entry and no broad host permission; the
// content script is only ever injected on demand, scoped to the tab the user
// is acting on.

import type { PropertySnapshot } from '@ariada-org/core-engine';

import { CAPTURE_REQUEST } from '../lib/messages.js';

// Open the side panel for the clicked tab.
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    void chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Allow the side panel to open from the action icon on supported builds.
if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

interface CaptureRequest {
  kind: 'request_capture';
  tabId: number;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isCaptureRequest(message)) return false;
  captureTab(message.tabId)
    .then((snapshot) => sendResponse({ kind: 'capture_result', snapshot }))
    .catch((err: unknown) =>
      sendResponse({
        kind: 'capture_error',
        message: err instanceof Error ? err.message : 'capture failed',
      }),
    );
  return true; // keep the message channel open for the async response
});

function isCaptureRequest(m: unknown): m is CaptureRequest {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as { kind?: unknown }).kind === 'request_capture' &&
    typeof (m as { tabId?: unknown }).tabId === 'number'
  );
}

/**
 * Capture the DOM of a tab. The snapshot is built in the page itself (where a
 * live `document` exists) by the content script, then returned here — the
 * worker has no DOM and cannot parse HTML, so it must not try to. If the
 * content script is not yet present on the tab, inject it first and retry.
 */
async function captureTab(tabId: number): Promise<PropertySnapshot> {
  // Do NOT gate on tab.url: with only the `activeTab` permission (no `tabs`, no
  // host permission), Chrome hides the tab URL, so tab.url is empty on EVERY
  // page. The real "can't scan here" signal is that injecting the content script
  // fails — Chrome blocks injection on browser-internal pages (chrome://, the
  // Web Store, the New Tab page, PDFs) but allows it on any http/https page.
  let response: CaptureReply;
  try {
    // First ask an already-present content script (avoids a duplicate inject).
    response = (await chrome.tabs.sendMessage(tabId, CAPTURE_REQUEST)) as CaptureReply;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch (injectErr) {
      // Surface the REAL injection error — masking it behind a fixed string hid
      // the true cause (missing page access vs a browser-internal page). The
      // most common cause on a normal http/https tab is that the extension has
      // no host access to that tab yet (activeTab alone does not cover a tab the
      // persistent side panel later switches to); the panel requests http/https
      // access on the Scan click to fix that.
      const detail = injectErr instanceof Error ? injectErr.message : String(injectErr);
      throw new Error(
        `Cannot scan this page: ${detail} — grant page access when prompted, or open an http/https page (not chrome://, the Web Store, the New Tab page, or a PDF).`,
      );
    }
    response = (await chrome.tabs.sendMessage(tabId, CAPTURE_REQUEST)) as CaptureReply;
  }

  if (response?.kind === 'capture_result' && response.snapshot) return response.snapshot;
  throw new Error(response?.message ?? 'Could not capture the page.');
}

interface CaptureReply {
  kind: 'capture_result' | 'capture_error';
  snapshot?: PropertySnapshot;
  message?: string;
}
