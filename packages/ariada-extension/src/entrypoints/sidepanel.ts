// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Side-panel controller. Wires the DOM shell (sidepanel.html) to the scan
// pipeline: capture the active tab -> run the multi-domain
// scan in the engine -> render the accessible grid. All processing is local.

import type { MultiDomainReport, PropertySnapshot } from '@ariada-org/core-engine';
import {
  countUnmapped,
  emitVpat,
  findingsToViolations,
  toRenderableVpat,
  type ScanLikeReport,
} from '@ariada-org/evidence-emitter';
import { renderVpatHtml } from '@ariada-org/vpat-html-renderer';

import { toColumns, BUILT_IN_DOMAINS, type PluggableModule } from '../lib/domain-config.js';
import { scanSnapshots } from '../lib/scan.js';
import { captureSnapshot } from '../lib/snapshot-capture.js';
import { renderGrid } from '../ui/report-grid.js';

interface Refs {
  scanButton: HTMLButtonElement;
  domainChecklist: HTMLElement;
  results: HTMLElement;
  status: HTMLElement;
  exportButton: HTMLButtonElement;
  scanProgress: HTMLElement;
  scanProgressBar: HTMLElement;
}

const selectedDomains = new Set(BUILT_IN_DOMAINS.map((d) => d.id));
const pluggables: PluggableModule[] = [];
let lastReport: MultiDomainReport | null = null;

/**
 * The flat, ordered list of findings that have a live element selector. This is
 * the single source of the "blocks" the user can act on: the panel numbers each
 * one, and the in-page overlay draws the SAME number on the matching element, so
 * badge N on the page is row N in this list. Built once per scan so both stay in
 * lock-step.
 */
interface BlockFinding {
  selector: string;
  severity?: string | undefined;
  message?: string | undefined;
  ruleId?: string | undefined;
  criterion?: string | undefined;
}
let orderedFindings: BlockFinding[] = [];

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#e5484d',
  serious: '#ffb224',
  moderate: '#0ea5e9',
  minor: '#0ea5e9',
};
/** Severest first — the order the switches and the list are shown in. */
const SEVERITY_ORDER = ['critical', 'serious', 'moderate', 'minor', 'unknown'] as const;

// Live overlay controls the panel drives: which severities draw their connector
// lines, which individual blocks have their line switched off, the selected
// block, and the current painter. Any change re-pushes the overlay state.
const lineSeverities = new Set<string>(SEVERITY_ORDER);
const disabledLines = new Set<number>();
let selectedIndex: number | null = null;
let currentPainter = 'numbered';

// Filled from the page's reply: which findings could not be drawn, and why. A
// block the page cannot point at is marked as such rather than offering a line
// switch that would do nothing.
const undrawable = new Map<number, string>();

const NOT_DRAWN_LABEL: Record<string, string> = {
  'page-level': 'applies to the whole page',
  'not-found': 'element not on the page',
  'no-selector': 'no element to point at',
  'no-box': 'element is not visible',
};

/** Push the current findings + painter + overlay options to the page overlay,
 *  injecting the content script first if it is not present yet. */
async function pushOverlay(off = false): Promise<void> {
  const tabId = await resolveScanTabId();
  if (tabId === undefined) return;
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); } catch { /* already injected */ }
  if (off) {
    await chrome.tabs.sendMessage(tabId, { kind: 'highlight_request', off: true });
    return;
  }
  if (orderedFindings.length === 0) return;
  const reply = (await chrome.tabs.sendMessage(tabId, {
    kind: 'highlight_request',
    findings: orderedFindings,
    painter: currentPainter,
    options: {
      lineSeverities: [...lineSeverities],
      disabled: [...disabledLines],
      focus: selectedIndex,
      rowY: measureRowPositions(),
    },
  })) as { undrawable?: ReadonlyArray<{ i: number; why: string }> } | undefined;

  // The page knows which findings it could actually point at; the panel does
  // not. Record its answer so a block that lands nowhere says so.
  undrawable.clear();
  for (const u of reply?.undrawable ?? []) undrawable.set(u.i, u.why);
}

const sevColor = (s?: string): string => (s ? SEVERITY_COLOR[s] ?? '#58a6ff' : '#58a6ff');
const sevOf = (f: { severity?: string | undefined }): string => f.severity || 'unknown';

/**
 * Where each block's row sits vertically, so the page can aim its connector
 * line at the row rather than at a guessed height.
 *
 * The overlay draws inside the page and cannot reach into this panel — it is a
 * separate browser surface. What it can control is where the line leaves the
 * page's right edge, and that is only meaningful if it is level with the row.
 * The height was previously computed as `80 + index * 22`, which assumed rows
 * of a fixed size and a list that never scrolled; rows grow with their text
 * and the list scrolls, so the lines ended wherever the arithmetic put them.
 *
 * Panel and page are docked side by side in the same window and their tops are
 * close enough that a row's own viewport position reads correctly across the
 * boundary. Rows scrolled out of view are omitted: a line pointing off-screen
 * is worse than one that leaves level with its element.
 */
