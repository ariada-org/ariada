# Bit Ariada build task

`@ariada-integrations/bit-ariada` provides a native `@teambit/builder`
`BuildTask`. It runs once for each original seeder capsule, serves that
component's rendered output on ephemeral `127.0.0.1`, and delegates the scan to
the real Ariada CLI, core Playwright adapter, and rules-axe analyzer. It does not
implement accessibility rules or shadow-DOM traversal.

## Install

Node.js 22 or newer, Bit Builder `1.0.1056`, and an already provisioned Chromium
binary are required. Installation has no lifecycle hook and never downloads a
browser.

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --save-dev \
  @ariada-integrations/bit-ariada@0.1.0 @teambit/builder@1.0.1056
```

The tarball bundles the exact Ariada, axe, and Playwright runtime closure. Bit
Builder remains an optional exact peer because the Bit host provides it.

## Bit environment

Add the Ariada environment handler after the task that renders a static
component page. `Pipeline.from` invokes the handler to obtain the BuildTask:

```ts
import { Pipeline } from '@teambit/builder';
import { createAriadaTaskHandler } from '@ariada-integrations/bit-ariada';

build() {
  return Pipeline.from([
    // Existing compiler/bundler task that writes dist/index.html.
    createAriadaTaskHandler({
      rendered: { rootDir: 'dist', page: 'index.html' },
      reportDir: 'artifacts/ariada',
      failOn: 'serious',
    }),
  ]);
}
```

A complete environment snippet is in [`examples/bit-env.ts`](./examples/bit-env.ts).
Use `components` for id-specific output paths. Keys may be a full Bit id, the id
without a version, or the final component name.

```ts
createAriadaTaskHandler({
  components: {
    'acme.ui/card': { rootDir: 'public/card', page: 'index.html' },
  },
});
```

Run the normal Bit pipeline with `bit build --unmodified` in CI when every
component must be checked, including components not modified in the current
workspace operation. See Bit's official build-task documentation at
https://bit.dev/reference/build-pipeline/implement-build-task/.

## Reports and build gating

Each component capsule receives:

- `artifacts/ariada/bit-ariada-report.json`: normalized per-component report.
- `artifacts/ariada/raw/scan.json`: original Ariada CLI v1 report.
- `artifacts/ariada/bit-ariada-error.json`: fail-closed runtime evidence, only
  when a page or scan cannot be completed.

The task returns those paths as Bit component artifacts and summary metadata.
`failOn` accepts `critical`, `serious`, `moderate`, `minor`, or `false`. Ariada
always scans at `minor`, validates report/process semantics, writes evidence,
then returns a Bit component error when the configured threshold is reached.
That preserves reports while making `bit build`, `bit snap`, and `bit tag` fail.

The rendered output must be trusted project content. A custom element with an
open shadow root is scanned as browser-rendered output; the Ariada engine owns
axe selectors and Chromium accessibility-tree capture.

## Browser policy

Set `PLAYWRIGHT_BROWSERS_PATH` to a cache containing the Chromium revision used
by bundled Playwright `1.61.1`.

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 \
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
npm run check
```

No package command invokes `playwright install` or accepts browser-download
credentials.

## Development and release gates

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run source-clean
npm run check:static
npm run package
npm run test:packed:offline
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:packed
```

`test:bit-contract` checks the emitted task shape against the `BuildTask`
declaration inside the official `@teambit/builder@1.0.1056` tarball. The package
uses only type imports, so the host Bit process owns the Builder runtime and no
second Bit dependency graph is bundled. Unit tests exercise capsule-to-scanner
wiring and report parsing. The packed actual test installs into an empty offline cache,
invokes the installed task on a rendered shadow-root fixture, requires a serious
`color-contrast` finding, verifies AX-tree evidence, and proves critical-pass /
serious-fail threshold behavior.

`npm run package` packs twice, requires identical SHA-256 values and file
inventories, and writes the tarball, checksum, and complete dependency inventory
to `artifacts/`.

## Publication status

The integration is publish-ready but is not claimed as published. Publication to
bit.dev and npm requires owner credentials, provenance-capable release jobs, and
marketplace review outside this repository.

## License

EUPL-1.2. Bundled dependency licenses are recorded in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and the artifact inventory.
