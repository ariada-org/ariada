import { describe, expect, it } from 'vitest';
import {
  ADMIN_GRID_SCHEMA,
  OPERATOR_DASHBOARD_PROFILE_SCHEMA,
  defineAdminGridSurface,
  defineOperatorDashboardProfile,
  type AdminGridSurface,
  type OperatorDashboardProfile,
} from '@ariada-org/admin-surface';

import {
  ACTIONS_COLUMN_ID,
  ADMIN_CELL_RENDERERS,
  actionsColumnWidth,
  buildAdminColumnDefs,
  isActionDisabled,
  resolveRowActions,
} from './renderers';

const SURFACE: AdminGridSurface = defineAdminGridSurface({
  schemaVersion: ADMIN_GRID_SCHEMA,
  id: 'operator.traffic-board',
  title: 'Source productivity',
  rowKey: 'id',
  columns: [
    { key: 'name', label: 'Source', kind: 'text', renderer: 'status-dot' },
    { key: 'kindTag', label: 'Kind', kind: 'enum', renderer: 'tag' },
    { key: 'productivity', label: 'Productivity', kind: 'score', renderer: 'bar', colorRamp: { good: 'high' } },
    { key: 'owedRatio', label: 'Owed ratio', kind: 'ratio', renderer: 'ramp', colorRamp: { good: 'high' }, help: { description: 'What partners owe us.', formula: 'accepted / owed', wikiSlug: 'owed-ratio' } },
    { key: 'debt', label: 'Debt', kind: 'count', renderer: 'ramp', align: 'right' },
    { key: 'fraudPct', label: 'Fraud', kind: 'percent', renderer: 'ramp', colorRamp: { good: 'low' } },
    { key: 'accepted', label: 'Accepted', kind: 'count' },
    { key: 'unused', label: 'Unused', kind: 'count' },
  ],
  rowActions: [
    { key: 'stop_trade', label: 'Stop', confirm: { reasonRequired: true }, endpoint: '/api/traffic/stop' },
    { key: 'hold', label: 'Hold', confirm: { reasonRequired: true }, endpoint: '/api/traffic/hold' },
    { key: 'ban', label: 'Ban', danger: true, confirm: { reasonRequired: true }, endpoint: '/api/traffic/ban' },
  ],
  defaultSort: { key: 'productivity', dir: 'desc' },
});

const PROFILE: OperatorDashboardProfile = defineOperatorDashboardProfile({
  schemaVersion: OPERATOR_DASHBOARD_PROFILE_SCHEMA,
  id: 'smartcj',
  label: 'SmartCJ',
  columns: ['name', 'kindTag', 'productivity', 'owedRatio', 'debt', 'fraudPct', 'accepted'],
  actions: ['stop_trade', 'ban'],
  sort: { key: 'owedRatio', dir: 'desc' },
  terminology: { name: 'Trader' },
}, SURFACE);

