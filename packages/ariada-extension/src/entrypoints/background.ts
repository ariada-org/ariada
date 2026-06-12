// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Background service worker. Three jobs: open the side panel when the toolbar
// action is clicked, open the report surface when the on-page launcher button
// is clicked (side panel, with a popup-window fallback), and capture the active
// tab's DOM on request by injecting a small extraction function into the page.
// Capturing via chrome.scripting keeps the page footprint minimal on any
// http/https tab.

import type { PropertySnapshot } from '@ariada-org/core-engine';

import { CAPTURE_REQUEST, OPEN_PANEL_REQUEST } from '../lib/messages.js';

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

// Open the report surface when the on-page launcher button is clicked. The
// launcher always opens a standalone popup window: unlike the docked side panel
// (which the toolbar action provides) a popup is a real, always-visible window
// the user can see from any page, with no dependency on the side-panel surface
// being available. The toolbar icon remains the docked-side-panel route.
chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (message !== OPEN_PANEL_REQUEST) return false;
  // Carry the originating tab id so the report scans the page the user was on,
  // not the popup's own (non-scannable) extension tab.
  const tabId = sender.tab?.id;
  const base = chrome.runtime.getURL('sidepanel.html');
  void chrome.windows.create({
    url: tabId !== undefined ? `${base}#tabId=${tabId}` : base,
    type: 'popup',
    width: 460,
    height: 820,
  });
  return false; // no async response needed
});

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
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? '';
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `Cannot scan this page (${url || 'unknown URL'}). The extension only scans http/https pages, not browser-internal pages.`,
    );
  }

  let response: CaptureReply;
  try {
    response = (await chrome.tabs.sendMessage(tabId, CAPTURE_REQUEST)) as CaptureReply;
  } catch {
    // The content script was not registered on this tab (e.g. it was open
    // before the extension loaded). Inject it, then ask again.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
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
