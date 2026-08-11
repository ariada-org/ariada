<script lang="ts">
  // SPDX-FileCopyrightText: 2026 Agonist Development AB
  // SPDX-License-Identifier: EUPL-1.2
  //
  // <AdminGrid> — the shared Svelte render layer for @ariada-org/admin-surface grid
  // contracts, and the twin of <AdminGrid> in @ariada-org/admin-ui (React). It turns
  // a validated AdminGridSurface + OperatorDashboardProfile + rows into a premium
  // AG Grid, driven ENTIRELY by contract fields (renderer / kind / colorRamp /
  // help / rowActions) and never by a column name. A profile changes content and
  // functionality; it can never change the chrome.
  //
  // AG Grid has no official Svelte wrapper, so this drives the framework-neutral
  // `createGrid` API with vanilla DOM cell renderers (see ./renderers.ts).
  import { onMount } from 'svelte';
  import type { AdminGridSurface, AdminRowAction, OperatorDashboardProfile } from '@ariada-org/admin-surface';
  import { AllCommunityModule, ModuleRegistry, createGrid } from 'ag-grid-community';
  import type { GridApi, Theme } from 'ag-grid-community';
  import type { Snippet } from 'svelte';

  import RowDetailDrawer from './RowDetailDrawer.svelte';
  import { rowLabel, type AdminGridRow, type AdminGridWiki } from './format';
  import { resolveI18n, type AdminSvelteI18n } from './i18n';
  import { ACTIONS_COLUMN_ID, buildAdminColumnDefs, type ConfirmRequest } from './renderers';
  import { DEFAULT_ACCENT, createAdminGridTheme, type AdminColorScheme } from './theme';

  ModuleRegistry.registerModules([AllCommunityModule]);

  let {
    surface,
    profile,
    rows,
    accent,
    scheme = 'light',
    height = 560,
    wiki,
    i18n: i18nOverrides,
    theme: themeOverride,
    quickFilter: showQuickFilter = true,
    detailDrawer = true,
    onAction,
    onRowClick,
    onRowSave,
    detail,
  }: {
    surface: AdminGridSurface;
    profile: OperatorDashboardProfile;
    rows: AdminGridRow[];
    /** brand accent; the profile's own accent wins when it declares one. */
    accent?: string;
    scheme?: AdminColorScheme;
    height?: number;
    wiki?: AdminGridWiki;
    i18n?: AdminSvelteI18n;
    /** replace the shared grid theme entirely (escape hatch; prefer `accent`). */
    theme?: Theme;
    quickFilter?: boolean;
    /** render the built-in row-operation drawer on cell click. */
    detailDrawer?: boolean;
    /** a confirmed row action: the reason is always audit-relevant. */
    onAction?: (row: AdminGridRow, action: AdminRowAction, reason: string) => void;
    onRowClick?: (row: AdminGridRow) => void;
    onRowSave?: (row: AdminGridRow) => void;
    /** optional slot above the drawer fields (e.g. a player for a media board). */
    detail?: Snippet<[AdminGridRow]>;
  } = $props();

  const i18n = $derived(resolveI18n(i18nOverrides));
  const resolvedAccent = $derived(profile.accent ?? accent ?? DEFAULT_ACCENT);
  const gridTheme = $derived(themeOverride ?? createAdminGridTheme({ accent: resolvedAccent, scheme }));

  let viewport: HTMLDivElement;
  let api = $state<GridApi<AdminGridRow> | null>(null);
  let quickFilterText = $state('');
  // Set by the grid itself; only read while the quick filter is active, so it
  // never needs to seed from `rows` (which would capture a stale initial value).
  let shown = $state(0);
  let detailRow = $state<AdminGridRow | null>(null);

  // The anchored confirm popover — the Popconfirm equivalent. A row action never
  // fires from a click alone: it needs an explicit confirm, and a reason when the
  // contract demands one.
  let confirmRequest = $state<ConfirmRequest | null>(null);
  let confirmReason = $state('');

  const reasonRequired = $derived(confirmRequest?.action.confirm?.reasonRequired ?? true);
  const confirmBlocked = $derived(reasonRequired && confirmReason.trim().length === 0);

  function requestConfirm(request: ConfirmRequest): void {
    confirmRequest = request;
    confirmReason = '';
  }

  const columnDefs = $derived(buildAdminColumnDefs(surface, profile, {
    ...(wiki ? { wiki } : {}),
    i18n,
    requestConfirm,
  }));

  onMount(() => {
    const instance = createGrid<AdminGridRow>(viewport, {
      theme: gridTheme,
      rowData: rows,
      columnDefs,
      getRowId: (params) => String(params.data[surface.rowKey] ?? params.data.id ?? ''),
      onGridReady: (event) => {
        event.api.sizeColumnsToFit();
        shown = event.api.getDisplayedRowCount();
      },
      onModelUpdated: (event) => { shown = event.api.getDisplayedRowCount(); },
      onCellClicked: (event) => {
        if (event.colDef.colId === ACTIONS_COLUMN_ID || !event.data) return;
        onRowClick?.(event.data);
        if (detailDrawer) detailRow = event.data;
      },
      defaultColDef: { sortable: true, resizable: true, filter: true, minWidth: 76 },
      autoSizeStrategy: { type: 'fitGridWidth', defaultMinWidth: 78 },
      rowHeight: profile.density === 'compact' ? 36 : 44,
      headerHeight: 42,
      animateRows: true,
      suppressCellFocus: true,
    });
    api = instance;
    return () => { instance.destroy(); api = null; };
  });

  // Re-fit on every board/profile switch: autoSizeStrategy only fires once at
  // grid init, so a wide board would otherwise keep natural widths and push the
  // trailing columns off-screen.
  $effect(() => {
    const grid = api;
    if (!grid) return;
    grid.setGridOption('columnDefs', columnDefs);
    grid.sizeColumnsToFit();
  });
  $effect(() => { api?.setGridOption('rowData', rows); });
  $effect(() => { api?.setGridOption('theme', gridTheme); });
  $effect(() => { api?.setGridOption('quickFilterText', quickFilterText); });

  function confirmAction(): void {
    const request = confirmRequest;
    if (!request || confirmBlocked) return;
    onAction?.(request.row, request.action, confirmReason.trim());
    confirmRequest = null;
    confirmReason = '';
  }

  function saveRow(row: AdminGridRow): void {
    onRowSave?.(row);
    detailRow = null;
  }

  const CONFIRM_WIDTH = 300;
  const confirmLeft = $derived(
    confirmRequest
      ? Math.max(8, Math.min(confirmRequest.anchor.left - 240, window.innerWidth - CONFIRM_WIDTH - 12))
      : 0,
  );
  const confirmTop = $derived(confirmRequest ? confirmRequest.anchor.bottom + 8 : 0);
