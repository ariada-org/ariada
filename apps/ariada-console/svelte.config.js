import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Static SPA: one index.html fallback, deployed to Cloudflare Pages
    // (app.ariada.org). No server runtime; the scan/report/plugin API is a
    // separate origin wired later.
    adapter: adapter({ fallback: 'index.html', strict: false }),
  },
};

export default config;
