<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Next.js Plugin

Thin Next.js adapter that scans exported `out/` HTML or rendered `.next/server`
HTML after a build. It reuses `@ariada-org/vite-plugin` static HTML scanning and
does not implement accessibility rules itself.

Official contract checked during implementation:

- Next.js config is provided through `next.config.js`.
  Source: https://nextjs.org/docs/app/api-reference/config/next-config-js
- Next.js exposes a `webpack` config hook that wrapper plugins can preserve.
  Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack

```js
import { withAriada } from '@ariada-org/nextjs-plugin';

export default withAriada({
  output: 'export',
});
```

Run the scan after `next build` or `next export`:

```sh
node -e "import('@ariada-org/nextjs-plugin').then(m => m.scanNextOutput(process.cwd()))"
```

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
