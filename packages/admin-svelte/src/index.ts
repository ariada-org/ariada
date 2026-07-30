// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// @ariada-org/admin-svelte — the Svelte render layer for @ariada-org/admin-surface.
//
// The Svelte components are imported by path (a bundler compiles them), so this
// entry point carries the framework-neutral half: the contract-driven helpers,
// the AG Grid column-def builder, the cell renderers and the chart geometry.
//
//   import AdminGrid from '@ariada-org/admin-svelte/AdminGrid.svelte';
//   import MetricChart from '@ariada-org/admin-svelte/MetricChart.svelte';
//   import RowDetailDrawer from '@ariada-org/admin-svelte/RowDetailDrawer.svelte';
//   import '@ariada-org/admin-svelte/tokens.css';
//   import { formatRowValue } from '@ariada-org/admin-svelte';

export {
  ADMIN_GRID_ACTION_EFFECT,
  DEFAULT_WIKI,
  barContent,
  escapeHtml,
  formatByKind,
  formatInteger,
  formatRowValue,
  rampColor,
  rampContent,
  rampVariant,
  rowLabel,
  statusColor,
  tagColor,
  toNumber,
  NEUTRAL_COLOR,
  type AdminGridRow,
  type AdminGridWiki,
  type BarContent,
  type RampColor,
  type RampContent,
  type RampVariant,
} from './format';

export {
  ACTIONS_COLUMN_ID,
  ADMIN_CELL_RENDERERS,
  actionsColumnWidth,
  buildAdminColumnDefs,
  isActionDisabled,
  resolveRowActions,
  type BuildColumnDefsOptions,
  type ConfirmRequest,
} from './renderers';

export {
  CHART_PADDING,
  CHART_PALETTE,
  chartCategories,
  chartCategoryKey,
  chartColor,
  chartHeight,
  chartMax,
  chartValueKeys,
  chartWidth,
  graphLayout,
  plotLayout,
  type GraphEdgeLine,
  type GraphLayout,
  type GraphNodePoint,
  type PlotBar,
  type PlotCategory,
  type PlotLayout,
} from './chart';

export {
  DEFAULT_ACCENT,
  createAdminGridTheme,
  type AdminColorScheme,
  type AdminGridThemeOptions,
} from './theme';

export {
  DEFAULT_I18N,
  resolveI18n,
  type AdminSvelteI18n,
  type ResolvedAdminSvelteI18n,
} from './i18n';

export { ACTION_ICON_PATHS, actionIconSvg } from './icons';
