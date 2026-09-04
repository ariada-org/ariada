# Histoire and Ladle Ariada integration

Production headless story checks for the Vite-native Storybook alternatives
Histoire and Ladle. The package discovers rendered stories, invokes the existing
Ariada CLI for every story, preserves each raw `cli-scan.v1` artifact, and writes
one threshold-aware report. It does not contain scanner, axe, AX-tree, or
shadow-DOM traversal logic.

## Install

```bash
npm install --save-dev @ariada-integrations/storybook-alt-ariada
```

The runtime package bundles the exact Ariada scanner closure. Histoire and Ladle
are optional peers because component libraries already own their selected story
tool and framework versions.

## Ladle setup

Copy `templates/ladle/config.mjs` to `.ladle/config.mjs`. Ladle exposes its
official story inventory in `meta.json`; the runner consumes that inventory and
uses each `?story=<id>&mode=preview` route so the rendered component, not the
Ladle shell, is the scan root. The built fixture uses Ladle's official
`data-storyloaded` marker as a readiness gate.

```bash
npx ladle build
ariada-stories --platform ladle --static-dir build --fail-on serious
```

The bundled Ladle a11y addon is disabled in the template to avoid two competing
gates. Ariada remains the sole CI result.

## Histoire setup

Copy the files under `templates/histoire/`. Merge the supplied Vue plugin into
an existing `vite.config.ts` if the project does not already have it.
`histoire-setup.ts` marks a preview
ready after rendering and notifies the same-origin parent. `ariada.histoire.json`
is an explicit reviewed list of story and variant routes; this avoids coupling
CI to Histoire's internal serialized build modules.

```bash
npx histoire build
ariada-stories \
  --platform histoire \
  --static-dir build \
  --manifest ariada.histoire.json \
  --fail-on serious
```

For each Histoire variant, use
`/__sandbox.html?storyId=<story-id>&variantId=<variant-id>` in the manifest.
This is Histoire's direct rendered-preview route, so the scanner audits the
component rather than the surrounding Histoire UI.

## Headless CI runner

`--static-dir` is the preferred CI contract. The package starts an ephemeral
loopback-only server, injects a non-visible load hold, waits for Ladle or
Histoire readiness, and only then lets the existing Ariada browser scan proceed.
The server is always closed in `finally`.

An already-running trusted preview can be scanned with `--base-url` instead.
Dynamic readiness is then the preview owner's responsibility.

```bash
ariada-stories \
  --platform ladle \
  --base-url http://127.0.0.1:61000 \
  --report-dir .ariada/stories \
  --timeout-ms 30000 \
  --fail-on serious
```

Exit `0` means the configured gate passed, exit `1` means findings met the
threshold, and exit `2` means configuration, discovery, readiness, scanner, or
report validation failed. `--fail-on none` records findings without blocking.

## Reports and evidence

The consolidated artifact is
`.ariada/storybook-alt/storybook-alt-ariada-report.json`. Raw reports are under
`.ariada/storybook-alt/raw/<story>/scan.json`. Every accepted raw report must
match the CLI schema and URL, agree with the process exit, include the `a11y`
analyzer, and contain a non-empty Chromium AX tree.

The included Ladle and Histoire fixtures render the same known-bad custom element
with insufficient text contrast inside an open shadow root. Packed acceptance
requires the real `color-contrast` finding with a shadow descendant selector,
a non-empty Chromium AX tree, a passing critical threshold, and a failing
serious threshold.

## Browser policy

No browser is downloaded by install, package, or test hooks. Browser acceptance
requires an already-provisioned cache:

```bash
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228
npm run check
```

## Maintainer gates

```bash
npm ci --ignore-scripts
npm run source-clean
npm run check:static
npm run package
npm run test:packed:offline
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:packed
```

Publication is intentionally outside these commands. Registry credentials and a
provenance-capable release job remain release-owner inputs.
