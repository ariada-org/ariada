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

import { createOverlay, type OverlayInstance } from '@ariada-org/overlay';

import { CAPTURE_REQUEST, HEAL_REQUEST } from '../lib/messages.js';
import { applyTier0Remediations, type RemediationResult } from '../lib/remediate.js';
import { captureSnapshot, fetchOriginArtifacts } from '../lib/snapshot-capture.js';
// The pluggable in-page overlay: draws findings on THIS live page. Importing the
// painters registers box / line / dracula / thumbelina into the registry.
import '@ariada-org/overlay/painters';

// The active healed preview, so a second HEAL_REQUEST toggles it off.
let healed: RemediationResult | null = null;
// The active overlay, so a second highlight toggles it off.
// The shape is declared once alongside the engine. Repeating it here is how it
// silently fell behind when the engine started reporting what it placed.
let overlay: OverlayInstance | null = null;

function setBadge(text: string): void {
  const id = 'ariada-heal-badge';
  document.getElementById(id)?.remove();
  if (!text) return;
  const el = document.createElement('div');
  el.id = id;
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;z-index:2147483647;top:12px;right:12px;background:#1a7f37;color:#fff;' +
    'font:600 13px/1.4 system-ui,sans-serif;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)';
  document.body.appendChild(el);
}

type Respond = (response: unknown) => void;

const reason = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

// The three handlers below answer on their own schedule and none of them can
// decide anything else, so each used to end in the same `return true` — the
// value the browser reads as "hold the channel open until I answer". Saying it
// three times made three functions whose return value carries no information.
// The channel is the listener's business, and that is where the sentence is
// now; a handler simply answers.
function handleCapture(sendResponse: Respond): void {
  const snapshot = (() => {
    try {
      return captureSnapshot(document, { scanId: `scan-${Date.now()}`, url: location.href });
    } catch (err) {
      sendResponse({ kind: 'capture_error', message: reason(err, 'capture failed') });
      return null;
    }
  })();
  if (!snapshot) return;

  // The files at the site's root are fetched separately, because reading them
  // means waiting on the network and the rest of the snapshot does not. Their
  // absence used to be assumed rather than checked, so every site was reported
  // as having no robots.txt; a failed or slow fetch now still yields "absent",
  // but only after actually looking.
  void (async () => {
    try {
      const originArtifacts = await fetchOriginArtifacts(location.href);
      sendResponse({ kind: 'capture_result', snapshot: { ...snapshot, originArtifacts } });
    } catch {
      sendResponse({ kind: 'capture_result', snapshot });
    }
  })();
}

/** Draw or update the in-page overlay. The panel drives it live: `off` tears it
 *  down, otherwise findings, painter and options are re-applied to the same
 *  overlay, so flipping a switch or selecting a block repaints without flicker. */
function handleHighlight(message: unknown, sendResponse: Respond): void {
  try {
    const m = message as { findings?: unknown[]; painter?: string; options?: unknown; off?: boolean };
    if (m.off) {
      if (overlay) { overlay.destroy(); overlay = null; }
      sendResponse({ kind: 'highlight_result', count: 0 });
      return;
    }
    const findings = Array.isArray(m.findings) ? m.findings : [];
    overlay ??= createOverlay(document);
    const placed = overlay.show(findings, m.painter || 'numbered', m.options);
    // The panel cannot tell which findings resolved to something on the page —
    // only the page can. Reporting it back lets the panel mark the ones it
    // could not point at instead of numbering them as if it had.
    sendResponse({
      kind: 'highlight_result',
      count: placed?.drawn?.length ?? findings.length,
      undrawable: placed?.undrawable ?? [],
    });
  } catch (err) {
    sendResponse({ kind: 'highlight_error', message: reason(err, 'highlight failed') });
  }
}

/** Apply the safe automatic fixes, or put the page back if they are already on. */
function handleHeal(sendResponse: Respond): void {
  try {
    if (healed) {
      healed.revert();
      healed = null;
      setBadge('');
      sendResponse({ kind: 'heal_result', count: 0, fixes: [] });
      return;
    }
    healed = applyTier0Remediations(document);
    setBadge(`Ariada: ${healed.fixes.length} tier-0 fixes applied — click again for original`);
    sendResponse({
      kind: 'heal_result',
      count: healed.fixes.length,
      fixes: healed.fixes.map((f) => ({ rule: f.rule, selector: f.selector })),
    });
  } catch (err) {
    sendResponse({ kind: 'heal_error', message: reason(err, 'heal failed') });
  }
}

function isHighlightRequest(message: unknown): boolean {
  return typeof message === 'object' && message !== null
    && (message as { kind?: string }).kind === 'highlight_request';
}

chrome.runtime?.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  // True keeps the message channel open until the handler calls back, which
  // every one of these does after at least one turn of the event loop. False
  // for anything else, so a message meant for somebody else is not held.
  if (message === CAPTURE_REQUEST) { handleCapture(sendResponse); return true; }
  if (isHighlightRequest(message)) { handleHighlight(message, sendResponse); return true; }
  if (message === HEAL_REQUEST) { handleHeal(sendResponse); return true; }
  return false;
});
