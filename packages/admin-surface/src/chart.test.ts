import { describe, expect, it } from 'vitest';

import {
  ADMIN_CHART_DEFAULT_CATEGORY_KEY,
  ADMIN_CHART_DEFAULT_HEIGHT,
  ADMIN_CHART_DEFAULT_MAX_CATEGORIES,
  AdminSurfaceValidationError,
  defineAdminChartSpec,
  validateAdminChartSpec,
  type AdminChartSpec,
} from './index.js';

const COLUMN: AdminChartSpec = {
  type: 'column',
  title: 'Accepted vs blocked by source',
  categoryKey: 'name',
  valueKeys: ['accepted', 'blocked'],
  colors: ['#059669', '#dc2626'],
  height: 180,
};

const GRAPH: AdminChartSpec = {
  type: 'graph',
  title: 'Relationship map',
  nodes: [
    { id: 'set-1', label: 'Комплект 1', group: 'set' },
    { id: 'item-1', label: 'Item 1', group: 'item' },
    { id: 'item-2', label: 'Item 2', group: 'item' },
  ],
  edges: [
    { from: 'set-1', to: 'item-1', label: 'contains' },
    { from: 'set-1', to: 'item-2' },
  ],
};

describe('AdminChartSpec contract — plot charts', () => {
  it('accepts a well-formed column spec', () => {
    expect(validateAdminChartSpec(COLUMN)).toHaveLength(0);
    expect(() => defineAdminChartSpec(COLUMN)).not.toThrow();
  });

  it('accepts line and funnel with the same shape', () => {
    expect(validateAdminChartSpec({ ...COLUMN, type: 'line' })).toHaveLength(0);
    expect(validateAdminChartSpec({ ...COLUMN, type: 'funnel', valueKeys: ['raws'] })).toHaveLength(0);
  });

  it('accepts a spec that omits the optional categoryKey (renderer default applies)', () => {
    expect(validateAdminChartSpec({ type: 'column', valueKeys: ['accepted'] })).toHaveLength(0);
  });

  it('freezes the defined spec', () => {
    const spec = defineAdminChartSpec(COLUMN);
    expect(Object.isFrozen(spec)).toBe(true);
    expect(Object.isFrozen(spec.valueKeys)).toBe(true);
  });

  it('rejects an unknown chart type', () => {
    expect(validateAdminChartSpec({ ...COLUMN, type: 'sankey' }).some((i) => i.code === 'chart.type.invalid')).toBe(true);
    expect(() => defineAdminChartSpec({ ...COLUMN, type: 'sankey' })).toThrow(AdminSurfaceValidationError);
  });

  it('rejects a plot chart with no value keys', () => {
    expect(validateAdminChartSpec({ type: 'column', categoryKey: 'name' }).some((i) => i.code === 'chart.valueKeys.invalid')).toBe(true);
    expect(validateAdminChartSpec({ ...COLUMN, valueKeys: [] }).some((i) => i.code === 'chart.valueKeys.invalid')).toBe(true);
  });

  it('rejects duplicate value keys', () => {
    const bad = { ...COLUMN, valueKeys: ['accepted', 'accepted'] };
    expect(validateAdminChartSpec(bad).some((i) => i.code === 'chart.valueKey.duplicate')).toBe(true);
  });

  it('rejects graph data on a plot chart', () => {
    const bad = { ...COLUMN, nodes: [{ id: 'a' }] };
    expect(validateAdminChartSpec(bad).some((i) => i.code === 'chart.graph.forbidden')).toBe(true);
  });

  it('rejects a non-literal colour (a skin, not data)', () => {
    for (const color of ['url(#g)', 'var(--brand)', 'red', 'linear-gradient(red, blue)', '#12345']) {
      expect(validateAdminChartSpec({ ...COLUMN, colors: [color] }).some((i) => i.code === 'chart.color.invalid')).toBe(true);
    }
    expect(validateAdminChartSpec({ ...COLUMN, colors: ['#fff', '#0d9488', '#0d948880'] })).toHaveLength(0);
  });

  it('rejects out-of-range maxCategories and height', () => {
    expect(validateAdminChartSpec({ ...COLUMN, maxCategories: 0 }).some((i) => i.code === 'chart.maxCategories.invalid')).toBe(true);
    expect(validateAdminChartSpec({ ...COLUMN, maxCategories: 12.5 }).some((i) => i.code === 'chart.maxCategories.invalid')).toBe(true);
    expect(validateAdminChartSpec({ ...COLUMN, height: -1 }).some((i) => i.code === 'chart.height.invalid')).toBe(true);
  });

  it('HARD INVARIANT: fails closed on any visual-skin key', () => {
    for (const key of ['css', 'className', 'style', 'skin', 'stylesheet', 'theme']) {
      const bad = { ...COLUMN, [key]: 'anything' };
      expect(validateAdminChartSpec(bad).some((i) => i.code === 'chart.visual.forbidden')).toBe(true);
      expect(() => defineAdminChartSpec(bad)).toThrow(AdminSurfaceValidationError);
    }
  });
});

describe('AdminChartSpec contract — graph (relationship map)', () => {
  it('accepts a well-formed graph spec', () => {
    expect(validateAdminChartSpec(GRAPH)).toHaveLength(0);
    expect(() => defineAdminChartSpec(GRAPH)).not.toThrow();
  });

  it('rejects a graph with no nodes', () => {
    expect(validateAdminChartSpec({ type: 'graph', nodes: [] }).some((i) => i.code === 'chart.nodes.invalid')).toBe(true);
    expect(validateAdminChartSpec({ type: 'graph' }).some((i) => i.code === 'chart.nodes.invalid')).toBe(true);
  });

  it('rejects duplicate node ids', () => {
    const bad = { ...GRAPH, nodes: [...GRAPH.nodes!, { id: 'item-1' }] };
    expect(validateAdminChartSpec(bad).some((i) => i.code === 'chart.node.id.duplicate')).toBe(true);
  });

  it('rejects an edge referencing an undeclared node', () => {
    const bad = { ...GRAPH, edges: [{ from: 'set-1', to: 'ghost' }] };
    expect(validateAdminChartSpec(bad).some((i) => i.code === 'chart.edge.unknown_node')).toBe(true);
  });

  it('rejects series keys on a graph chart', () => {
    const bad = { ...GRAPH, valueKeys: ['accepted'] };
    expect(validateAdminChartSpec(bad).some((i) => i.code === 'chart.series.forbidden')).toBe(true);
  });
});

describe('AdminChartSpec renderer defaults', () => {
  it('exports the defaults both renderers must agree on', () => {
    expect(ADMIN_CHART_DEFAULT_CATEGORY_KEY).toBe('name');
    expect(ADMIN_CHART_DEFAULT_MAX_CATEGORIES).toBe(12);
    expect(ADMIN_CHART_DEFAULT_HEIGHT).toBe(200);
  });
});
