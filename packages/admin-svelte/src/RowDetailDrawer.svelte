<script lang="ts">
  // SPDX-FileCopyrightText: 2026 Agonist Development AB
  // SPDX-License-Identifier: Apache-2.0
  //
  // Row-operation drawer: click a row -> every parameter the SURFACE declares,
  // viewable and editable.
  //
  // The load-bearing detail: values are formatted with `formatRowValue`, which
  // mirrors the GRID's precedence — `renderer` wins over `kind`. Formatting from
  // `kind` alone is a real, shipped bug: a column declared `kind: 'percent'` that
  // carries a 0-100 value prints "100.0%" in a kind-only drawer while the grid's
  // ramp renderer correctly prints "1%". The drawer must agree with the grid
  // character for character.
  import type { AdminGridSurface, AdminMetricColumn } from '@ariada-org/admin-surface';
  import type { Snippet } from 'svelte';

  import { formatRowValue, rowLabel, toNumber, type AdminGridRow } from './format';
  import { resolveI18n, type AdminSvelteI18n } from './i18n';

  let {
    surface,
    row,
    onClose,
    onSave,
    i18n: i18nOverrides,
    detail,
    editable = true,
  }: {
    surface: AdminGridSurface;
    /** the open row, or null when the drawer is closed. */
    row: AdminGridRow | null;
    onClose: () => void;
    /** save handler; when absent the drawer stays read-only. */
    onSave?: (row: AdminGridRow) => void;
    i18n?: AdminSvelteI18n;
    /** optional slot above the fields (e.g. a video player for a media board). */
    detail?: Snippet<[AdminGridRow]>;
    editable?: boolean;
  } = $props();

  const i18n = $derived(resolveI18n(i18nOverrides));
  const canEdit = $derived(editable && typeof onSave === 'function');

  let editing = $state(false);
  let draft = $state<AdminGridRow>({});

  // A new row resets the editor — never carry one row's draft into another.
  $effect(() => {
    draft = row ? { ...row } : {};
    editing = false;
  });

  const NUMERIC_KINDS = new Set<string>(['count', 'currency', 'percent', 'score', 'duration', 'ratio']);
  const isNumeric = (column: AdminMetricColumn) => NUMERIC_KINDS.has(column.kind);

  function setField(column: AdminMetricColumn, raw: string): void {
    draft = { ...draft, [column.key]: isNumeric(column) ? toNumber(raw) : raw };
  }

  function save(): void {
    onSave?.({ ...draft });
    editing = false;
  }

  function cancel(): void {
    draft = row ? { ...row } : {};
    editing = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && row) onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if row}
  <button class="adm-drawer-mask adm-anim-fade" aria-label={i18n.close} onclick={onClose}></button>
  <aside class="adm-drawer adm-anim-drawer" aria-label={i18n.detailTitle}>
    <div class="adm-drawer-header">
      <div class="adm-drawer-title">
        {i18n.detailTitle} · <b>{rowLabel(row, surface.rowKey)}</b>
      </div>
      <div class="adm-drawer-tools">
        {#if canEdit}
          {#if editing}
            <button class="adm-btn" onclick={cancel}>{i18n.cancel}</button>
            <button class="adm-btn adm-btn-primary" onclick={save}>{i18n.save}</button>
          {:else}
            <button class="adm-btn" onclick={() => (editing = true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>{i18n.edit}
            </button>
          {/if}
        {/if}
        <button class="adm-icon-btn" aria-label={i18n.close} onclick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="adm-drawer-body">
      {#if detail}
        <div class="adm-drawer-slot">{@render detail(row)}</div>
      {/if}
      <div class="adm-section-label">{i18n.parameters}</div>
      <div class="adm-fields">
        {#each surface.columns as column (column.key)}
          <div class="adm-field-row">
            <div class="adm-field-label">{column.label}</div>
            <div class="adm-field-value">
              {#if editing}
                <input
                  class="adm-input"
                  aria-label={column.label}
                  value={draft[column.key] == null ? '' : String(draft[column.key])}
                  oninput={(event) => setField(column, event.currentTarget.value)}
                />
              {:else}
                <span class="adm-tabnum">{formatRowValue(row[column.key], column)}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </aside>
{/if}