describe('buildAdminColumnDefs', () => {
  const defs = buildAdminColumnDefs(SURFACE, PROFILE);

  it('renders exactly the profile columns, in profile order, plus the actions column', () => {
    expect(defs.map((d) => d.field ?? d.colId)).toEqual([
      'name', 'kindTag', 'productivity', 'owedRatio', 'debt', 'fraudPct', 'accepted', ACTIONS_COLUMN_ID,
    ]);
  });

  it('never renders a column the profile did not select', () => {
    expect(defs.some((d) => d.field === 'unused')).toBe(false);
  });

  it('skips a profile column the surface does not declare, instead of guessing', () => {
    const ghosted = { ...PROFILE, columns: ['name', 'ghost', 'accepted'] } as OperatorDashboardProfile;
    expect(buildAdminColumnDefs(SURFACE, ghosted).map((d) => d.field ?? d.colId))
      .toEqual(['name', 'accepted', ACTIONS_COLUMN_ID]);
  });

  it('applies the profile terminology override to the header', () => {
    expect(defs[0]?.headerName).toBe('Trader');
    expect(defs[6]?.headerName).toBe('Accepted');
  });

  it('maps each contract renderer to its cell renderer', () => {
    expect(defs[0]?.cellRenderer).toBe(ADMIN_CELL_RENDERERS['status-dot']);
    expect(defs[1]?.cellRenderer).toBe(ADMIN_CELL_RENDERERS.tag);
    expect(defs[2]?.cellRenderer).toBe(ADMIN_CELL_RENDERERS.bar);
    expect(defs[3]?.cellRenderer).toBe(ADMIN_CELL_RENDERERS.ramp);
    expect(defs[6]?.cellRenderer).toBeUndefined();
  });

  it('passes the ramp variant resolved from kind / colorRamp', () => {
    expect(defs[3]?.cellRendererParams).toEqual({ variant: 'ratio' });
    expect(defs[4]?.cellRendererParams).toEqual({ variant: 'signed' });
    expect(defs[5]?.cellRendererParams).toEqual({ variant: 'low-percent' });
  });

  it('formats plain columns from their kind', () => {
    const formatter = defs[6]?.valueFormatter;
    expect(typeof formatter).toBe('function');
    expect(typeof formatter === 'function' ? formatter({ value: 9300 } as never) : null).toBe('9,300');
  });

  it('gives the name column a fixed width so fitGridWidth cannot starve the tail', () => {
    expect(defs[0]?.width).toBe(230);
    expect(defs[0]?.minWidth).toBe(150);
  });

  it('carries contextual help into the header component params', () => {
    expect(defs[3]?.headerComponent).toBe(ADMIN_CELL_RENDERERS.header);
    expect(defs[3]?.headerComponentParams).toMatchObject({
      columnKey: 'owedRatio',
      help: { description: 'What partners owe us.', formula: 'accepted / owed', wikiSlug: 'owed-ratio' },
    });
    expect(defs[6]?.headerComponentParams).not.toHaveProperty('help');
  });

  it('applies the profile sort, and falls back to the surface default sort', () => {
    expect(defs[3]?.sort).toBe('desc');
    expect(defs[2]?.sort).toBeUndefined();
    const noSort = { ...PROFILE, sort: undefined } as OperatorDashboardProfile;
    const fallback = buildAdminColumnDefs(SURFACE, noSort);
    expect(fallback[2]?.sort).toBe('desc');
    expect(fallback[3]?.sort).toBeUndefined();
  });

  it('right-aligns from the contract', () => {
    expect(defs[4]?.type).toBe('rightAligned');
    expect(defs[6]?.type).toBeUndefined();
  });

  it('pins the actions column and sizes it for icon buttons', () => {
    const actions = defs[defs.length - 1];
    expect(actions?.colId).toBe(ACTIONS_COLUMN_ID);
    expect(actions?.pinned).toBe('right');
    expect(actions?.sortable).toBe(false);
    // 2 profile actions -> 18 + 2*31. The React build reserved 44 + n*34 for
    // text buttons and starved the data columns.
    expect(actions?.width).toBe(80);
    expect(actions?.minWidth).toBe(80);
  });

  it('omits the actions column when the profile selects no action', () => {
    const readOnly = { ...PROFILE, actions: [] } as unknown as OperatorDashboardProfile;
    expect(buildAdminColumnDefs(SURFACE, readOnly).some((d) => d.colId === ACTIONS_COLUMN_ID)).toBe(false);
  });
});

describe('row actions', () => {
  it('resolves only the actions the profile selects, in profile order', () => {
    expect(resolveRowActions(SURFACE, PROFILE).map((a) => a.key)).toEqual(['stop_trade', 'ban']);
  });

  it('ignores an action key the surface never declared', () => {
    const bogus = { ...PROFILE, actions: ['ban', 'launch_missiles'] } as OperatorDashboardProfile;
    expect(resolveRowActions(SURFACE, bogus).map((a) => a.key)).toEqual(['ban']);
  });

  it('disables an action whose effect the row already has', () => {
    const ban = SURFACE.rowActions![2]!;
    expect(isActionDisabled(ban, { status: 'banned' })).toBe(true);
    expect(isActionDisabled(ban, { status: 'active' })).toBe(false);
    expect(isActionDisabled(ban, {})).toBe(false);
  });

  it('sizes the actions column from the action count', () => {
    expect(actionsColumnWidth(0)).toBe(18);
    expect(actionsColumnWidth(3)).toBe(111);
  });
});
