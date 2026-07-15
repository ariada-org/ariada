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
  };
}

function setStatus(r: Refs, text: string): void {
  r.status.textContent = text;
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

/** The tab to scan: the window's currently active tab. */
async function resolveScanTabId(): Promise<number | undefined> {
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

async function runScan(r: Refs): Promise<void> {
  r.scanButton.disabled = true;
  setStatus(r, 'Scanning…');
  try {
    const snapshots: PropertySnapshot[] = [];
    snapshots.push(await captureActiveTab());
    // Queued urls are captured by the same background path if reachable; for the
    // local-only MVP they are recorded and the active tab is always included.
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
    const error = document.createElement('p');
    error.className = 'error';
    error.setAttribute('role', 'alert');
    error.textContent = err instanceof Error ? err.message : 'Scan failed.';
    r.results.appendChild(error);
    setStatus(r, 'Scan failed.');
  } finally {
    r.scanButton.disabled = false;
  }
}

function renderReport(r: Refs, report: MultiDomainReport): void {
  const columns = toColumns(report.domains, pluggables);
  const table = renderGrid(report, columns);
  r.results.replaceChildren(table);
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
