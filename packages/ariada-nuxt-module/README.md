<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Nuxt Module

Nuxt module that scans `.output/public` or `dist` after generated assets are
available. It reuses `@ariada-org/vite-plugin` static HTML scanning.

Official contract checked during implementation:

- Nuxt modules can register lifecycle hooks.
  Source: https://nuxt.com/docs/3.x/guide/modules/recipes-advanced
- `nitro:build:public-assets` runs after public assets are copied.
  Source: https://nuxt.com/docs/4.x/api/advanced/hooks

```ts
export default defineNuxtConfig({
  modules: ['@ariada-org/nuxt-module'],
  ariada: {
    failOn: 'serious',
  },
});
```
