// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Content-script capture path. The primary capture route is chrome.scripting
// injection from the background worker; this script is the on-page fallback used
// when a persistent content script is registered. It listens for a capture
// request and replies with the live-DOM snapshot built in the page's own
// context — it never touches chrome.* APIs beyond the message channel.

import { CAPTURE_REQUEST, OPEN_PANEL_REQUEST } from '../lib/messages.js';
import { captureSnapshot } from '../lib/snapshot-capture.js';

const LAUNCHER_ID = 'ariada-scanner-launcher';

chrome.runtime?.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (message !== CAPTURE_REQUEST) return false;
  // Detach our own launcher button before capturing so the scan reports on the
  // page as the user authored it, not on the element the extension injected.
  const launcher = document.getElementById(LAUNCHER_ID);
  const launcherParent = launcher?.parentNode ?? null;
  const launcherNext = launcher?.nextSibling ?? null;
  launcher?.remove();
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
  } finally {
    if (launcher && launcherParent) launcherParent.insertBefore(launcher, launcherNext);
  }
  return true;
});

// On-page launcher. Toolbar icons are not pinned by default and cannot be
// clicked from page scripts (or by Playwright), so the extension also offers a
// visible, keyboard-reachable button on the page itself. Clicking it asks the
// worker to open the report surface while the user gesture is still live.
function injectLauncher(): void {
  if (document.getElementById(LAUNCHER_ID)) return;
  if (!document.body) return;

  const button = document.createElement('button');
  button.id = LAUNCHER_ID;
  button.type = 'button';
  // The visible text is the accessible name (WCAG 2.5.3 Label in Name): no
  // aria-label override. The wheelchair glyph is decorative, hidden from the
  // accessibility tree so the name stays exactly "Scan with ariada".
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '♿ ';
  const label = document.createElement('span');
  label.textContent = 'Scan with ariada';
  button.append(icon, label);
  // Inline styles keep the button self-contained and unaffected by host CSS.
  // Colours meet WCAG 1.4.3 (white on #1d3b8b is ~8.6:1); 44px min target.
  button.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483647',
    'min-height:44px',
    'padding:0 16px',
    'font:600 14px/44px system-ui,sans-serif',
    'color:#ffffff',
    'background:#1d3b8b',
    'border:2px solid #ffffff',
    'border-radius:8px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
    'cursor:pointer',
  ].join(';');
  // Visible focus indicator (WCAG 2.4.7) without relying on host styles.
  button.addEventListener('focus', () => {
    button.style.outline = '3px solid #ffd24d';
    button.style.outlineOffset = '2px';
  });
  button.addEventListener('blur', () => {
    button.style.outline = 'none';
  });

  button.addEventListener('click', () => {
    chrome.runtime?.sendMessage(OPEN_PANEL_REQUEST);
  });

  document.body.appendChild(button);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectLauncher, { once: true });
} else {
  injectLauncher();
}
