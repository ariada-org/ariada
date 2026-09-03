# `@ariada-integrations/lit-ariada`

S234 integrates Lit component accessibility checks with `@web/test-runner`. It mounts a real Lit custom element, waits for `updateComplete`, verifies that an open shadow root rendered, and sends a server command that runs the real Ariada CLI against a stable fixture page. Ariada's core Playwright capture and rules-axe analyzer inspect the rendered shadow content; this package does not implement shadow traversal or accessibility rules.

## Requirements

- Node 22 or newer.
- A separately provisioned Playwright 1.60 Chromium cache.
- `PLAYWRIGHT_BROWSERS_PATH` pointing at that cache.
- Browser downloads disabled with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

## Install

The npm publication step is founder-controlled and has not been performed. From a packed artifact:

```sh
npm install --ignore-scripts ./ariada-integrations-lit-ariada-0.1.0.tgz
```

Source development does not query unpublished Ariada packages. Exact built Ariada artifacts are local npm workspaces; public development dependencies still come from npm.

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run verify
```

## Web Test Runner

Add the Node-side command to `web-test-runner.config.mjs`:

```js
import { playwrightLauncher } from '@web/test-runner-playwright';
import { createLitAriadaPlugin } from '@ariada-integrations/lit-ariada/web-test-runner';

export default {
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  plugins: [createLitAriadaPlugin({ severityThreshold: 'serious' })],
};
```

Keep the scanned fixture separate from the test module. The fixture must define and render the same custom element on page load; otherwise the scanner's second browser would not see test-only state.

```js
import { executeServerCommand } from '@web/test-runner-commands';
import { mountLitElement, scanMountedLitElement } from '@ariada-integrations/lit-ariada/browser';
import './adoption-card.js';

it('audits rendered shadow output', async () => {
  const element = await mountLitElement('adoption-card');
  try {
    await scanMountedLitElement(element, executeServerCommand, {
      fixtureUrl: new URL('/test/fixtures/adoption-card.html', location.origin).href,
      componentSelector: 'adoption-card',
      severityThreshold: 'serious',
    });
  } finally {
    element.remove();
  }
});
```

`scanMountedLitElement` fails the test on findings by default. Set `failOnFindings: false` to inspect `componentFindings` and `decision.exitCode` directly.

## CLI

```sh
lit-ariada http://127.0.0.1:8000/fixtures/card.html \
  --component adoption-card \
  --fail-on-severity serious \
  --output-dir .lit-ariada-output
```

Exit codes are semantic: `0` passes, `1` reports findings at or above the threshold, `2` is invalid input, and `3` is a scanner/runtime failure.

## Gates

```sh
npm run lint
npm run typecheck
npm test
npm run docs:check
npm run examples:check
npm run test:source-clean
npm run package:check
npm run security:check
PLAYWRIGHT_BROWSERS_PATH=/path/to/compatible/ms-playwright npm run test:actual
```

`package:check` performs two deterministic packs, rejects local protocols and non-exact root versions, installs into an empty-cache offline consumer with `--ignore-scripts`, runs `npm ls --all`, imports the real CLI/core/Playwright/rules-axe closure, and writes `artifacts/package-inventory.json`, `artifacts/SHA256SUMS`, and the tarball.

## Browser policy

No install script, CI job, example, or test downloads Chromium. `test:actual` exits with a clear browser blocker unless `PLAYWRIGHT_BROWSERS_PATH` names an already provisioned Playwright 1.60 cache.

The Senko CI gate uses the existing `adopta-s187-206-node:pw` image with Node 22 and its revision-1223 cache. It never pulls, builds, or modifies the image:

```sh
docker run --rm -v "$PWD:/work" -w /work \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
  --entrypoint sh adopta-s187-206-node:pw \
  -lc 'set -e; npm ci --ignore-scripts --no-audit --no-fund; npm run test:actual'
```

## Security

The WTR command accepts only credential-free loopback HTTP URLs, bounded timeouts, and custom-element tag selectors. See `SECURITY.md`.

## Publication status

The integration is publication-ready but is not claimed as published. npm registry credentials and the publish action remain a founder-controlled external blocker.

## Upstream references

- Lit shadow DOM: https://lit.dev/docs/components/shadow-dom/
- Lit lifecycle and `updateComplete`: https://lit.dev/docs/components/lifecycle/
- Web Test Runner custom commands: https://modern-web.dev/docs/test-runner/commands/
- Playwright browser caches: https://playwright.dev/docs/browsers

## Patent binding

None in this integration. It reuses the scanner's existing AX-tree and rules analyzer implementations and adds no claim-implementing traversal or reconciliation logic.
