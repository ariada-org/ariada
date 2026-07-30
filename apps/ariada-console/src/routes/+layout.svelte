<script lang="ts">
  // The shared theme tokens for @ariada-org/admin-svelte (plain CSS custom
  // properties — no Tailwind, no AntD).
  import '@ariada-org/admin-svelte/tokens.css';
  import './app.css';
  import { page } from '$app/state';

  let { children } = $props();

  // Token report links (/r/<token>) and the subject viewer are intentionally
  // outside the demo gate — a report recipient (e.g. a Taler maintainer) opens
  // it without signing in.
  const isPublicRoute = $derived(
    page.url.pathname.startsWith('/r/') || page.url.pathname.startsWith('/subject'),
  );

  // Demo access gate (demo/demo). This is a convenience gate for the public OSS
  // demo, NOT a security boundary — the real deployment sits behind Cloudflare
  // Access. Token report links (/r/<token>) are intentionally outside this gate.
  let authed = $state(
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ariada-demo') === '1',
  );
  let user = $state('');
  let pass = $state('');
  let error = $state('');

  function login(e: Event) {
    e.preventDefault();
    if (user === 'demo' && pass === 'demo') {
      authed = true;
      sessionStorage.setItem('ariada-demo', '1');
      error = '';
    } else {
      error = 'Use demo / demo for the public demo.';
    }
  }
</script>

{#if isPublicRoute}
  {@render children()}
{:else if !authed}
  <main class="gate">
    <form onsubmit={login} aria-labelledby="gate-h">
      <h1 id="gate-h">Ariada — accessibility audit console</h1>
      <p>Public demo. Sign in with <strong>demo</strong> / <strong>demo</strong>.</p>
      <label>User<input bind:value={user} autocomplete="username" /></label>
      <label>Password<input type="password" bind:value={pass} autocomplete="current-password" /></label>
      {#if error}<p class="err" role="alert">{error}</p>{/if}
      <button type="submit">Enter</button>
    </form>
  </main>
{:else}
  <div class="shell">
    <header class="topbar">
      <span class="brand">Ariada</span>
      <span class="muted">accessibility audit console</span>
    </header>
    <div class="body">{@render children()}</div>
  </div>
{/if}
