// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: Apache-2.0
//
// AG Grid ships official wrappers for React / Angular / Vue, not Svelte. This
// package therefore drives the FRAMEWORK-NEUTRAL vanilla `createGrid` API, and
// every custom cell renderer is a plain DOM class (`init` / `getGui` /
// `refresh`) instead of a framework component. That is not a downgrade: it makes
// the render layer dependency-free — no AntD, no icon library, no Svelte
// runtime inside a cell.
//
// The contract drives everything here. A column's `renderer` / `kind` /
// `colorRamp` picks the cell; nothing keys off a column NAME, so no board can
// be special-cased.
import type {
  AdminGridSurface,
  AdminMetricColumn,
  AdminRowAction,
  AdminColumnHelp,
  OperatorDashboardProfile,
} from '@ariada-org/admin-surface';
import type { ColDef, ICellRendererParams, IHeaderParams } from 'ag-grid-community';

import {
  ADMIN_GRID_ACTION_EFFECT,
  DEFAULT_WIKI,
  asText,
  barContent,
  escapeHtml,
  formatByKind,
  rampContent,
  rampVariant,
  statusColor,
  tagColor,
  wikiHref,
  type AdminGridRow,
  type AdminGridWiki,
  type RampVariant,
} from './format';
import { DEFAULT_I18N, type ResolvedAdminSvelteI18n } from './i18n';
import { actionIconSvg } from './icons';

/** the pinned actions column id — the one column the grid adds itself. */
export const ACTIONS_COLUMN_ID = 'actions';
/** icon button 26px + 5px gap; 18px of column padding. */
const ACTION_BUTTON_SLOT = 31;
const ACTION_COLUMN_PADDING = 18;

/** width of the pinned actions column for a given number of row actions. */
export function actionsColumnWidth(actionCount: number): number {
  return ACTION_COLUMN_PADDING + Math.max(0, actionCount) * ACTION_BUTTON_SLOT;
}

/** the row actions a profile selects, in the profile's order. */
export function resolveRowActions(
  surface: AdminGridSurface,
  profile: OperatorDashboardProfile,
): AdminRowAction[] {
  const byKey = new Map((surface.rowActions ?? []).map((action) => [action.key, action]));
  return (profile.actions ?? [])
    .map((key) => byKey.get(key))
    .filter((action): action is AdminRowAction => Boolean(action));
}

/**
 * An action is disabled when the row already sits in the status the action would
 * move it to (banning a banned row). Derived from the contract's effect table —
 * never from a hard-coded board rule.
 */
export function isActionDisabled(action: AdminRowAction, row: AdminGridRow): boolean {
  const effect = ADMIN_GRID_ACTION_EFFECT[action.key];
  return effect !== undefined && asText(row.status) === effect;
}

/** a row action awaiting confirmation, handed up to the Svelte layer. */
export interface ConfirmRequest {
  readonly row: AdminGridRow;
  readonly action: AdminRowAction;
  /** the button that triggered it, so the popover can be anchored to it. */
  readonly anchor: DOMRect;
}

// ── vanilla cell renderers ───────────────────────────────────────────────────

class StatusDotCell {
  private gui!: HTMLElement;

  init(params: ICellRendererParams): void {
    this.gui = document.createElement('span');
    this.gui.className = 'adm-status-cell';
    const dot = document.createElement('span');
    dot.className = 'adm-status-dot';
    dot.style.background = statusColor((params.data as AdminGridRow | undefined)?.status);
    const url = (params.data as AdminGridRow | undefined)?.url;
    const text = asText(params.value);
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'adm-status-link';
      link.textContent = `${text} ↗`;
      link.addEventListener('click', (event) => event.stopPropagation());
      this.gui.append(dot, link);
    } else {
      const name = document.createElement('span');
      name.className = 'adm-status-name';
      name.textContent = text;
      this.gui.append(dot, name);
    }
  }

  getGui(): HTMLElement { return this.gui; }
  refresh(): boolean { return false; }
}

class TagCell {
  private gui!: HTMLElement;

  init(params: ICellRendererParams): void {
    this.gui = document.createElement('span');
    this.gui.className = 'adm-tag';
    const value = asText(params.value);
    const color = tagColor(value);
    this.gui.textContent = value;
    this.gui.style.color = color;
    this.gui.style.background = `${color}1a`;
    this.gui.style.borderColor = `${color}40`;
  }

  getGui(): HTMLElement { return this.gui; }
  refresh(): boolean { return false; }
}

class BarCell {
  private gui!: HTMLElement;

  init(params: ICellRendererParams): void {
    const content = barContent(params.value);
    this.gui = document.createElement('div');
    this.gui.className = 'adm-bar';
    const track = document.createElement('div');
    track.className = 'adm-bar-track';
    const fill = document.createElement('div');
    fill.className = 'adm-bar-fill';
    fill.style.width = `${content.percent}%`;
    fill.style.background = content.color;
    track.append(fill);
    const label = document.createElement('span');
    label.className = 'adm-bar-label';
    label.style.color = content.color;
    label.textContent = content.text;
    this.gui.append(track, label);
  }

