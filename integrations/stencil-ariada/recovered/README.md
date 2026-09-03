# Stencil Ariada output target

`@ariada-integrations/stencil-ariada` is a Stencil `OutputTargetCustom` that scans
the rendered output of every selected component. It reads declared Stencil usage
examples, generates one loopback-only harness per component, and delegates rule
evaluation to the real Ariada CLI, core Playwright adapter, and rules-axe analyzer.
Open shadow roots are represented in both axe selectors and the captured Chromium
accessibility tree.

## Install

Node.js 22 or newer and an already provisioned Chromium binary are required.
The package never downloads a browser and has no install lifecycle script.

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --save-dev @ariada-integrations/stencil-ariada@0.1.0
```

The distributable bundles its exact Ariada, Stencil, axe, and Playwright runtime
closure. Consumers do not install unpublished Ariada registry packages.

## Stencil configuration

```ts
import type { Config } from '@stencil/core';
import { stencilAriada } from '@ariada-integrations/stencil-ariada';

export const config: Config = {
  namespace: 'designSystem',
  outputTargets: [
    { type: 'www', dir: 'www', serviceWorker: null },
    stencilAriada({
      reportDir: '.ariada/stencil',
      failOn: 'serious',
    }),
  ],
};
```

The target requires one Stencil `www` target because it audits browser-rendered
components, not source markup. If several `www` targets exist, set `wwwDir`.
`taskShouldRun` is `onBuildOnly`, so watch builds do not launch scanners.

Usage precedence is:

1. `usages[tag]` supplied to `stencilAriada()`.
2. HTML fences in Stencil `src/components/<tag>/usage/*.md` documentation.
3. A generated `<tag></tag>` harness.

`include` and `exclude` select component tags. All paths are constrained to the
Stencil root. Reports cannot overlap the served output.

## Reports and build gating

Each build writes:

- `.ariada/stencil/stencil-ariada-report.json`: consolidated report.
- `.ariada/stencil/components/<tag>.json`: per-component report.
- `.ariada/stencil/raw/<tag>/scan.json`: original Ariada CLI v1 report.

`failOn` accepts `critical`, `serious`, `moderate`, `minor`, or `false`. The raw
Ariada scan always uses the `minor` semantic threshold, verifies that process and
JSON exit codes agree, then the output target applies the configured build gate.
Reports are preserved before a failing Stencil build exits non-zero.

## Browser policy

Set `PLAYWRIGHT_BROWSERS_PATH` to a cache that already contains the Chromium
revision used by bundled Playwright `1.61.1`.

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 \
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
npm run check
```

No command in this package runs `playwright install` or downloads a browser.

## CLI

The package also exposes the same real scan contract for an already served page:

```bash
stencil-ariada scan-url http://127.0.0.1:4173/ \
  --report-dir .ariada/stencil-url \
  --fail-on serious
```

Exit codes are `0` for a passing threshold, `1` for findings at or above the
threshold, `2` for invalid arguments, and `3` for runtime failures.

## Development and release gates

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run source-clean
npm run lint
npm run typecheck
npm test
npm run build
npm run docs
npm run security
npm run package
npm run test:packed:offline
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:packed
```

`npm run package` packs twice, requires identical SHA-256 values and file
inventories, then writes the tarball, checksum, and dependency/file inventory to
`artifacts/`. `test:packed` installs that tarball offline into an empty npm cache
with `--ignore-scripts`, requires `npm ls` to pass, invokes both actual CLIs, and
runs the installed output target on the bad shadow-DOM fixture. It proves a
critical threshold passes, a serious threshold fails, and the raw Ariada report
has semantic exit `1`.

## Publication status

The package is publish-ready but is not claimed as published. Registry publication
requires the release owner's npm credentials and provenance-capable release job.

## License

EUPL-1.2. Bundled dependency licenses are listed in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
