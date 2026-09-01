<script lang="ts">
  // SPDX-FileCopyrightText: 2026 Agonist Development AB
  // SPDX-License-Identifier: Apache-2.0
  //
  // <LiveRoom> — the reusable three-pane Live Audit Room shell, ported from
  // stroyka's LiveReviewRoom pattern. LEFT: the catalog of things under audit
  // (document sheets there, project pages/URLs here). CENTRE: the subject (a PDF
  // sheet there, a live SITE here) — supplied by the host as a snippet. RIGHT:
  // findings streaming in as the auditors finish ("готово N из M"), each a card.
  // A live-focus connector draws the eye from the active finding to its place in
  // the subject. The shell owns layout + streaming + focus; the host owns the
  // subject render, the finding card, and the actual auditor (e.g. the Ariada
  // scanner). Apache-2.0 — any auditor front-end can reuse it.
  import type { Snippet } from 'svelte';
  import type { FocusController } from './focus-controller.svelte.ts';

  interface CatalogItem { id: string; label: string; count?: number; href?: string }
  interface Progress { done: number; total: number; label?: string }

  let {
    title = 'Live audit',
    catalog = [] as CatalogItem[],
    activeId = $bindable<string | null>(null),
    progress,
    blockers = 0,
    remarks = 0,
    focus,
    onRecheck,
    onReleaseReport,
    subject,
    findings,
    empty,
  }: {
    title?: string;
    catalog?: CatalogItem[];
    activeId?: string | null;
    progress?: Progress;
    blockers?: number;
    remarks?: number;
    /** the live-focus controller (createFocusController) — optional */
    focus?: FocusController;
    onRecheck?: () => void;
    onReleaseReport?: () => void;
    /** CENTRE — the subject under audit (host renders the live site here) */
    subject: Snippet;
    /** RIGHT — the streaming findings pane (host renders finding cards) */
    findings: Snippet;
    /** optional empty state when there is nothing to show yet */
    empty?: Snippet;
  } = $props();

  const streaming = $derived(!!progress && progress.done < progress.total);
</script>

<div class="live-room">
  <!-- TOP BAR: progress · status pills · actions -->
  <header class="lr-top">
    <span class="lr-title">{title}</span>
    {#if progress}
      <span class="lr-progress" class:streaming>
        {progress.label ?? 'Checked'} {progress.done} of {progress.total}
      </span>
    {/if}
    <span class="lr-spacer"></span>
    {#if blockers}<span class="lr-pill blockers">Blockers {blockers}</span>{/if}
    {#if remarks}<span class="lr-pill remarks">Remarks {remarks}</span>{/if}
    {#if focus}
      <button class="lr-btn" onclick={() => (focus.mode === 'follow' ? focus.pauseFollow() : focus.resumeFollow())}>
        {focus.mode === 'follow' ? 'Pause live-focus' : 'Follow the audit'}
      </button>
    {/if}
    {#if onRecheck}<button class="lr-btn accent" onclick={onRecheck}>Re-check</button>{/if}
    {#if onReleaseReport}<button class="lr-btn" onclick={onReleaseReport}>Release report</button>{/if}
  </header>

  <div class="lr-body">
    <!-- LEFT: catalog of things under audit -->
    <nav class="lr-left" aria-label="Audit catalog">
      {#each catalog as item (item.id)}
        {#if item.href}
          <!-- host uses routing: a real link so the subject (keyed on the URL)
               actually changes, plus middle-click / open-in-new-tab work -->
          <a
            class="lr-item"
            class:active={item.id === activeId}
            href={item.href}
            onclick={() => { activeId = item.id; focus?.onManualInteraction(); }}
          >
            <span class="lr-item-label">{item.label}</span>
            {#if item.count != null}<span class="lr-item-count">{item.count}</span>{/if}
          </a>
        {:else}
          <button
            class="lr-item"
            class:active={item.id === activeId}
            onclick={() => { activeId = item.id; focus?.onManualInteraction(); }}
          >
            <span class="lr-item-label">{item.label}</span>
            {#if item.count != null}<span class="lr-item-count">{item.count}</span>{/if}
          </button>
        {/if}
      {/each}
    </nav>

    <!-- CENTRE: the subject (host-rendered live site) -->
    <main class="lr-center" onscroll={() => focus?.onManualInteraction()}>
      {@render subject()}
    </main>

    <!-- RIGHT: streaming findings -->
    <aside class="lr-right" aria-label="Findings">
      {#if progress && progress.done === 0 && empty}
        {@render empty()}
      {:else}
        {@render findings()}
      {/if}
    </aside>
  </div>

  {#if streaming}
    <footer class="lr-stream" role="status">
      <span class="lr-spin" aria-hidden="true"></span>
      Auditing (streaming): {progress?.done} of {progress?.total} done — conclusions appear as they are ready.
    </footer>
  {/if}
</div>

<style>
  .live-room { display: flex; flex-direction: column; height: 100vh; color: #e6e6e6; background: #0d0d0f; font-family: system-ui, sans-serif; }
  .lr-top { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,.1); }
  .lr-title { font-weight: 700; }
  .lr-progress { font-size: 13px; color: #9aa0a6; }
  .lr-progress.streaming::before { content: '● '; color: #d29922; }
  .lr-spacer { flex: 1; }
  .lr-pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
  .lr-pill.blockers { background: rgba(248,81,73,.18); color: #ff6b64; }
  .lr-pill.remarks { background: rgba(210,153,34,.18); color: #e3b341; }
  .lr-btn { font-size: 13px; padding: 6px 12px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: transparent; color: #e6e6e6; cursor: pointer; }
  .lr-btn.accent { background: #2ea043; border-color: #2ea043; color: #fff; }
  .lr-body { flex: 1; display: grid; grid-template-columns: 240px 1fr 340px; min-height: 0; }
  .lr-left { overflow-y: auto; border-right: 1px solid rgba(255,255,255,.1); padding: 8px; }
  .lr-item { display: flex; justify-content: space-between; gap: 8px; width: 100%; text-align: left; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: #c9d1d9; font-size: 13px; cursor: pointer; text-decoration: none; box-sizing: border-box; }
  .lr-item:hover { background: rgba(255,255,255,.05); }
  .lr-item.active { background: rgba(46,160,67,.16); color: #fff; }
  .lr-item-count { color: #6e7681; }
  .lr-center { overflow: auto; background: #16161a; }
  .lr-right { overflow-y: auto; border-left: 1px solid rgba(255,255,255,.1); padding: 12px; }
  .lr-stream { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid rgba(255,255,255,.1); font-size: 13px; color: #9aa0a6; }
  .lr-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.25); border-top-color: #d29922; border-radius: 50%; animation: lr-rot 0.9s linear infinite; }
  @keyframes lr-rot { to { transform: rotate(360deg); } }
</style>