  getGui(): HTMLElement { return this.gui; }
  refresh(): boolean { return false; }
}

interface RampCellParams extends ICellRendererParams {
  variant?: RampVariant;
}

class RampCell {
  private gui!: HTMLElement;

  init(params: RampCellParams): void {
    const content = rampContent(params.variant ?? 'signed', params.value);
    this.gui = document.createElement('span');
    this.gui.className = 'adm-chip';
    this.gui.textContent = content.text;
    this.gui.style.background = content.bg;
    this.gui.style.color = content.fg;
  }

  getGui(): HTMLElement { return this.gui; }
  refresh(): boolean { return false; }
}

interface ActionsCellParams extends ICellRendererParams {
  rowActions?: readonly AdminRowAction[];
  requestConfirm?: (request: ConfirmRequest) => void;
}

class ActionsCell {
  private gui!: HTMLElement;

  init(params: ActionsCellParams): void {
    this.gui = document.createElement('div');
    this.gui.className = 'adm-actions';
    const row = params.data as AdminGridRow | undefined;
    if (!row) return;
    for (const action of params.rowActions ?? []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = action.danger ? 'adm-icon-btn adm-danger' : 'adm-icon-btn';
      button.innerHTML = actionIconSvg(action.key);
      button.title = action.label;
      button.setAttribute('aria-label', action.label);
      button.disabled = isActionDisabled(action, row);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        // Hand off to the Svelte layer so the confirm is a real anchored
        // popover with a reason field, never a browser prompt.
        params.requestConfirm?.({ row, action, anchor: button.getBoundingClientRect() });
      });
      this.gui.append(button);
    }
  }

  getGui(): HTMLElement { return this.gui; }
  refresh(): boolean { return false; }
}

interface MetricHeaderParams extends IHeaderParams {
  help?: AdminColumnHelp;
  columnKey?: string;
  wiki?: AdminGridWiki;
  learnMore?: string;
}

/**
 * Header cell with the ⓘ contextual-help popover (description + formula + wiki
 * link). The help text comes from the column contract, so documentation and
 * board stay in sync by construction.
 */
class MetricHeader {
  private gui!: HTMLElement;
  private popover: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  init(params: MetricHeaderParams): void {
    this.gui = document.createElement('div');
    this.gui.className = 'adm-header';
    const title = document.createElement('span');
    title.className = 'adm-header-title';
    title.textContent = params.displayName;
    title.title = params.displayName;
    if (params.enableSorting) {
      title.classList.add('adm-sortable');
      title.addEventListener('click', (event) => params.progressSort(event.shiftKey));
    }
    this.gui.append(title);

    const help = params.help;
    if (!help) return;
    const info = document.createElement('span');
    info.className = 'adm-header-info';
    info.textContent = 'ⓘ';
    info.setAttribute('role', 'note');
    info.setAttribute('aria-label', help.description);
    info.addEventListener('click', (event) => event.stopPropagation());
    info.addEventListener('mouseenter', () => this.open(info, params, help));
    info.addEventListener('mouseleave', () => this.scheduleClose());
    this.gui.append(info);
  }

  private open(anchor: HTMLElement, params: MetricHeaderParams, help: AdminColumnHelp): void {
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
    if (this.popover) return;
    const wiki = params.wiki ?? DEFAULT_WIKI;
    const columnKey = params.columnKey ?? params.displayName;
    const popover = document.createElement('div');
    popover.className = 'adm-popover adm-anim-pop';
    popover.innerHTML =
      `<div class="adm-popover-title">${escapeHtml(params.displayName)}</div>`
      + `<div class="adm-popover-body">${escapeHtml(help.description)}</div>`
      + (help.formula ? `<div class="adm-popover-formula">${escapeHtml(help.formula)}</div>` : '')
      + `<a class="adm-popover-link" href="${escapeHtml(wikiHref(wiki, help, columnKey))}" target="_blank" rel="noreferrer">${escapeHtml(params.learnMore ?? DEFAULT_I18N.learnMore)}</a>`;
    popover.addEventListener('mouseenter', () => {
      if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
    });
    popover.addEventListener('mouseleave', () => this.scheduleClose());
    const rect = anchor.getBoundingClientRect();
    popover.style.left = `${Math.max(8, Math.min(rect.left - 8, window.innerWidth - 360))}px`;
    popover.style.top = `${rect.bottom + 8}px`;
    document.body.append(popover);
    this.popover = popover;
  }

  private scheduleClose(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.close(), 160);
  }

  private close(): void {
    this.popover?.remove();
    this.popover = null;
    this.closeTimer = null;
  }

  getGui(): HTMLElement { return this.gui; }
  refresh(): boolean { return false; }
  destroy(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.close();
  }
}

