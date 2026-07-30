import { describe, expect, it } from 'vitest';
import { defineAdminChartSpec, type AdminChartSpec } from '@ariada-org/admin-surface';

import {
  CHART_PADDING,
  chartCategories,
  chartCategoryKey,
  chartColor,
  chartHeight,
  chartMax,
  chartWidth,
  graphLayout,
  plotLayout,
} from './chart';

const ROWS = [
  { name: 'alpha', accepted: 900, blocked: 100 },
  { name: 'beta', accepted: 400, blocked: 600 },
  { name: 'gamma', accepted: 200, blocked: 0 },
];

const COLUMN: AdminChartSpec = defineAdminChartSpec({
  type: 'column',
  title: 'Accepted vs blocked',
  categoryKey: 'name',
  valueKeys: ['accepted', 'blocked'],
  colors: ['#059669', '#dc2626'],
  height: 180,
});

describe('chart defaults', () => {
  it('falls back to the contract defaults the React renderer also uses', () => {
    expect(chartCategoryKey({ type: 'column', valueKeys: ['x'] })).toBe('name');
    expect(chartHeight({ type: 'column', valueKeys: ['x'] })).toBe(200);
    expect(chartHeight(COLUMN)).toBe(180);
  });

  it('caps categories at maxCategories (default 12)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `n${i}`, accepted: i }));
    expect(chartCategories({ type: 'column', valueKeys: ['accepted'] }, many)).toHaveLength(12);
    expect(chartCategories({ type: 'column', valueKeys: ['accepted'], maxCategories: 4 }, many)).toHaveLength(4);
    expect(chartCategories({ type: 'graph', nodes: [{ id: 'a' }] }, many)).toHaveLength(0);
  });

  it('picks accent for series 0 and the palette after it, unless colours are declared', () => {
    expect(chartColor(COLUMN, 0, '#0d9488')).toBe('#059669');
    expect(chartColor(COLUMN, 1, '#0d9488')).toBe('#dc2626');
    const plain: AdminChartSpec = { type: 'column', valueKeys: ['a', 'b'] };
    expect(chartColor(plain, 0, '#0d9488')).toBe('#0d9488');
    expect(chartColor(plain, 1, '#0d9488')).toBe('#059669');
    expect(chartColor(plain, 7, '#0d9488')).toBe(chartColor(plain, 1, '#0d9488'));
  });

  it('never divides by a zero scale', () => {
    expect(chartMax(COLUMN, [{ accepted: 0, blocked: 0 }])).toBe(1);
    expect(chartMax(COLUMN, [])).toBe(1);
    expect(chartMax(COLUMN, ROWS)).toBe(900);
  });

  it('widens the plot with the category and series count', () => {
    expect(chartWidth(COLUMN, 3)).toBe(280);
    expect(chartWidth(COLUMN, 12)).toBe(12 * 88 + 8);
    expect(chartWidth({ type: 'funnel', valueKeys: ['a'] }, 6)).toBe(6 * 90 + 8);
  });
});

describe('plotLayout — column', () => {
  const layout = plotLayout(COLUMN, ROWS);

  it('lays out one band per category and one bar per series', () => {
    expect(layout.categories).toHaveLength(3);
    expect(layout.categories[0]?.bars.map((b) => b.key)).toEqual(['accepted', 'blocked']);
    expect(layout.categories[0]?.label).toBe('alpha');
  });

  it('scales bar height against the series maximum and sits on the baseline', () => {
    const tallest = layout.categories[0]?.bars[0];
    expect(tallest?.height).toBeCloseTo(layout.plotHeight, 5);
    expect(tallest?.y).toBeCloseTo(CHART_PADDING.top, 5);
    const zero = layout.categories[2]?.bars[1];
    expect(zero?.height).toBe(0);
    expect(zero?.y).toBeCloseTo(layout.baselineY, 5);
  });

  it('keeps every bar inside its own category band', () => {
    for (const category of layout.categories) {
      for (const bar of category.bars) {
        expect(bar.x).toBeGreaterThanOrEqual(category.bandX);
        expect(bar.x + bar.width).toBeLessThanOrEqual(category.bandX + category.bandWidth);
      }
    }
  });

  it('emits no polylines for a column chart', () => {
    expect(layout.lines).toHaveLength(0);
  });

  it('survives an empty dataset', () => {
    const empty = plotLayout(COLUMN, []);
    expect(empty.categories).toHaveLength(0);
    expect(empty.width).toBeGreaterThan(0);
  });
});

describe('plotLayout — line and funnel', () => {
  it('emits one polyline point string per series', () => {
    const layout = plotLayout({ ...COLUMN, type: 'line' }, ROWS);
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0]?.split(' ')).toHaveLength(3);
  });

  it('computes funnel conversion against the first stage', () => {
    const layout = plotLayout({ type: 'funnel', categoryKey: 'name', valueKeys: ['accepted'] }, ROWS);
    expect(layout.categories.map((c) => c.rate)).toEqual([100, 44, 22]);
    expect(layout.categories[0]?.bars).toHaveLength(1);
  });

  it('does not divide by zero when the first funnel stage is empty', () => {
    const layout = plotLayout({ type: 'funnel', valueKeys: ['accepted'] }, [
      { name: 'a', accepted: 0 }, { name: 'b', accepted: 0 },
    ]);
    expect(layout.categories.map((c) => c.rate)).toEqual([100, 0]);
  });
});

describe('graphLayout', () => {
  const spec: AdminChartSpec = defineAdminChartSpec({
    type: 'graph',
    height: 200,
    nodes: [
      { id: 'a', label: 'Set A', group: 'set' },
      { id: 'b', group: 'item' },
      { id: 'c', group: 'item' },
    ],
    edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c', label: 'contains' }],
  });
  const layout = graphLayout(spec, '#0d9488');

  it('places every node on the circle and labels it', () => {
    expect(layout.nodes).toHaveLength(3);
    expect(layout.nodes[0]?.label).toBe('Set A');
    expect(layout.nodes[1]?.label).toBe('b');
    const cx = layout.width / 2;
    const cy = layout.height / 2;
    const radius = Math.hypot((layout.nodes[0]?.x ?? 0) - cx, (layout.nodes[0]?.y ?? 0) - cy);
    for (const node of layout.nodes) {
      expect(Math.hypot(node.x - cx, node.y - cy)).toBeCloseTo(radius, 5);
    }
  });

  it('colours nodes by group', () => {
    expect(layout.nodes[1]?.color).toBe(layout.nodes[2]?.color);
    expect(layout.nodes[0]?.color).not.toBe(layout.nodes[1]?.color);
  });

  it('draws an edge between the two node positions and labels it', () => {
    expect(layout.edges).toHaveLength(2);
    expect(layout.edges[0]?.label).toBe('a → b');
    expect(layout.edges[1]?.label).toBe('contains');
    expect(layout.edges[0]?.x1).toBeCloseTo(layout.nodes[0]?.x ?? 0, 5);
  });

  it('drops an edge whose endpoint is not a declared node, instead of crashing', () => {
    const broken = graphLayout({ type: 'graph', nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'ghost' }] }, '#0d9488');
    expect(broken.edges).toHaveLength(0);
  });

  it('survives an empty node list', () => {
    const empty = graphLayout({ type: 'graph', nodes: [] }, '#0d9488');
    expect(empty.nodes).toHaveLength(0);
    expect(empty.width).toBeGreaterThan(0);
  });
});
