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
 * alone — because this is itself an accessibility product.
 *
 * Non-zero cells expand via a native <details>/<summary> to list each finding
 * with its rule ID, element selector, severity pill, message, and a direct link
 * to the relevant WCAG understanding document. No JavaScript is needed for the
 * drill-down interaction (CSS-only disclosure).
 *
 * Pluggable (non-built-in) columns carry a source badge; sandboxed local-file
 * columns carry a warning marker.
 *
 * If there are no cross-domain interactions an always-visible note panel is
 * rendered explaining what the panel covers, so a user never sees a bare empty
 * region without context.
 */
export function renderGrid(report: MultiDomainReport, columns: readonly DomainColumn[]): DocumentFragment {
  const doc = document;
  const frag = doc.createDocumentFragment();

  // Horizontal scroll wrapper: prevents grid overflow at narrow widths (WCAG 1.4.10).
  // tabindex="0" makes the region keyboard-focusable so users can scroll it with
  // arrow keys — required by WCAG 2.1.1 / axe scrollable-region-focusable rule.
  const wrapper = doc.createElement('div');
  wrapper.className = 'report-grid-wrapper';
  wrapper.setAttribute('tabindex', '0');
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Compliance findings table (scrollable)');

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

  wrapper.appendChild(table);
  frag.appendChild(wrapper);

  // Always-rendered empty state for zero interactions — addresses user confusion
  // when a multi-domain scan has no conflicts (a good outcome, not a broken state).
  if (report.interactions.length === 0) {
    const note = doc.createElement('div');
    note.className = 'empty-panel';
    note.setAttribute('role', 'note');
    note.textContent =
      'No cross-domain conflicts detected. Findings above are independent per domain.';
    frag.appendChild(note);
  }

  return frag;
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

/**
 * Render a table data cell. Zero findings: a "clear" label. Non-zero findings:
 * a <details>/<summary> drill-down listing every finding with severity pill,
 * rule ID, message, element selector, and a WCAG understanding-doc link.
 * No JavaScript is needed — the expansion is handled natively by the browser.
 */
function cell(doc: Document, findings: readonly Finding[]): HTMLTableCellElement {
  const td = doc.createElement('td');
  const count = findings.length;

  if (count === 0) {
    td.dataset['state'] = 'clear';
    td.textContent = '0 — clear';
    return td;
  }

  td.dataset['state'] = 'findings';

  const details = doc.createElement('details');
  details.className = 'findings-detail';

  const summary = doc.createElement('summary');
  summary.className = 'findings-summary';
  summary.textContent = `${count} ${count === 1 ? 'finding' : 'findings'}`;

  const worst = worstSeverity(findings);
  if (worst) {
    const pill = severityPill(doc, worst);
    summary.appendChild(pill);
  }

  details.appendChild(summary);

  const list = doc.createElement('ul');
  list.className = 'finding-list';
  list.setAttribute('role', 'list');

  for (const finding of findings) {
    list.appendChild(findingItem(doc, finding));
  }
  details.appendChild(list);
  td.appendChild(details);
  return td;
}

/** One <li> per finding: severity pill + rule ID + message + selector + WCAG link. */
function findingItem(doc: Document, finding: Finding): HTMLLIElement {
  const li = doc.createElement('li');
  li.className = 'finding-item';

  // Header row: severity pill + rule ID
  const header = doc.createElement('div');
  header.className = 'finding-header';

  const pill = severityPill(doc, finding.severity ?? 'minor');
  header.appendChild(pill);

  const ruleId = doc.createElement('span');
  ruleId.className = 'rule-id';
  ruleId.textContent = finding.ruleId ?? finding.id;
  header.appendChild(ruleId);

  // WCAG link (always rendered; links to WCAG Understanding docs by criterion).
  const wcagRef = wcagLink(doc, finding);
  if (wcagRef) header.appendChild(wcagRef);

  li.appendChild(header);

  // Human-readable message
  if (finding.message) {
    const msg = doc.createElement('p');
    msg.className = 'finding-message';
    msg.textContent = finding.message;
    li.appendChild(msg);
  }

  // Element selector — helps developer find the element in DevTools
  const selector = finding.element?.selector;
  if (selector) {
    const sel = doc.createElement('p');
    sel.className = 'finding-selector';
    sel.textContent = selector;
    li.appendChild(sel);
  }

  return li;
}

/** Build a coloured + labelled severity pill triple-encoding: icon + colour + text. */
function severityPill(doc: Document, severity: string): HTMLSpanElement {
  const pill = doc.createElement('span');
  pill.className = 'severity-pill';
  pill.dataset['severity'] = severity;
  const icon = SEVERITY_ICONS[severity] ?? '•';
  pill.textContent = `${icon} ${severity}`;
  return pill;
}

const SEVERITY_ICONS: Record<string, string> = {
  critical: '●',
  serious: '▲',
  moderate: '◆',
  minor: '○',
};

const SEVERITY_ORDER = ['critical', 'serious', 'moderate', 'minor'] as const;
function worstSeverity(findings: readonly Finding[]): string | undefined {
  for (const sev of SEVERITY_ORDER) {
    if (findings.some((f) => f.severity === sev)) return sev;
  }
  return undefined;
}

/**
 * Return a <a> pointing to the WCAG 2.2 Understanding document for the criterion
 * number embedded in the finding, if any. The finding's ruleId may contain a
 * criterion reference (e.g. "image-alt" maps to 1.1.1). We map a subset of
 * common rule IDs; unknown rules get a link to the WCAG overview.
 *
 * Links open in the same browser tab (side-panel context). The text is short so
 * screen readers read it naturally inline with the rule ID.
 */
function wcagLink(doc: Document, finding: Finding): HTMLAnchorElement | null {
  const sc = criterionForRule(finding.ruleId ?? finding.id);
  const a = doc.createElement('a');
  a.className = 'wcag-link';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  if (sc) {
    a.href = `https://www.w3.org/WAI/WCAG22/Understanding/${scToSlug(sc)}`;
    a.textContent = `WCAG ${sc}`;
    a.setAttribute('aria-label', `WCAG success criterion ${sc} (opens in new tab)`);
  } else {
    // Fallback: link to WCAG 2.2 overview — always actionable
    a.href = 'https://www.w3.org/TR/WCAG22/';
    a.textContent = 'WCAG 2.2';
    a.setAttribute('aria-label', 'WCAG 2.2 overview (opens in new tab)');
  }
  return a;
}

/**
 * Map a subset of common rule IDs to their WCAG 2.2 success criterion numbers.
 * Axe-core rule IDs follow the pattern: the ruleId often encodes the criterion.
 * Unknown rules fall back to the WCAG overview link.
 */
function criterionForRule(ruleId: string): string | null {
  const lower = ruleId.toLowerCase();
  // 1.1.1 Non-text content
  if (lower.includes('image-alt') || lower.includes('img-alt') || lower.includes('input-image-alt')) return '1.1.1';
  // 1.3.1 Info and relationships
  if (lower.includes('label') && !lower.includes('unique')) return '1.3.1';
  if (lower === 'td-headers-attr' || lower === 'th-has-data-cells') return '1.3.1';
  if (lower.includes('list') || lower === 'listitem') return '1.3.1';
  // 1.3.3 Sensory characteristics
  if (lower.includes('sensory')) return '1.3.3';
  // 1.4.1 Use of color
  if (lower.includes('color-contrast') || lower.includes('colour-contrast')) return '1.4.3';
  // 1.4.3 Contrast (minimum)
  if (lower === 'color-contrast' || lower === 'color-contrast-enhanced') return '1.4.3';
  // 2.1.1 Keyboard
  if (lower.includes('keyboard') || lower === 'tabindex') return '2.1.1';
  // 2.4.1 Bypass blocks
  if (lower.includes('bypass') || lower.includes('skip-link')) return '2.4.1';
  // 2.4.2 Page titled
  if (lower === 'document-title') return '2.4.2';
  // 2.4.3 Focus order
  if (lower === 'focus-order-semantics') return '2.4.3';
  // 2.4.4 Link purpose
  if (lower.includes('link-name') || lower.includes('link-in-text-block')) return '2.4.4';
  // 3.1.1 Language of page
  if (lower === 'html-lang-valid' || lower === 'html-has-lang') return '3.1.1';
  // 3.3.1 Error identification
  if (lower.includes('aria-invalid')) return '3.3.1';
  // 4.1.1 Parsing
  if (lower === 'duplicate-id' || lower.includes('parsing')) return '4.1.1';
  // 4.1.2 Name, role, value
  if (lower.includes('aria-') || lower.includes('role') || lower.includes('button-name')) return '4.1.2';
  return null;
}

/** Convert a criterion number like "1.1.1" to the WCAG understanding-doc URL slug. */
function scToSlug(sc: string): string {
  // WCAG Understanding doc slugs are the SC number with dashes, e.g. 1.1.1 → non-text-content
  // We map the common ones; others fall through to the SC number directly (which redirects).
  const SLUG_MAP: Record<string, string> = {
    '1.1.1': 'non-text-content',
    '1.3.1': 'info-and-relationships',
    '1.3.3': 'sensory-characteristics',
    '1.4.1': 'use-of-color',
    '1.4.3': 'contrast-minimum',
    '1.4.4': 'resize-text',
    '1.4.10': 'reflow',
    '1.4.11': 'non-text-contrast',
    '2.1.1': 'keyboard',
    '2.4.1': 'bypass-blocks',
    '2.4.2': 'page-titled',
    '2.4.3': 'focus-order',
    '2.4.4': 'link-purpose-in-context',
    '2.5.5': 'target-size',
    '3.1.1': 'language-of-page',
    '3.3.1': 'error-identification',
    '4.1.1': 'parsing',
    '4.1.2': 'name-role-value',
  };
  return SLUG_MAP[sc] ?? sc;
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
