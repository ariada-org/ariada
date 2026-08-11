<script lang="ts">
  import AdminGrid from '@ariada-org/admin-svelte/AdminGrid.svelte';
  import { AUDITS_BOARD, AUDIT_PROFILES } from '$lib/boards/audits';
  import { PROJECTS } from '$lib/projects/taler';

  let project = $state(PROJECTS[0]);
  let profile = $state(AUDIT_PROFILES[0]);

  // Row actions carry the loop. In this scaffold they log / open; the real
  // endpoints (scan/report/plugin/remediate) are wired in the next increment.
  function onAction(row: any, action: { key: string; endpoint: string }, reason?: string) {
    if (action.key === 'plugin') {
      // Live-plugin loop: open the console's subject-viewer with the URL so the
      // Chrome extension can show the healed before/after. Placeholder route.
      window.open(`/subject?url=${encodeURIComponent(row.url)}&heal=1`, '_blank');
      return;
    }
    if (action.key === 'report' && row.reportToken) {
      window.open(`/r/${row.reportToken}`, '_blank');
      return;
    }
    // scan / remediate → guarded API (not wired in the scaffold)
    console.info('action', action.key, row.id, reason);
  }

  const stat = (fn: (r: any) => boolean) => project.resources.filter(fn).length;
</script>

<section class="page">
  <div class="controls">
    <label>Project
      <select bind:value={project}>
        {#each PROJECTS as p}<option value={p}>{p.name}</option>{/each}
      </select>
    </label>
    <label>View
      <select bind:value={profile}>
        {#each AUDIT_PROFILES as pr}<option value={pr}>{pr.label}</option>{/each}
      </select>
    </label>
  </div>

  <div class="stats">
    <span><strong>{project.resources.length}</strong> resources</span>
    <span><strong>{stat((r) => r.scanStatus === 'scanned')}</strong> scanned</span>
    <span><strong>{stat((r) => r.scanStatus === 'to-scan')}</strong> to scan</span>
    <span><strong>{stat((r) => r.group === 'bank')}</strong> pilot banks</span>
    <span><strong>{stat((r) => r.group === 'grantee-module')}</strong> grant modules</span>
  </div>

  <AdminGrid surface={AUDITS_BOARD} {profile} rows={project.resources} {onAction} />
</section>
