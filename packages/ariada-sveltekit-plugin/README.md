<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada SvelteKit Plugin

SvelteKit adapter that delegates to `@ariada-org/vite-plugin` and defaults to
the SvelteKit static adapter `build/` output.

Official contract checked during implementation:

- SvelteKit projects are built with Vite and can use Vite plugins.
  Source: https://svelte.dev/docs/kit/integrations
- Vite plugins can use build lifecycle hooks.
  Source: https://vite.dev/guide/api-plugin

```ts
import { ariadaSvelteKit } from '@ariada-org/sveltekit-plugin';

export default {
  plugins: [ariadaSvelteKit()],
};
```
