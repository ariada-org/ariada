# Ariada Vite Plugin

`@ariada-org/vite-plugin` scans Vite production HTML output and can also include
the development `index.html` transform surface in the same report.

## Install

```bash
pnpm add -D @ariada-org/vite-plugin
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

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
