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
