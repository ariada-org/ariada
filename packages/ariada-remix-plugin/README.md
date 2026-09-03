<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Remix Plugin

Remix and React Router framework-mode adapter that delegates to
`@ariada-org/vite-plugin` and scans static client output.

Official contract checked during implementation:

- Remix uses a root `vite.config.ts` for its Vite plugin setup.
  Source: https://v2.remix.run/docs/guides/vite/
- React Router framework mode wraps Vite plugin support.
  Source: https://reactrouter.com/start/modes

```ts
import { ariadaRemix } from '@ariada-org/remix-plugin';

export default {
  plugins: [ariadaRemix()],
};
```

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
