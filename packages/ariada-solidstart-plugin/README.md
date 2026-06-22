<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada SolidStart Plugin

SolidStart adapter that delegates to `@ariada-org/vite-plugin` and scans
generated static output.

Official contract checked during implementation:

- SolidStart config supports Vite plugins.
  Source: https://docs.solidjs.com/solid-start/reference/config/define-config

```ts
import { ariadaSolidStart } from '@ariada-org/solidstart-plugin';

export default {
  plugins: [ariadaSolidStart()],
};
```
