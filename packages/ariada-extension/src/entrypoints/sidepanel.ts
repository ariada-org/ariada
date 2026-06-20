// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Side-panel controller. Wires the DOM shell (sidepanel.html) to the scan
// pipeline: capture the active tab (and any queued urls) -> run the multi-domain
// scan in the engine -> render the accessible grid. All processing is local.

import type { MultiDomainReport, PropertySnapshot } from '@ariada-org/core-engine';

import { toColumns, BUILT_IN_DOMAINS, type PluggableModule } from '../lib/domain-config.js';
import { scanSnapshots } from '../lib/scan.js';
import { renderGrid } from '../ui/report-grid.js';

interface Refs {
  scanButton: HTMLButtonElement;
  queueInput: HTMLInputElement;
  addUrlButton: HTMLButtonElement;
  queueList: HTMLUListElement;
  domainChecklist: HTMLElement;
  results: HTMLElement;
  status: HTMLElement;
  exportButton: HTMLButtonElement;
  scanProgress: HTMLElement;
  scanProgressBar: HTMLElement;
}

const queue: string[] = [];
const selectedDomains = new Set(BUILT_IN_DOMAINS.map((d) => d.id));
const pluggables: PluggableModule[] = [];
let lastReport: MultiDomainReport | null = null;

function refs(): Refs {
  const byId = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`missing #${id} in sidepanel.html`);
    return el as T;
  };
  return {
    scanButton: byId('scan-button'),
    queueInput: byId('queue-input'),
    addUrlButton: byId('add-url'),
    queueList: byId('queue-list'),
    domainChecklist: byId('domain-checklist'),
    results: byId('results'),
    status: byId('status'),
    exportButton: byId('export-button'),
    scanProgress: byId('scan-progress'),
    scanProgressBar: byId('scan-progress-bar'),
  };
}

function setStatus(r: Refs, text: string): void {
  r.status.textContent = text;
}

/** Show the indeterminate progress bar while scanning. */
function showProgress(r: Refs): void {
  r.scanProgress.hidden = false;
  r.scanProgress.setAttribute('aria-valuenow', '50');
  r.scanProgressBar.style.width = '50%';
  r.results.setAttribute('aria-busy', 'true');
}

/** Hide the progress bar once the scan finishes (success or error). */
function hideProgress(r: Refs): void {
  r.scanProgressBar.style.width = '100%';
  // Brief pause so the bar visually completes before hiding.
  setTimeout(() => {
    r.scanProgress.hidden = true;
    r.scanProgressBar.style.width = '0%';
    r.scanProgress.setAttribute('aria-valuenow', '0');
    r.results.setAttribute('aria-busy', 'false');
  }, 300);
}

function renderDomainChecklist(r: Refs): void {
  r.domainChecklist.replaceChildren();
  for (const d of BUILT_IN_DOMAINS) {
    const item = document.createElement('div');
    item.className = 'domain-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `domain-${d.id}`;
    cb.checked = selectedDomains.has(d.id);
    cb.addEventListener('change', () => {
      if (cb.checked) selectedDomains.add(d.id);
      else selectedDomains.delete(d.id);
    });
    const label = document.createElement('label');
    label.setAttribute('for', cb.id);
    label.textContent = d.label;
    item.append(cb, label);
    r.domainChecklist.appendChild(item);
  }
}

function renderQueue(r: Refs): void {
  r.queueList.replaceChildren();
  for (const url of queue) {
    const li = document.createElement('li');
    li.textContent = url;
    r.queueList.appendChild(li);
  }
}

/**
 * The tab to scan. When the report opens in a popup window from the on-page
 * launcher, the popup's own active tab is the extension page (not scannable),
 * so the worker passes the originating tab id in the URL hash. Docked in the
 * side panel there is no hash and we fall back to the window's active tab.
 */
function originTabId(): number | undefined {
  const id = new URLSearchParams(location.hash.slice(1)).get('tabId');
  return id ? Number(id) : undefined;
}

