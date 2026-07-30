import { describe, expect, it } from 'vitest';

import {
  ADMIN_GRID_SCHEMA,
  OPERATOR_DASHBOARD_PROFILE_SCHEMA,
  AdminSurfaceValidationError,
  defineAdminGridSurface,
  defineOperatorDashboardProfile,
  validateAdminGridSurface,
  validateOperatorDashboardProfile,
  type AdminGridSurface,
} from './index.js';

const GRID: AdminGridSurface = {
  schemaVersion: ADMIN_GRID_SCHEMA,
  id: 'operator.traffic-board',
  title: 'Source productivity',
  rowKey: 'id',
  columns: [
    { key: 'name', label: 'Source', kind: 'text', pin: 'left' },
    { key: 'productivity', label: 'Productivity', kind: 'score', renderer: 'bar', colorRamp: { good: 'high' } },
    { key: 'owedRatio', label: 'Owed ratio', kind: 'ratio', renderer: 'ramp', colorRamp: { good: 'high' } },
    { key: 'debt', label: 'Debt', kind: 'count', renderer: 'ramp', align: 'right' },
  ],
  rowActions: [
    { key: 'stop_trade', label: 'Stop', confirm: { reasonRequired: true }, endpoint: '/api/traffic/stop' },
    { key: 'ban', label: 'Ban', danger: true, confirm: { reasonRequired: true }, endpoint: '/api/traffic/ban' },
  ],
  defaultSort: { key: 'productivity', dir: 'desc' },
};

describe('AdminGridSurface contract', () => {
  it('accepts a well-formed grid surface', () => {
    expect(validateAdminGridSurface(GRID)).toHaveLength(0);
    expect(() => defineAdminGridSurface(GRID)).not.toThrow();
  });

  it('freezes the defined surface', () => {
    const g = defineAdminGridSurface(GRID);
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.columns)).toBe(true);
  });

  it('rejects duplicate column keys', () => {
    const bad = { ...GRID, columns: [...GRID.columns, GRID.columns[0]] };
    expect(validateAdminGridSurface(bad).some((i) => i.code === 'grid.column.key.duplicate')).toBe(true);
  });

  it('rejects an unknown metric kind', () => {
    const bad = { ...GRID, columns: [{ key: 'x', label: 'X', kind: 'bogus' }] };
    expect(validateAdminGridSurface(bad).some((i) => i.code === 'grid.column.kind.invalid')).toBe(true);
  });

  it('rejects an unknown renderer', () => {
    const bad = { ...GRID, columns: [{ key: 'x', label: 'X', kind: 'count', renderer: 'neon' }] };
    expect(validateAdminGridSurface(bad).some((i) => i.code === 'grid.column.renderer.invalid')).toBe(true);
  });

  it('rejects a non-same-origin or scheme endpoint (guarded runtime only)', () => {
    const bad = { ...GRID, rowActions: [{ key: 'ban', label: 'Ban', confirm: { reasonRequired: true }, endpoint: 'https://evil.example/ban' }] };
    expect(validateAdminGridSurface(bad).some((i) => i.code === 'grid.action.endpoint.invalid')).toBe(true);
    const protoRel = { ...GRID, rowActions: [{ key: 'ban', label: 'Ban', confirm: { reasonRequired: true }, endpoint: '//evil/ban' }] };
    expect(validateAdminGridSurface(protoRel).some((i) => i.code === 'grid.action.endpoint.invalid')).toBe(true);
  });

  it('rejects a defaultSort referencing an undeclared column', () => {
    const bad = { ...GRID, defaultSort: { key: 'nope', dir: 'desc' } };
    expect(validateAdminGridSurface(bad).some((i) => i.code === 'grid.sort.key.invalid')).toBe(true);
  });
});

describe('OperatorDashboardProfile contract', () => {
  const profile = {
    schemaVersion: OPERATOR_DASHBOARD_PROFILE_SCHEMA,
    id: 'smartcj',
    label: 'SmartCJ',
    columns: ['name', 'owedRatio', 'debt', 'productivity'],
    actions: ['stop_trade', 'ban'],
    sort: { key: 'owedRatio', dir: 'desc' as const },
    terminology: { name: 'Trader' },
    density: 'compact' as const,
  };

  it('accepts a profile that selects only declared columns/actions', () => {
    expect(validateOperatorDashboardProfile(profile, GRID)).toHaveLength(0);
    expect(() => defineOperatorDashboardProfile(profile, GRID)).not.toThrow();
  });

  it('validates without a grid (shape only)', () => {
    expect(validateOperatorDashboardProfile(profile)).toHaveLength(0);
  });

  it('rejects a column the grid does not declare', () => {
    const bad = { ...profile, columns: ['name', 'ghost'] };
    expect(validateOperatorDashboardProfile(bad, GRID).some((i) => i.code === 'profile.column.unknown')).toBe(true);
  });

  it('rejects an action the grid does not declare', () => {
    const bad = { ...profile, actions: ['nuke'] };
    expect(validateOperatorDashboardProfile(bad, GRID).some((i) => i.code === 'profile.action.unknown')).toBe(true);
  });

  it('rejects a sort key that is not one of the profile columns', () => {
    const bad = { ...profile, sort: { key: 'debt2', dir: 'desc' } };
    expect(validateOperatorDashboardProfile(bad, GRID).some((i) => i.code === 'profile.sort.key.invalid')).toBe(true);
  });

  it('HARD INVARIANT: fails closed on any visual-skin key', () => {
    for (const key of ['css', 'className', 'style', 'skin', 'stylesheet', 'theme']) {
      const bad = { ...profile, [key]: 'anything' };
      const issues = validateOperatorDashboardProfile(bad, GRID);
      expect(issues.some((i) => i.code === 'profile.visual.forbidden')).toBe(true);
      expect(() => defineOperatorDashboardProfile(bad, GRID)).toThrow(AdminSurfaceValidationError);
    }
  });

  it('allows accent (the one permitted visual knob)', () => {
    const withAccent = { ...profile, accent: '#0d9488' };
    expect(validateOperatorDashboardProfile(withAccent, GRID)).toHaveLength(0);
  });
});