</script>

<div class="adm-grid" style="height:{height}px">
  {#if showQuickFilter}
    <div class="adm-grid-toolbar">
      <div class="adm-search">
        <span class="adm-search-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </span>
        <input
          class="adm-input"
          type="search"
          aria-label={i18n.searchPlaceholder}
          placeholder={i18n.searchPlaceholder}
          bind:value={quickFilterText}
        />
      </div>
      <span class="adm-grid-count">
        {#if quickFilterText}<b>{shown}</b> / {rows.length}{:else}{rows.length}{/if}
      </span>
    </div>
  {/if}
  <div class="adm-grid-viewport" bind:this={viewport}></div>
</div>

{#if confirmRequest}
  <div
    class="adm-scrim"
    role="presentation"
    onclick={() => (confirmRequest = null)}
  ></div>
  <div
    class="adm-card adm-confirm adm-anim-pop"
    role="dialog"
    aria-label={confirmRequest.action.label}
    style="left:{confirmLeft}px; top:{confirmTop}px"
  >
    <div class="adm-confirm-title">
      <span
        class="adm-confirm-dot"
        style="background:{confirmRequest.action.danger ? 'var(--adm-danger)' : 'var(--adm-warning)'}"
      ></span>
      {confirmRequest.action.confirm?.title
        ?? `${confirmRequest.action.label} · ${rowLabel(confirmRequest.row, surface.rowKey)}`}
    </div>
    <textarea
      class="adm-textarea"
      rows="2"
      aria-label={reasonRequired ? i18n.reasonRequiredPlaceholder : i18n.reasonOptionalPlaceholder}
      placeholder={reasonRequired ? i18n.reasonRequiredPlaceholder : i18n.reasonOptionalPlaceholder}
      bind:value={confirmReason}
    ></textarea>
    <div class="adm-confirm-actions">
      <button class="adm-btn" onclick={() => (confirmRequest = null)}>{i18n.cancel}</button>
      <button
        class="adm-btn {confirmRequest.action.danger ? 'adm-btn-danger' : 'adm-btn-primary'}"
        disabled={confirmBlocked}
        onclick={confirmAction}
      >{confirmRequest.action.label}</button>
    </div>
  </div>
{/if}

{#if detailDrawer}
  <RowDetailDrawer
    {surface}
    row={detailRow}
    onClose={() => { detailRow = null; }}
    {...(i18nOverrides ? { i18n: i18nOverrides } : {})}
    {...(onRowSave ? { onSave: saveRow } : {})}
    {...(detail ? { detail } : {})}
  />
{/if}
