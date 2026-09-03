# `@ariada-org/admin-svelte`

The Svelte 5 render layer for `@ariada-org/admin-surface` contracts, and the twin of
`@ariada-org/admin-ui` (React + Ant Design).

**One contract, two renderers.** A board declares an `AdminGridSurface`, an
`OperatorDashboardProfile` and an `AdminChartSpec` in
`@ariada-org/admin-surface` — pure data, no framework. Projectology renders those
declarations through `@ariada-org/admin-ui` (React is load-bearing there:
`@lexical/react`, `react-arborist`); a Svelte consumer renders the same
declarations through this package. Neither renderer owns the contract, and a
board never knows which one is drawing it.

> **Status: no consumer yet.** This package was built ahead of the surface that
> will use it — `klarads-app` currently declares only `@ariada-org/admin-surface`,
> and the FAP.NU operator dashboard renders through `@ariada-org/admin-ui` (React).
> The sentence above describes the intended architecture, not the current wiring.
> It is stated here because a README that reads as though the migration already
> happened is how the next agent concludes a job is done that nobody has started.
>
> **Intended first consumer:** a Svelte admin (Ariada, or the KlarAds admin when
> it moves off React). Start from `@ariada-org/admin-surface` for the contract and
> render through this package — see the proof-of-portability note below.

- **No Ant Design, no React, no chart library, no icon library.**
- **Zero runtime dependencies.** `svelte` and `ag-grid-community` are peers.
- **No Tailwind.** `tokens.css` is plain CSS custom properties. A consumer may
  use Tailwind; it is never required.
- AG Grid ships no official Svelte wrapper, so the grid runs on the
  framework-neutral `createGrid` API with vanilla DOM cell renderers.

## Install

```jsonc
// package.json
{
  "dependencies": {
    "@ariada-org/admin-surface": "workspace:*",
    "@ariada-org/admin-svelte": "workspace:*",
    "ag-grid-community": "^36.0.2"
  }
}
```

## Usage

```svelte
<script lang="ts">
  import AdminGrid from '@ariada-org/admin-svelte/AdminGrid.svelte';
  import MetricChart from '@ariada-org/admin-svelte/MetricChart.svelte';
  // one stylesheet; AG Grid v33+ injects its own CSS through the Theming API,
  // so there is no ag-grid stylesheet to import
  import '@ariada-org/admin-svelte/tokens.css';

  import { TRAFFIC_BOARD, PROFILES } from '$lib/boards/traffic';
  import { ACCEPTED_VS_BLOCKED } from '$lib/boards/charts';

  let rows = $state(await loadRows());
  let profile = $state(PROFILES[0]);

  function onAction(row, action, reason) {
    // action.endpoint is the guarded same-origin runtime path from the contract
    fetch(action.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: row.id, reason }),
    });
  }
</script>

<MetricChart spec={ACCEPTED_VS_BLOCKED} {rows} />

<AdminGrid
  surface={TRAFFIC_BOARD}
  {profile}
  {rows}
  height={540}
  {onAction}
  onRowSave={(row) => save(row)}
/>
```

Dark scheme: put `data-adm-scheme="dark"` on `<html>` (or any ancestor) and pass
`scheme="dark"` to `AdminGrid` so the grid theme follows the tokens.

## What the components do

### `AdminGrid.svelte`

Turns a surface + profile + rows into a premium AG Grid. Everything is driven by
CONTRACT fields — `renderer`, `kind`, `colorRamp`, `help`, `rowActions`,
`terminology`, `sort`, `density`, `accent` — and never by a column name, so no
board can be special-cased.

| Contract | Rendered as |
|---|---|
| `renderer: 'status-dot'` | severity dot + name (a link when the row carries a `url`) |
| `renderer: 'tag'` | a coloured chip |
| `renderer: 'bar'` | track + ramp-coloured fill + value |
| `renderer: 'ramp'` | a ramp chip — ratio (`kind: 'ratio'`), low-is-good percent (`colorRamp.good: 'low'`) or signed count |
| `kind` (no renderer) | `count` / `percent` / `currency` / `duration` formatting |
| `help` | an ⓘ header popover: description + formula + wiki link |
| `rowActions` × `profile.actions` | a pinned column of icon buttons, each behind an anchored confirm popover with a reason field |

