# Ariada Astro Integration

`@ariada-org/astro` scans built Astro HTML in the `astro:build:done` hook and
writes an Ariada report into the build directory.

## Install

```bash
pnpm add -D @ariada-org/astro
```

Root workspace integration still needs a lockfile update before publish:

```bash
pnpm install
pnpm --filter @ariada-org/astro build
```

## Usage

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import ariada from '@ariada-org/astro';

export default defineConfig({
  integrations: [
    ariada({
      outputFile: 'ariada-report.json',
      textOutputFile: 'ariada-report.txt',
      failOn: 'serious',
    }),
  ],
});
```

`failOn: false` writes the report without failing the build. The default threshold
is `serious`.

The first release ships a static HTML scanner with an injectable scanner option.
That option is the handoff point for dogfooding the full Ariada engine in
`ariada.org` after the root workspace accepts the new package lock entries.
