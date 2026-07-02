# Ariada Astro Integration

`@ariada-org/astro` scans built Astro HTML in the `astro:build:done` hook and
writes an Ariada report into the build directory.

## Install

```bash
pnpm add -D @ariada-org/astro
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

The integration ships a static HTML scanner with an injectable scanner option, so
the built-in checks can be replaced with a custom scanner without changing how the
integration is configured.