/** the renderer classes, exported so a consumer can reuse one in its own colDef. */
export const ADMIN_CELL_RENDERERS = Object.freeze({
  'status-dot': StatusDotCell,
  tag: TagCell,
  bar: BarCell,
  ramp: RampCell,
  actions: ActionsCell,
  header: MetricHeader,
});

// ── contract -> AG Grid column definitions ───────────────────────────────────

/** what the column builder needs besides the surface contract itself. */
export interface BuildColumnDefsOptions {
  readonly wiki?: AdminGridWiki;
  readonly i18n?: ResolvedAdminSvelteI18n;
  /** invoked when a row-action button is pressed; the Svelte layer confirms it. */
  readonly requestConfirm?: (request: ConfirmRequest) => void;
}

/** default width of the `status-dot` name column when the contract omits one. */
const NAME_COLUMN_WIDTH = 230;
const NAME_COLUMN_MIN_WIDTH = 150;

function toColDef(
  column: AdminMetricColumn,
  headerOverride: string | undefined,
  options: BuildColumnDefsOptions,
): ColDef<AdminGridRow> {
  const i18n = options.i18n ?? DEFAULT_I18N;
  const base: ColDef<AdminGridRow> = {
    field: column.key,
    headerName: headerOverride ?? column.label,
    ...(column.width === undefined ? {} : { width: column.width }),
    ...(column.pin ? { pinned: column.pin } : {}),
    ...(column.align === 'right' ? { type: 'rightAligned' } : {}),
    ...(column.align === 'center' ? { cellStyle: { textAlign: 'center' } } : {}),
    headerComponent: MetricHeader,
    headerComponentParams: {
      ...(column.help ? { help: column.help } : {}),
      columnKey: column.key,
      wiki: options.wiki ?? DEFAULT_WIKI,
      learnMore: i18n.learnMore,
    },
  };

  // Numeric columns sort with empty values ALWAYS last, in both directions —
  // an un-measured row (null score / count) is "unknown", not "best" or
  // "worst", so it must never crowd out the real worst score under a
  // worst-first sort.
  if (column.kind === 'score' || column.kind === 'count' || column.kind === 'percent'
    || column.kind === 'currency' || column.kind === 'duration') {
    base.comparator = (a, b, _nodeA, _nodeB, isDescending) => {
      const aEmpty = a === null || a === undefined;
      const bEmpty = b === null || b === undefined;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return isDescending ? -1 : 1;
      if (bEmpty) return isDescending ? 1 : -1;
      return a < b ? -1 : a > b ? 1 : 0;
    };
  }

  switch (column.renderer) {
    case 'status-dot':
      // A fixed-ish name column, NOT flex: a flex column makes AG Grid's
      // fitGridWidth leave the others at natural width and overflow, which
      // pushes the trailing columns off-screen on an 8-11 column board.
      base.width = column.width ?? NAME_COLUMN_WIDTH;
      base.minWidth = NAME_COLUMN_MIN_WIDTH;
      base.cellRenderer = StatusDotCell;
      return base;
    case 'tag':
      base.cellRenderer = TagCell;
      return base;
    case 'bar':
      base.cellRenderer = BarCell;
      return base;
    case 'ramp':
      base.cellRenderer = RampCell;
      base.cellRendererParams = { variant: rampVariant(column) };
      return base;
    default:
      break;
  }

  if (column.kind === 'percent' || column.kind === 'currency'
    || column.kind === 'duration' || column.kind === 'count') {
    base.valueFormatter = (params) => formatByKind(params.value, column.kind);
  }
  return base;
}

/**
 * Build the AG Grid column defs for a profile over a grid surface: the profile
 * picks the columns, their order, their terminology and its sort; the surface
 * declares what each column MEANS. Unknown profile columns are skipped rather
 * than guessed at.
 */
export function buildAdminColumnDefs(
  surface: AdminGridSurface,
  profile: OperatorDashboardProfile,
  options: BuildColumnDefsOptions = {},
): ColDef<AdminGridRow>[] {
  const byKey = new Map(surface.columns.map((column) => [column.key, column]));
  const defs: ColDef<AdminGridRow>[] = [];
  for (const key of profile.columns) {
    const column = byKey.get(key);
    if (!column) continue;
    const def = toColDef(column, profile.terminology?.[key], options);
    const sort = profile.sort ?? surface.defaultSort;
    if (sort && sort.key === key) def.sort = sort.dir;
    defs.push(def);
  }
  const rowActions = resolveRowActions(surface, profile);
  if (rowActions.length > 0) {
    const width = actionsColumnWidth(rowActions.length);
    defs.push({
      colId: ACTIONS_COLUMN_ID,
      headerName: '',
      pinned: 'right',
      width,
      minWidth: width,
      suppressSizeToFit: true,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: ActionsCell,
      cellRendererParams: {
        rowActions,
        ...(options.requestConfirm ? { requestConfirm: options.requestConfirm } : {}),
      },
    });
  }
  return defs;
}