async function resolveScanTabId(): Promise<number | undefined> {
  const fromLauncher = originTabId();
  if (fromLauncher !== undefined) return fromLauncher;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function captureActiveTab(): Promise<PropertySnapshot> {
  const tabId = await resolveScanTabId();
  if (tabId === undefined) throw new Error('No active tab to scan.');
  const response = (await chrome.runtime.sendMessage({
    kind: 'request_capture',
    tabId,
  })) as { kind: string; snapshot?: PropertySnapshot; message?: string };
  if (response.kind === 'capture_error' || !response.snapshot) {
    throw new Error(response.message ?? 'Capture failed.');
  }
  return response.snapshot;
}

/**
 * Return a contextual recovery suggestion based on the error message.
 * Addresses the competitor-user pain where tools tell you what's wrong
 * but not what to do about it.
 */
function recoveryHint(errorMessage: string): string {
  if (/chrome:|extension:|devtools:|about:/i.test(errorMessage)) {
    return 'Navigate to an http or https page and scan again.';
  }
  if (/capture failed|no active tab/i.test(errorMessage)) {
    return 'Try reloading the page, then scan again.';
  }
  if (/no active tab/i.test(errorMessage)) {
    return 'Make sure a browser tab is open and active, then scan again.';
  }
  return 'Reload the page and try again. If the problem persists, check the browser console for details.';
}

async function runScan(r: Refs): Promise<void> {
  r.scanButton.disabled = true;
  setStatus(r, 'Scanning…');
  showProgress(r);
  try {
    const snapshots: PropertySnapshot[] = [];
    snapshots.push(await captureActiveTab());
    // Queued urls are captured by the same background path if reachable; for the
    // local-only release they are recorded and the active tab is always included.
    const report = await scanSnapshots(snapshots);
    lastReport = report;
    renderReport(r, report);
    setStatus(
      r,
      `Done — scanned ${report.sites.length} site(s) across ${report.domains.length} domains.`,
    );
    r.exportButton.disabled = false;
  } catch (err) {
    r.results.replaceChildren();
    const errMsg = err instanceof Error ? err.message : 'Scan failed.';

    const wrapper = document.createElement('div');

    const error = document.createElement('p');
    error.className = 'error';
    error.setAttribute('role', 'alert');
    error.textContent = errMsg;
    wrapper.appendChild(error);

    // Recovery path: tell the user what to do, not just what went wrong.
    const hint = document.createElement('p');
    hint.className = 'error-recovery';
    hint.textContent = recoveryHint(errMsg);
    wrapper.appendChild(hint);

    r.results.appendChild(wrapper);
    setStatus(r, 'Scan failed.');
  } finally {
    hideProgress(r);
    r.scanButton.disabled = false;
  }
}

function renderReport(r: Refs, report: MultiDomainReport): void {
  const columns = toColumns(report.domains, pluggables);
  const frag = renderGrid(report, columns);
  r.results.replaceChildren(frag);
}

function exportReport(): void {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ariada-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function init(): void {
  const r = refs();
  renderDomainChecklist(r);
  renderQueue(r);
  r.exportButton.disabled = true;

  r.scanButton.addEventListener('click', () => void runScan(r));
  r.addUrlButton.addEventListener('click', () => {
    const value = r.queueInput.value.trim();
    if (value.length > 0 && !queue.includes(value)) {
      queue.push(value);
      r.queueInput.value = '';
      renderQueue(r);
    }
  });
  r.exportButton.addEventListener('click', exportReport);

  // Opened from the on-page launcher: the button promises a scan, so run it for
  // the originating page immediately rather than leaving an idle panel.
  if (originTabId() !== undefined) {
    void runScan(r);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exposed for the end-to-end harness to drive a scan over an injected snapshot
// without a live cross-origin tab. Keeps the e2e deterministic and offline.
declare global {
  interface Window {
    __ariadaScanSnapshots?: typeof scanSnapshots;
    __ariadaRenderReport?: (report: MultiDomainReport) => void;
  }
}
window.__ariadaScanSnapshots = scanSnapshots;
window.__ariadaRenderReport = (report: MultiDomainReport) => {
  const r = refs();
  lastReport = report;
  renderReport(r, report);
  setStatus(r, `Done — scanned ${report.sites.length} site(s).`);
  r.exportButton.disabled = false;
};
