// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Pure, DOM-free helpers shared by every renderer in this package. They are
// deliberately separated from the Svelte components and the AG Grid cell
// renderers so the parts that carry the actual RULES — the colour ramp, the
// value formatting, the renderer-over-kind precedence — can be unit-tested
// without a browser.
import type { AdminColumnHelp, AdminMetricColumn } from '@ariada-org/admin-surface';

/** a row is opaque to the render layer: the contract, not the shape, drives it. */
export type AdminGridRow = Record<string, unknown>;

export interface RampColor {
  /** translucent chip background. */
  readonly bg: string;
  /** foreground / fill colour. */
  readonly fg: string;
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-US');

/** integer group formatting, e.g. 9300 -> "9,300". */
export function formatInteger(value: number): string {
  return NUMBER_FORMAT.format(Math.round(value));
}

/** coerce an unknown cell value to a number without throwing (0 is the floor). */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const RAMP_BAD = { r: 220, g: 38, b: 38 } as const;
const RAMP_GOOD = { r: 5, g: 150, b: 105 } as const;

/**
 * Health (0 = worst, 1 = best) -> a red→green ramp. Identical arithmetic to the
 * React renderer in `@ariada-org/admin-ui`, so a value is the same colour in both.
 */
export function rampColor(health: number): RampColor {
  const h = Math.max(0, Math.min(1, Number.isFinite(health) ? health : 0));
  const r = Math.round(RAMP_BAD.r + (RAMP_GOOD.r - RAMP_BAD.r) * h);
  const g = Math.round(RAMP_BAD.g + (RAMP_GOOD.g - RAMP_BAD.g) * h);
  const b = Math.round(RAMP_BAD.b + (RAMP_GOOD.b - RAMP_BAD.b) * h);
  return { bg: `rgba(${r},${g},${b},0.12)`, fg: `rgb(${r},${g},${b})` };
}

/** which flavour of `renderer: 'ramp'` a column resolves to. */
export type RampVariant = 'ratio' | 'signed' | 'low-percent';

/**
 * A ramp column has three shapes and the contract picks between them:
 * `kind: 'ratio'` -> a 0..2-ish ratio, `colorRamp.good: 'low'` -> a 0..100
 * percent where low is good (fraud), anything else -> a signed count (debt).
 */
export function rampVariant(column: Pick<AdminMetricColumn, 'kind' | 'colorRamp'>): RampVariant {
  if (column.kind === 'ratio') return 'ratio';
  if (column.colorRamp?.good === 'low') return 'low-percent';
  return 'signed';
}

export interface RampContent extends RampColor {
  readonly text: string;
}

/** the text + colours a `ramp` cell paints, without touching the DOM. */
export function rampContent(variant: RampVariant, value: unknown): RampContent {
  const n = toNumber(value);
  if (variant === 'ratio') return { text: n.toFixed(2), ...rampColor((n - 0.5) / 1.0) };
  if (variant === 'low-percent') return { text: `${Math.round(n)}%`, ...rampColor(1 - n / 100) };
  return { text: `${n > 0 ? '+' : ''}${formatInteger(n)}`, ...rampColor(n >= 0 ? 0.85 : 0.15) };
}

export interface BarContent {
  /** clamped 0..100 fill width. */
  readonly percent: number;
  readonly text: string;
  readonly color: string;
}

/** the fill width, label and colour a `bar` cell paints. */
export function barContent(value: unknown): BarContent {
  const n = toNumber(value);
  const percent = Math.max(0, Math.min(100, n));
  return { percent, text: String(Math.round(n)), color: rampColor(percent / 100).fg };
}

/** neutral fallback for a status/tag the palette does not know. */
export const NEUTRAL_COLOR = '#64748b';
const NEUTRAL_DOT = '#94a3b8';

/**
 * Status severity -> dot colour. Generic operational vocabulary only; no
 * product-specific statuses live in the render layer.
 */
const SEVERITY: Readonly<Record<string, string>> = Object.freeze({
  active: '#059669', approved: '#059669', used: '#059669', running: '#059669',
  enabled: '#059669', ready: '#059669', winner: '#059669', settled: '#059669', deployed: '#059669',
  hold: '#d97706', holding: '#d97706', review: '#d97706', pending: '#d97706', paused: '#d97706',
  scheduled: '#d97706', idle: '#d97706', submission: '#d97706', exploring: '#d97706', 'in-progress': '#d97706',
  banned: '#dc2626', rejected: '#dc2626', disabled: '#dc2626', error: '#dc2626', dispute: '#dc2626',
  built: '#0891b2', spec: '#94a3b8', superseded: '#94a3b8',
});

/** the dot colour for a row status; unknown statuses fall back to neutral grey. */
export function statusColor(status: unknown): string {
  return SEVERITY[String(status ?? '')] ?? NEUTRAL_DOT;
}

const TAG_COLOR: Readonly<Record<string, string>> = Object.freeze({
  feeder: '#2563eb', barter: '#4f46e5', paid: '#7c3aed',
  api: '#0891b2', csv: '#2563eb', ftp: '#4f46e5', upload: '#7c3aed', scrape: '#ea580c',
  block: '#2563eb', widget: '#4f46e5', 'in-article': '#0891b2', header: '#ca8a04', footer: '#65a30d',
  active: '#059669', approved: '#059669', used: '#059669', running: '#059669', ready: '#059669',
  enabled: '#059669', winner: '#059669', settled: '#059669', deployed: '#059669',
  paused: '#d97706', hold: '#d97706', holding: '#d97706', review: '#2563eb', pending: '#2563eb',
  scheduled: '#2563eb', submission: '#2563eb', 'in-progress': '#2563eb', generated: '#4f46e5',
  banned: '#dc2626', rejected: '#dc2626', disabled: '#dc2626', error: '#dc2626', dispute: '#dc2626',
  licensed: '#059669', imported: '#ea580c', transcoding: '#2563eb',
  idle: NEUTRAL_COLOR, spec: NEUTRAL_COLOR, superseded: NEUTRAL_COLOR, loser: NEUTRAL_COLOR,
});

/** the chip colour for a `tag` cell; unknown values fall back to slate. */
export function tagColor(value: unknown): string {
  return TAG_COLOR[String(value ?? '')] ?? NEUTRAL_COLOR;
}

/** format a value from its metric `kind` alone (no renderer involved). */
export function formatByKind(value: unknown, kind: AdminMetricColumn['kind'] | undefined): string {
  const n = toNumber(value);
  switch (kind) {
    case 'percent': return `${(n * 100).toFixed(1)}%`;
    case 'currency': return `$${n.toFixed(2)}`;
    case 'duration': return `${n}s`;
    case 'count': return formatInteger(n);
    case 'ratio': return n.toFixed(2);
    case 'score': return String(Math.round(n));
    default: return String(value ?? '');
  }
}

/**
 * Format a value the way the GRID would — `renderer` wins over `kind`.
 *
 * This precedence is the whole point of the function and the reason the detail
 * drawer must not format from `kind` alone. Real case caught by the Svelte
 * spike: `fraudPct` is declared `kind: 'percent'` but carries a 0–100 value; its
 * `ramp` renderer correctly prints `1%`, while a kind-only formatter multiplies
 * by 100 again and prints `100.0%`. Anything that shows a row's values next to
 * the grid (a drawer, a CSV export, a tooltip) has to use this function.
 */
export function formatRowValue(
  value: unknown,
  column: Pick<AdminMetricColumn, 'kind' | 'renderer' | 'colorRamp'>,
): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value !== 'number') return String(value);
  if (column.renderer === 'ramp') return rampContent(rampVariant(column), value).text;
  if (column.renderer === 'bar') return barContent(value).text;
  return formatByKind(value, column.kind);
}

