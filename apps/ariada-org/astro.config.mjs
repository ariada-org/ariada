// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/*
 * ariada.org — OSS Commons publisher for @ariada-org/* rule packs.
 *
 * Static build for Cloudflare Pages. ZERO JavaScript at runtime
 * (opensource minimalism principle — see CLAUDE.md design directive
 * 2026-05-15). HTML+CSS only, system fonts, no client-side hydration,
 * no analytics, no tracking.
 */
export default defineConfig({
  site: "https://ariada.org",
  output: "static",
  integrations: [
    sitemap({
      changefreq: "monthly",
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  trailingSlash: "never",
  build: {
    assets: "_assets",
    inlineStylesheets: "always",
  },
  compressHTML: true,
});