function measureRowPositions(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const el of document.querySelectorAll<HTMLElement>('.block-item')) {
    const i = Number(el.dataset['index']);
    if (Number.isNaN(i)) continue;
    const r = el.getBoundingClientRect();
    const middle = r.top + r.height / 2;
    if (middle < 0 || middle > window.innerHeight) continue;
    out[i] = Math.round(middle);
  }
  return out;
}

/**
 * Flatten the domain grid into one stable, ordered list of findings that carry a
 * usable element selector — site by site, domain by domain, in the grid's own
 * order. Findings without a selector cannot be pointed at on the page, so they
 * are left to the domain matrix and omitted here.
 */
function flattenFindings(report: MultiDomainReport): BlockFinding[] {
  const out: BlockFinding[] = [];
  const grid = (report as { grid?: Record<string, Record<string, ReadonlyArray<{
    element?: { selector?: string };
    severity?: string;
    message?: string;
    ruleId?: string;
    criterion?: string;
  }>>> }).grid ?? {};
  for (const domains of Object.values(grid)) {
    for (const list of Object.values(domains)) {
      for (const f of list) {
        const selector = f.element?.selector;
        if (!selector) continue;
        out.push({ selector, severity: f.severity, message: f.message, ruleId: f.ruleId, criterion: f.criterion });
      }
    }
  }
  return out;
}

/** Render the numbered "blocks" list — the column the lines/badges point at. */
/** Build a labelled on/off switch (checkbox styled as a toggle). */
function makeSwitch(labelText: string, checked: boolean, onChange: (on: boolean) => void): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'sw';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => onChange(cb.checked));
  const track = document.createElement('span');
  track.className = 'sw-track';
  const text = document.createElement('span');
  text.className = 'sw-text';
  text.textContent = labelText;
  label.append(cb, track, text);
  return label;
}

/**
 * One line switch per severity actually present, severest first. A single
 * "Lines" switch was all-or-nothing: on a page with nine findings the reader
 * wants the critical ones traced and the rest out of the way.
 */
function renderSeverityBar(findings: BlockFinding[]): HTMLElement {
  const present = SEVERITY_ORDER.filter((s) => findings.some((f) => sevOf(f) === s));
  const bar = document.createElement('div');
  bar.className = 'line-switches';
  const legend = document.createElement('span');
  legend.className = 'line-switches-legend';
  legend.textContent = 'Lines';
  bar.appendChild(legend);
  for (const sev of present) {
    const count = findings.filter((f) => sevOf(f) === sev).length;
    const sw = makeSwitch(`${sev} (${count})`, lineSeverities.has(sev), (on) => {
      if (on) lineSeverities.add(sev);
      else lineSeverities.delete(sev);
      void pushOverlay();
    });
    sw.classList.add('sev-sw');
    sw.style.setProperty('--sev-colour', sevColor(sev === 'unknown' ? undefined : sev));
    bar.appendChild(sw);
  }
  return bar;
}

/**
 * One finding as a row. Everything that distinguishes a finding the page could
 * point at from one it could not lives here — the hollow number, the plain note
 * where a switch would look operable and do nothing, and whether the row can be
 * selected at all.
 */