/** wiki config for the column-header "learn more" link (language-aware). */
export interface AdminGridWiki {
  /** base URL, e.g. "https://wiki.klarads.com". */
  readonly base: string;
  /** language segment, e.g. "en" / "ru". */
  readonly lang: string;
}

export const DEFAULT_WIKI: AdminGridWiki = Object.freeze({ base: 'https://wiki.klarads.com', lang: 'en' });

/** resolve a column's contextual-help wiki URL (slug defaults to the column key). */
export function wikiHref(wiki: AdminGridWiki, help: AdminColumnHelp, columnKey: string): string {
  const slug = help.wikiSlug ?? columnKey;
  const anchor = help.wikiAnchor ? `#${help.wikiAnchor}` : '';
  return `${wiki.base.replace(/\/$/, '')}/${wiki.lang}/metrics/${slug}${anchor}`;
}

/** action key -> the status a row optimistically moves to when the action fires. */
export const ADMIN_GRID_ACTION_EFFECT: Readonly<Record<string, string>> = Object.freeze({
  stop_trade: 'paused', hold: 'hold', ban: 'banned',
  approve: 'approved', reject: 'rejected', disable: 'disabled', pause_placement: 'paused',
});

/** a row label for confirm dialogs and drawer titles, derived from the row itself. */
export function rowLabel(row: AdminGridRow, rowKey = 'id'): string {
  for (const key of ['title', 'name', 'label', 'surface']) {
    const candidate = row[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
  }
  return String(row[rowKey] ?? '');
}

/** escape a string for safe interpolation into innerHTML in a vanilla renderer. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
