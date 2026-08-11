<script lang="ts">
  // Subject viewer — the live-plugin loop (M4). Loads the subject URL and hands
  // it to the Ariada Chrome extension (packages/ariada-extension) to render the
  // healed before/after live on the real page. First wave: open live, no deploy.
  import { page } from '$app/state';
  const url = $derived(page.url.searchParams.get('url') ?? '');
  const heal = $derived(page.url.searchParams.get('heal') === '1');
</script>

<svelte:head><title>Ariada — live subject</title></svelte:head>

<main class="subject">
  <header>
    <span class="brand">Ariada</span>
    <span class="muted">live subject{heal ? ' — healed preview' : ''}</span>
    <a class="ext" href={url} target="_blank" rel="noopener">open subject ↗</a>
  </header>
  <p class="hint">
    Install the Ariada browser extension to see the remediated <em>before/after</em>
    overlaid on this page. The extension receives the subject URL and the
    <code>heal</code> command from here.
  </p>
  {#if url}
    <iframe title="subject" src={url}></iframe>
  {:else}
    <p class="muted">No subject URL provided.</p>
  {/if}
</main>

<style>
  .subject { display: flex; flex-direction: column; min-height: 100vh; color: #1a1a1a; }
  header { display: flex; gap: 12px; align-items: baseline; padding: 12px 20px; border-bottom: 1px solid rgba(0,0,0,.12); }
  .brand { font-weight: 700; }
  .muted { color: #767676; }
  .ext { margin-left: auto; color: #0b5cad; }
  .hint { padding: 12px 20px; color: #595959; margin: 0; }
  iframe { flex: 1; width: 100%; border: 0; }
  code { background: #eceef0; padding: 2px 6px; border-radius: 6px; }
</style>