function renderFindingItem(f: BlockFinding, i: number, ol: HTMLElement): HTMLElement {
  const li = document.createElement('li');
  li.className = 'block-item';
  li.dataset['index'] = String(i);
  if (selectedIndex === i) li.classList.add('selected');

  // A block the page could not point at gets a hollow number instead of a
  // filled one, so the two kinds are told apart at a glance rather than by
  // clicking and finding nothing happens.
  const why = undrawable.get(i);
  const num = document.createElement('span');
  num.className = why ? 'block-num block-num-flat' : 'block-num';
  num.textContent = String(i + 1);
  if (why) {
    num.style.color = sevColor(f.severity);
    num.style.borderColor = sevColor(f.severity);
    li.classList.add('block-undrawable');
  } else {
    num.style.background = sevColor(f.severity);
  }

  const body = document.createElement('div');
  body.className = 'block-body';
  const head = document.createElement('div');
  head.className = 'block-head';
  const wcag = f.criterion ? ` · WCAG ${f.criterion}` : '';
  head.textContent = `${f.severity ?? 'finding'} · ${f.ruleId ?? ''}${wcag}`;
  const msg = document.createElement('div');
  msg.className = 'block-msg';
  msg.textContent = f.message ?? '';
  const sel = document.createElement('code');
  sel.className = 'block-sel';
  sel.textContent = f.selector;
  body.append(head, msg, sel);

  // Per-block line switch — turn this one block's connector line off. A block
  // with nothing to point at gets a plain note instead: a switch there would
  // look operable and do nothing.
  let trailing: HTMLElement;
  if (why) {
    const note = document.createElement('span');
    note.className = 'block-note';
    note.textContent = NOT_DRAWN_LABEL[why] ?? 'not shown on the page';
    trailing = note;
  } else {
    const lineSw = makeSwitch('', !disabledLines.has(i), (on) => {
      if (on) disabledLines.delete(i);
      else disabledLines.add(i);
      void pushOverlay();
    });
    lineSw.classList.add('block-line-sw');
    lineSw.title = 'Show this block’s line';
    trailing = lineSw;
  }

  // Selecting a block focuses its line and dims the rest.
  // Only a block the page can actually show is selectable. Selecting one it
  // cannot show used to point the overlay at an index that was never drawn:
  // nothing became the selected block, and every other block dimmed — so the
  // click emptied the page instead of emphasising anything.
  if (why) {
    li.setAttribute('aria-disabled', 'true');
  } else {
    li.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.sw')) return; // switch clicks don't select
      selectedIndex = selectedIndex === i ? null : i;
      for (const el of ol.querySelectorAll('.block-item')) el.classList.remove('selected');
      if (selectedIndex === i) li.classList.add('selected');
      void pushOverlay();
    });
  }

  li.append(num, body, trailing);

  li.append(num, body, trailing);
  return li;
}

