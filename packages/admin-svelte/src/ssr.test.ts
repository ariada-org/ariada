// Server-side render tests: the components are rendered for real (through
// `svelte/server`) and asserted on their markup. No DOM environment is
// installed in this repo, so nothing is mounted and no event is dispatched —
// click paths (confirm popover, drawer editing, hover crosshair) are covered by
// the consuming app's Playwright suite.
import {
  ADMIN_GRID_SCHEMA,
  defineAdminChartSpec,
  defineAdminGridSurface,
  type AdminGridSurface,
} from '@ariada-org/admin-surface';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import AdminGrid from './AdminGrid.svelte';
import MetricChart from './MetricChart.svelte';
import RowDetailDrawer from './RowDetailDrawer.svelte';

const ROWS = [
  { id: '1', name: 'alpha', accepted: 900, blocked: 100 },
  { id: '2', name: 'beta', accepted: 400, blocked: 600 },
];

describe('<MetricChart> server render', () => {
  it('renders a column chart with a bar per series and a category label', () => {
    const spec = defineAdminChartSpec({
      type: 'column',
      title: 'Accepted vs blocked',
      categoryKey: 'name',
      valueKeys: ['accepted', 'blocked'],
      colors: ['#059669', '#dc2626'],
      height: 180,
    });
    const { body } = render(MetricChart, { props: { spec, rows: ROWS } });
    expect(body).toContain('Accepted vs blocked');
    // 2 categories x 2 series
    expect(body.match(/<rect[^>]*fill="url\(#/g) ?? []).toHaveLength(4);
    // one hover band per category
    expect(body.match(/<rect[^>]*role="presentation"/g) ?? []).toHaveLength(2);
    expect(body).toContain('alpha');
    expect(body).toContain('>beta<');
    // legend swatches use the declared colours
    expect(body).toContain('#059669');
    expect(body).toContain('#dc2626');
    // a gradient per series
    expect(body.match(/<linearGradient/g) ?? []).toHaveLength(2);
  });

  it('renders a line chart as one polyline per series', () => {
    const spec = defineAdminChartSpec({ type: 'line', categoryKey: 'name', valueKeys: ['accepted', 'blocked'] });
    const { body } = render(MetricChart, { props: { spec, rows: ROWS } });
    expect(body.match(/<polyline/g) ?? []).toHaveLength(2);
    expect(body.match(/<rect[^>]*fill="url\(#/g) ?? []).toHaveLength(0);
  });

  it('renders a funnel with conversion labels', () => {
    const spec = defineAdminChartSpec({ type: 'funnel', categoryKey: 'name', valueKeys: ['accepted'] });
    const { body } = render(MetricChart, { props: { spec, rows: ROWS } });
    expect(body).toContain('100%');
    expect(body).toContain('44%');
  });

  it('renders a graph relationship map as nodes and edges', () => {
    const spec = defineAdminChartSpec({
      type: 'graph',
      title: 'Relationship map',
      nodes: [{ id: 'a', label: 'Set A', group: 'set' }, { id: 'b', group: 'item' }],
      edges: [{ from: 'a', to: 'b', label: 'contains' }],
    });
    const { body } = render(MetricChart, { props: { spec, rows: [] } });
    expect(body.match(/<circle/g) ?? []).toHaveLength(2);
    expect(body.match(/<line/g) ?? []).toHaveLength(1);
    expect(body).toContain('<title>contains</title>');
    expect(body).toContain('Set A');
  });

  it('renders the empty state instead of an axis-less chart', () => {
    const spec = defineAdminChartSpec({ type: 'column', categoryKey: 'name', valueKeys: ['accepted'] });
    const { body } = render(MetricChart, { props: { spec, rows: [] } });
    expect(body).toContain('no data');
    expect(body).not.toContain('<svg');
  });
});

const SURFACE: AdminGridSurface = defineAdminGridSurface({
  schemaVersion: ADMIN_GRID_SCHEMA,
  id: 'operator.traffic-board',
  title: 'Source productivity',
  rowKey: 'id',
  columns: [
    { key: 'name', label: 'Source', kind: 'text', renderer: 'status-dot' },
    { key: 'debt', label: 'Debt', kind: 'count', renderer: 'ramp', align: 'right' },
    { key: 'fraudPct', label: 'Fraud', kind: 'percent', renderer: 'ramp', colorRamp: { good: 'low' } },
    { key: 'owedRatio', label: 'Owed ratio', kind: 'ratio', renderer: 'ramp' },
    { key: 'accepted', label: 'Accepted', kind: 'count' },
    { key: 'blockedPct', label: 'Blocked share', kind: 'percent' },
  ],
});

const ROW = { id: '7', name: 'alpha', debt: 3120, fraudPct: 1, owedRatio: 1.482, accepted: 9300, blockedPct: 0.232 };

const PROFILE = {
  schemaVersion: 'ariada-org.operator-dashboard-profile/v1',
  id: 'default',
  label: 'Default',
  columns: ['name', 'debt', 'fraudPct'],
  actions: [],
} as const;

describe('<AdminGrid> server render', () => {
  // The grid itself is created in onMount, which SSR never runs; what this
  // proves is that the module graph is server-safe (AG Grid's vanilla API does
  // not touch the DOM at import time) and that the chrome renders.
  it('renders the quick filter, the row counter and the grid viewport', () => {
    const { body } = render(AdminGrid, {
      props: { surface: SURFACE, profile: PROFILE as never, rows: [ROW, { ...ROW, id: '8' }], height: 400 },
    });
    expect(body).toContain('adm-grid-viewport');
    expect(body).toContain('Search the table…');
    expect(body).toContain('height:400px');
    expect(body).toContain('>2');
  });

  it('can be rendered without the quick filter', () => {
    const { body } = render(AdminGrid, {
      props: { surface: SURFACE, profile: PROFILE as never, rows: [ROW], quickFilter: false },
    });
    expect(body).not.toContain('adm-grid-toolbar');
    expect(body).toContain('adm-grid-viewport');
  });
});

describe('<RowDetailDrawer> server render', () => {
  it('renders every surface column with the GRID formatting (renderer over kind)', () => {
    const { body } = render(RowDetailDrawer, { props: { surface: SURFACE, row: ROW, onClose: () => {} } });
    for (const column of SURFACE.columns) expect(body).toContain(column.label);
    // The defect this drawer exists to avoid: fraudPct is kind:'percent' with a
    // 0-100 value, so a kind-only formatter would print "100.0%" here.
    expect(body).toContain('1%');
    expect(body).not.toContain('100.0%');
    expect(body).toContain('+3,120');
    expect(body).toContain('1.48');
    expect(body).toContain('9,300');
    expect(body).toContain('23.2%');
    expect(body).toContain('alpha');
  });

  it('renders nothing when no row is open', () => {
    const { body } = render(RowDetailDrawer, { props: { surface: SURFACE, row: null, onClose: () => {} } });
    expect(body.replace(/<!--[\s\S]*?-->/g, '').trim()).toBe('');
  });

  it('hides the edit affordance when the consumer passes no save handler', () => {
    const { body } = render(RowDetailDrawer, { props: { surface: SURFACE, row: ROW, onClose: () => {} } });
    expect(body).not.toContain('>Edit<');
  });

  it('shows the edit affordance when a save handler is passed', () => {
    const { body } = render(RowDetailDrawer, {
      props: { surface: SURFACE, row: ROW, onClose: () => {}, onSave: () => {} },
    });
    expect(body).toContain('Edit');
  });

  it('accepts consumer locale strings instead of the English defaults', () => {
    const { body } = render(RowDetailDrawer, {
      props: {
        surface: SURFACE,
        row: ROW,
        onClose: () => {},
        i18n: { detailTitle: 'Операция', parameters: 'Параметры' },
      },
    });
    expect(body).toContain('Операция');
    expect(body).toContain('Параметры');
    expect(body).not.toContain('Operation');
  });
});
