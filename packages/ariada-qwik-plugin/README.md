<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Qwik Plugin

Qwik City adapter that delegates to `@ariada-org/vite-plugin` and scans static
build output.

Official contract checked during implementation:

- Qwik projects configure Vite through `vite.config`.
  Source: https://qwik.dev/docs/advanced/vite/

```ts
import { ariadaQwik } from '@ariada-org/qwik-plugin';

export default {
  plugins: [ariadaQwik()],
};
```

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
