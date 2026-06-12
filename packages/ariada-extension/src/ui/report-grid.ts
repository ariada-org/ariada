// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { MultiDomainReport, Finding } from '@ariada-org/core-engine';

/** How a domain module entered the registry — drives the column source badge. */
export type ModuleSource = 'built-in' | 'companion-cli' | 'local-file';

/** One column in the report grid: a registered domain and how it was loaded. */
export interface DomainColumn {
  readonly id: string;
  readonly label: string;
  readonly source: ModuleSource;
  /** False for sandboxed (untrusted) local-file modules; true otherwise. */
  readonly trusted?: boolean;
}

/**
 * Render the multi-domain report as an accessible table: domains across the top,
 * scanned sites down the side, each cell showing that site-and-domain pair's
 * finding count. Status is signalled with a text label and glyph — never colour
 * alone — because this is itself an accessibility product. Pluggable (non
 * built-in) columns carry a source badge; sandboxed local-file columns carry a
 * warning marker.
 */
export function renderGrid(report: MultiDomainReport, columns: readonly DomainColumn[]): HTMLTableElement {
  const doc = document;
  const table = doc.createElement('table');
  table.className = 'report-grid';

  const caption = doc.createElement('caption');
  caption.textContent = `Compliance findings across ${report.sites.length} site(s) and ${columns.length} domain(s)`;
  table.appendChild(caption);

  // Header row: a corner cell + one cell per domain column.
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  headRow.appendChild(cornerHeader(doc));
  for (const col of columns) {
    headRow.appendChild(columnHeader(doc, col));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Body: one row per site.
  const tbody = doc.createElement('tbody');
  for (const site of report.sites) {
    const row = doc.createElement('tr');
    const siteHeader = doc.createElement('th');
    siteHeader.setAttribute('scope', 'row');
    siteHeader.textContent = shortenUrl(site);
    siteHeader.title = site;
    row.appendChild(siteHeader);

    for (const col of columns) {
      row.appendChild(cell(doc, report.grid[site]?.[col.id] ?? []));
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  // Cross-domain interactions appear in a footer region of the same table so a
  // screen-reader user encounters them in the report's reading order.
  if (report.interactions.length > 0) {
    table.appendChild(interactionFoot(doc, report));
  }

  return table;
}

function cornerHeader(doc: Document): HTMLTableCellElement {
  const th = doc.createElement('th');
  th.setAttribute('scope', 'col');
  th.textContent = 'Site';
  return th;
}

function columnHeader(doc: Document, col: DomainColumn): HTMLTableCellElement {
  const th = doc.createElement('th');
  th.setAttribute('scope', 'col');
  th.dataset['source'] = col.source;
  const label = doc.createElement('span');
  label.className = 'col-label';
  label.textContent = col.label;
  th.appendChild(label);

  const badgeText = sourceBadge(col);
  if (badgeText) {
    const badge = doc.createElement('span');
    badge.className = 'source-badge';
    badge.textContent = badgeText;
    th.appendChild(badge);
  }
  if (col.source === 'local-file') {
    th.classList.add('untrusted-column');
  }
  return th;
}

/** Text-only badge so column provenance is conveyed without colour. */
function sourceBadge(col: DomainColumn): string {
  switch (col.source) {
    case 'companion-cli':
      return '✓ CLI';
    case 'local-file':
      return '⚠ local';
    case 'built-in':
    default:
      return '';
  }
}

function cell(doc: Document, findings: readonly Finding[]): HTMLTableCellElement {
  const td = doc.createElement('td');
  const count = findings.length;
  if (count > 0) {
    td.dataset['state'] = 'findings';
    td.textContent = `${count} ${count === 1 ? 'finding' : 'findings'}`;
    const worst = worstSeverity(findings);
    if (worst) td.title = `Most severe: ${worst}`;
  } else {
    td.dataset['state'] = 'clear';
    td.textContent = '0 — clear';
  }
  return td;
}

const SEVERITY_ORDER = ['critical', 'serious', 'moderate', 'minor'] as const;
function worstSeverity(findings: readonly Finding[]): string | undefined {
  for (const sev of SEVERITY_ORDER) {
    if (findings.some((f) => f.severity === sev)) return sev;
  }
  return undefined;
}

function interactionFoot(doc: Document, report: MultiDomainReport): HTMLTableSectionElement {
  const tfoot = doc.createElement('tfoot');
  const row = doc.createElement('tr');
  const cellEl = doc.createElement('td');
  cellEl.colSpan = report.domains.length + 1;
  cellEl.className = 'interactions';

  const heading = doc.createElement('p');
  heading.textContent = `${report.interactions.length} cross-domain interaction(s) detected:`;
  cellEl.appendChild(heading);

  const list = doc.createElement('ul');
  for (const inter of report.interactions) {
    const item = doc.createElement('li');
    item.dataset['interaction'] = inter.type;
    item.textContent = `${inter.type}: ${inter.domains.join(' ↔ ')} — ${inter.predictedEffect}`;
    list.appendChild(item);
  }
  cellEl.appendChild(list);
  row.appendChild(cellEl);
  tfoot.appendChild(row);
  return tfoot;
}

/** Trim a url to host + truncated path for compact display; full url is in title. */
function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 16 ? `${u.pathname.slice(0, 15)}…` : u.pathname;
    return `${u.host}${path === '/' ? '' : path}`;
  } catch {
    return url;
  }
}
