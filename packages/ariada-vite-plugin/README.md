# Ariada Vite Plugin

`@ariada-org/vite-plugin` scans Vite production HTML output and can also include
the development `index.html` transform surface in the same report.

## Install

```bash
pnpm add -D @ariada-org/vite-plugin
```

Root workspace integration still needs a lockfile update before publish:

```bash
pnpm install
pnpm --filter @ariada-org/vite-plugin build
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import ariada from '@ariada-org/vite-plugin';

export default defineConfig({
  plugins: [
    ariada({
      reportFile: 'ariada-vite-report.json',
      failOn: 'serious',
      scanDevHtml: true,
    }),
  ],
});
```

`failOn: false` writes the report without failing the build. The default threshold
is `serious`.

The package exposes an injectable scanner option so the static first-pass checks
can be replaced by the full Ariada engine without changing Vite plugin callers.
