import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // @ariada-org/admin-svelte ships Svelte source (not a built bundle) and is linked
  // via file:, so Vite must compile it rather than treat it as external.
  ssr: { noExternal: ['@ariada-org/admin-svelte'] },
});