function renderFindingsList(findings: BlockFinding[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'blocks-section';
  section.setAttribute('aria-labelledby', 'blocks-heading');

  const header = document.createElement('div');
  header.className = 'blocks-header';
  const h = document.createElement('h2');
  h.id = 'blocks-heading';
  h.textContent = `Findings on this page (${findings.length})`;
  header.appendChild(h);
  section.appendChild(header);

  if (findings.length === 0) {
    const p = document.createElement('p');
    p.className = 'blocks-empty';
    p.textContent = 'No element-level findings on this page.';
    section.appendChild(p);
    return section;
  }

  section.appendChild(renderSeverityBar(findings));

  const ol = document.createElement('ol');
  ol.className = 'block-list';
  for (const [i, f] of findings.entries()) {
    ol.appendChild(renderFindingItem(f, i, ol));
  }
  section.appendChild(ol);
  return section;
}

function refs(): Refs {
  const byId = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`missing #${id} in sidepanel.html`);
    return el as T;
  };
  return {
    scanButton: byId('scan-button'),
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

/**
 * Ensure the extension can inject into the tab it is about to scan. With only
 * the `activeTab` grant, a persistent side panel loses page access the moment
 * the user switches tabs (the grant covered the tab that was active when the
 * toolbar action was clicked, not the one being scanned now) — so the injection
 * is refused on what looks like an ordinary page. Requesting http/https host
 * access from this Scan click (a real user gesture) fixes it permanently; once
 * granted, Chrome remembers it and no prompt appears again.
 */
async function ensureHostAccess(): Promise<void> {
  // A page served over plain http is the ordinary case this exists for: a build
  // on localhost, a preview on an internal host, a staging site nobody has put
  // a certificate on yet. Asking only for https would leave exactly the pages
  // people scan before shipping out of reach, so the pattern stays.
  const origins = ['http://*/*', 'https://*/*']; // NOSONAR: the scheme is the subject, not an oversight
  if (await chrome.permissions.contains({ origins })) return;
  const granted = await chrome.permissions.request({ origins });
  if (!granted) {
    throw new Error('Page access is needed to scan. Click Scan again and choose Allow to let the extension read web pages.');
  }
}

async function runScan(r: Refs): Promise<void> {
  r.scanButton.disabled = true;
  setStatus(r, 'Scanning…');
  showProgress(r);
  try {
    await ensureHostAccess();
    const snapshots: PropertySnapshot[] = [];
    snapshots.push(await captureActiveTab());
    // Queued urls are captured by the same background path if reachable; for the
    // local-only release they are recorded and the active tab is always included.
    const report = await scanSnapshots(snapshots);
    lastReport = report;
    await renderReport(r, report);
    setStatus(
      r,
      `Done — scanned ${report.sites.length} site(s) across ${report.domains.length} domains.`,
    );
    r.exportButton.disabled = false;
  } catch (err) {
    r.results.replaceChildren();
    // Surface the REAL error — an empty message must not collapse to a bare
    // "Scan failed" with no detail (that hides the actual cause).
    const errMsg =
      (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).trim() ||
      'Scan failed (no error detail returned).';

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

async function renderReport(r: Refs, report: MultiDomainReport): Promise<void> {
  const columns = toColumns(report.domains, pluggables);
  const frag = renderGrid(report, columns);
  // Build the ordered "blocks" list once, so the panel numbering and the in-page
  // badge numbering come from the exact same array.
  orderedFindings = flattenFindings(report);
  // Fresh scan → reset the interaction state so stale selection/off-switches
  // from a previous page don't carry over.
  selectedIndex = null;
  disabledLines.clear();

  // Draw the findings on the page before rendering the list. Until now the scan
  // produced a list and left the page untouched until a separate "Highlight on
  // page" button was pressed — so the numbered badges and their lines never
  // appeared, and the switches above them looked as though they did nothing.
  // Drawing first also means the page has already told us which findings it
  // could not point at, so the list can mark those rows on its first render.
  //
  // Failing to draw must not cost the reader the list. The page may refuse the
  // injection, may have navigated away, may be a restricted page — none of that
  // makes the findings less worth reading, and swallowing the list because the
  // decoration failed is the worse outcome by far.
  try {
    await pushOverlay();
  } catch {
    undrawable.clear();
  }
  r.results.replaceChildren(frag, renderFindingsList(orderedFindings));
}

/**
 * Build the conformance report from the scan and open it in a new tab.
 *
 * The panel used to offer the raw scan as a JSON download. Nothing read that
 * file: its only use was to be carried to a terminal by hand and passed to the
 * evidence command, which no part of the interface said. What a reader actually
 * needs is the document itself — criterion by criterion, in a form they can
 * read, print or send on.
 */
function openConformanceReport(): void {
  if (!lastReport) return;

  const violations = findingsToViolations(lastReport as unknown as ScanLikeReport);
  const unmapped = countUnmapped(lastReport as unknown as ScanLikeReport);

  const vpat = emitVpat(violations, {
    productName: lastReport.sites.join(', '),
    productVersion: '',
    evaluator: 'Ariada browser extension',
    evaluationDate: new Date().toISOString().slice(0, 10),
    scope: lastReport.sites.join(', '),
    methodology:
      'Automated scan of the rendered page in the browser. Criteria that no ' +
      'automated check covers are reported as not evaluated rather than as ' +
      'supported: a criterion is only claimed when something exercised it. ' +
      (unmapped > 0
        ? `${unmapped} finding(s) could not be placed against a criterion and are not counted here. `
        : '') +
      'Manual review is required before this is published as a conformance claim.',
  });

  const html = renderVpatHtml(toRenderableVpat(vpat));
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  void chrome.tabs.create({ url });
}


function init(): void {
  const r = refs();
  // Show the extension version in the panel header so a reload is visibly picked
  // up (the number changes when the unpacked build updates).
  const ver = document.getElementById('ext-version');
  if (ver && chrome.runtime?.getManifest) ver.textContent = `v${chrome.runtime.getManifest().version}`;
  renderDomainChecklist(r);
  r.exportButton.disabled = true;

  // In-page highlight control (pluggable painter — box / lines / mascot).
  const bar = r.exportButton.parentElement ?? document.body;
  const painterSel = document.createElement('select');
  painterSel.id = 'painter-select';
  const painterOptions: Array<[string, string]> = [['numbered', 'Numbered blocks'], ['box', 'Boxes'], ['line', 'Lines to blocks'], ['dracula', '🧛 Dracula'], ['thumbelina', '🧚 Thumbelina']];
  for (const [id, label] of painterOptions) {
    const o = document.createElement('option'); o.value = id; o.textContent = label; painterSel.appendChild(o);
  }
  painterSel.value = currentPainter;
  painterSel.addEventListener('change', () => { currentPainter = painterSel.value; void pushOverlay(); });
  bar.appendChild(painterSel);

  r.scanButton.addEventListener('click', () => void runScan(r));
  r.exportButton.addEventListener('click', openConformanceReport);

  // The connector lines leave the page level with their rows, so scrolling the
  // list moves where they should land. Re-aim them once the scrolling settles
  // rather than on every event: each update is a message to the page and a
  // repaint, and doing that per scroll tick would fight the scroll itself.
  let settle: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener(
    'scroll',
    () => {
      if (orderedFindings.length === 0) return;
      clearTimeout(settle);
      settle = setTimeout(() => void pushOverlay(), 120);
    },
    { passive: true, capture: true },
  );
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
    __ariadaCaptureSnapshot?: typeof captureSnapshot;
    __ariadaRenderReport?: (report: MultiDomainReport) => Promise<void>;
    __ariadaOrderedFindings?: () => BlockFinding[];
  }
}
window.__ariadaScanSnapshots = scanSnapshots;
window.__ariadaCaptureSnapshot = captureSnapshot;
window.__ariadaOrderedFindings = () => orderedFindings;
window.__ariadaRenderReport = async (report: MultiDomainReport) => {
  const r = refs();
  lastReport = report;
  await renderReport(r, report);
  setStatus(r, `Done — scanned ${report.sites.length} site(s).`);
  r.exportButton.disabled = false;
};
