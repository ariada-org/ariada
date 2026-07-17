<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Nextra

Thin Nextra docs integration for Ariada. It does not implement scanning or rule
logic. It serves the exported Nextra/Next.js `out/` directory on loopback and
delegates the scan to the shared `@ariada-org/cli`.

Official contract checked during implementation:

- Nextra docs setup installs `next`, `react`, `react-dom`, `nextra`, and
  `nextra-theme-docs`, then exports a Next config through `nextra()`.
  Source: https://nextra.site/docs/docs-theme/start
- Nextra static export uses Next.js `output: 'export'`, requires unoptimized
  images for export, and stores the static export in `out` by default.
  Source: https://nextra.site/docs/guide/static-exports
- Next.js static export emits HTML/CSS/JS files from `next build` into `out`.
  Source: https://nextjs.org/docs/app/guides/static-exports
- Existing Ariada Next.js configuration reuse lives in
  `@ariada-org/nextjs-plugin`; this package only adds Nextra-specific docs glue
  and a post-build CLI wrapper.

## Next config

```js
import nextra from 'nextra';
import { withAriadaNextra } from 'nextra-ariada';

const withNextra = nextra({});

export default withNextra(
  withAriadaNextra({
    // normal Next.js config
  }),
);
```

For projects already using `@ariada-org/nextjs-plugin`, keep that wrapper in
place. `nextra-ariada` exists for the Nextra-specific static export recipe and
post-build scan command.

## Post-build scan

```json
{
  "scripts": {
    "build": "next build",
    "postbuild": "nextra-ariada scan out --output-dir scan-evidence/ariada-output"
  }
}
```

The wrapper:

1. Verifies `out/index.html` exists.
2. Serves `out/` on `127.0.0.1`.
3. Runs `ariada scan <local-url> --domains accessibility --format both`.
4. Writes `command.log` and `command.exit` beside the Ariada JSON output.
5. Returns the Ariada CLI exit code, unless `--no-fail` is used for advisory mode.

## Minimal fixture

`fixtures/minimal-nextra` is a small Nextra 4 docs site with one MDX page and an
intentional `<img>` without accessible text. It is used for local host e2e when
Next/Nextra dependencies are installed.

## Human gates

Publishing needs package registry credentials. Scanning authenticated or hosted
Nextra docs requires the project owner to provide the deployed URL/session. Local
static export evidence is complete for the representative unauthenticated docs
surface.
