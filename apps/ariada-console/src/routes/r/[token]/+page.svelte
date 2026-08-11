<script lang="ts">
  // Public, tokenised report viewer. Outside the demo gate (see +layout). The
  // token is unguessable; the page is noindex + intended to carry a TTL/revoke
  // check once the report API is wired. For now it frames the corporate-skin
  // report (report engine) for the given token.
  import { page } from '$app/state';
  const token = $derived(page.params.token);
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
  <title>Ariada accessibility report</title>
</svelte:head>

<main class="report">
  <header>
    <span class="brand">Ariada</span>
    <span class="muted">accessibility report</span>
  </header>
  <div class="body">
    <p class="muted">Report <code>{token}</code></p>
    <!-- The rendered corporate-skin report is embedded here once the report API
         resolves the token → artefact. Placeholder until M1 wiring. -->
    <div class="frame" role="note">
      Report content loads here (corporate-skin render from the report engine).
      This link is unguessable, not indexed, and expires.
    </div>
  </div>
</main>

<style>
  .report { max-width: 900px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
  header { display: flex; gap: 10px; align-items: baseline; border-bottom: 1px solid rgba(0,0,0,.12); padding-bottom: 12px; }
  .brand { font-weight: 700; }
  .muted { color: #767676; }
  .frame { margin-top: 20px; padding: 40px; border: 1px dashed rgba(0,0,0,.2); border-radius: 12px; color: #595959; }
  code { background: #eceef0; padding: 2px 7px; border-radius: 6px; }
</style>