Props: `surface`, `profile`, `rows`, `accent`, `scheme`, `height`, `wiki`,
`i18n`, `theme`, `quickFilter`, `detailDrawer`, `onAction`, `onRowClick`,
`onRowSave`, and a `detail` snippet rendered above the drawer fields.

A quick filter above the grid searches every column and shows a `shown / total`
counter. Clicking any cell outside the actions column opens the row drawer.

### `RowDetailDrawer.svelte`

Every parameter the surface declares, view + edit, with a `Save` that emits the
edited row.

Its formatting mirrors the **grid's** precedence: `renderer` wins over `kind`.
This is not cosmetic. A column declared `kind: 'percent'` that carries a 0–100
value renders `1%` in the grid (its `ramp` renderer is right) and `100.0%` in any
drawer that formats from `kind` alone — a real defect the Svelte spike caught,
and the reason `formatRowValue()` exists. Anything that shows a row's values next
to the grid — a drawer, a CSV export, a tooltip — must call it.

### `MetricChart.svelte`

Draws an `AdminChartSpec`: `column`, `line`, `funnel`, and `graph` (a
relationship map of `nodes` + `edges` laid out on a circle). Inline SVG with
gradient fills, a grow-in animation, a hover crosshair band and a tooltip. The
spec is the stable seam — a heavier charting backend can swap in behind it
without touching a single board.

### `tokens.css`

One stylesheet: colour / radius / shadow / motion tokens, the primitives the
components use (`.adm-card`, `.adm-btn`, `.adm-input`, `.adm-icon-btn`,
`.adm-seg`, …), the classes the vanilla AG Grid renderers emit, the motion
keyframes, and the dark scheme. Every custom property is namespaced `--adm-*`,
so overriding one re-themes the surface without colliding with the consumer's
own design tokens.

Motion was measured from the Ant Design reference build (`0.2s
cubic-bezier(.645,.045,.355,1)`) and then extended: drawer slide, popover pop,
staggered entrance, hover elevation — all disabled under
`prefers-reduced-motion`.

## Also exported (framework-neutral)

```ts
import {
  buildAdminColumnDefs, resolveRowActions, isActionDisabled, ACTIONS_COLUMN_ID,
  formatRowValue, formatByKind, rampColor, rampContent, rampVariant, barContent,
  statusColor, tagColor, wikiHref, rowLabel, ADMIN_GRID_ACTION_EFFECT,
  plotLayout, graphLayout, chartColor, createAdminGridTheme, resolveI18n,
} from '@ariada-org/admin-svelte';
```

`i18n` defaults to English; pass your own strings. No product copy lives in this
package.

## Verify

```bash
pnpm --filter @ariada-org/admin-svelte typecheck   # tsc + svelte-check
pnpm --filter @ariada-org/admin-svelte test        # vitest
pnpm --filter @ariada-org/admin-svelte build       # tsc -> dist
```

77 tests, in three layers:

1. **Pure helpers** — colour ramp, value formatting and its renderer-over-kind
   precedence, column-def building from a contract, chart geometry.
2. **Server render** — every component is rendered through `svelte/server` and
   asserted on real markup (bars per series, funnel conversion labels, graph
   nodes and edges, and the drawer printing `1%` rather than `100.0%`).
3. **Structural guards** — every `.svelte` file compiles for client and server
   with zero warnings; the import graph contains nothing but the contract, AG
   Grid and Svelte; the stylesheet has no Tailwind directive; no product name
   appears in the render layer.

The suite does **not** mount components or dispatch events — this repo has no DOM
test environment installed (jsdom / happy-dom / `@testing-library/svelte`).
Interaction paths (the confirm popover, drawer editing, the hover crosshair)
belong to the consuming app's Playwright suite.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
