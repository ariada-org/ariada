# @ariada-org/core-browser

In-browser DOM adapter for [`@ariada-org/core-engine`](../core-engine). Powers the
ariada Chrome extension and any other browser-context consumer that needs to
run a scan without Node, Playwright, or pino in the bundle.

| Field           | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| Package name    | `@ariada-org/core-browser`                                    |
| Version         | 0.1.0                                                         |
| Licence         | EUPL-1.2 (European Union Public Licence)                      |
| Runtime         | Browser only (ES2022, no Node API surface)                    |
| Dependencies    | `@ariada-org/core-engine` (workspace)                         |
| Bundle size     | ≤ 50 KB minified (esbuild target, verified via `bundle:size`) |
| REUSE-compliant | yes — `REUSE.toml` + per-file SPDX headers                    |

## Public API (v0.1)

```ts
import {
  captureBrowserSnapshot,
  scanCurrentDocument,
  createDomBoundingBoxResolver,
} from "@ariada-org/core-browser";
```

- `captureBrowserSnapshot(opts)` — read a `UnifiedSnapshot` from a live
  `Document`. Optionally pulls the full AX tree via a `chrome.debugger`
  shim (extension context only).
- `scanCurrentDocument(opts?)` — run the engine orchestration end-to-end
  against the current document. Drop-in equivalent of
  [`@ariada-org/core-playwright`](../core-playwright)'s `scan()` but for
  browser context. Returns a `Promise<UnifiedReport>`.
- `createDomBoundingBoxResolver(document)` — element-iter resolver that wraps
  `Element.getBoundingClientRect`.

## Usage — Chrome extension content script

```ts
// content-script.ts
import { scanCurrentDocument } from "@ariada-org/core-browser";

chrome.runtime.onMessage.addListener(async (msg, _sender, send) => {
  if (msg.type !== "ARIADA_SCAN_REQUEST") return;
  // `scanCurrentDocument` returns a `ScanResult` (engine type) — pull
  // `.report` for the `UnifiedReport`. Pass `analyzers` (engine
  // `DomainAnalyzer[]`); the package adds no domain-name shorthand on top.
  const result = await scanCurrentDocument({ document, analyzers: [] });
  send({ type: "ARIADA_SCAN_RESULT", report: result.report });
  return true; // async
});
```

## Usage — generic in-browser embed

```ts
import {
  captureBrowserSnapshot,
  scanCurrentDocument,
} from "@ariada-org/core-browser";

// Snapshot-only capture (no engine orchestration). `scanId` is required.
const snapshot = await captureBrowserSnapshot({ document, scanId: "my-scan" });

// Or full scan end-to-end. Returns a `ScanResult`; `.report` is the
// `UnifiedReport`. Pass engine `DomainAnalyzer[]` as `analyzers` (this
// package adds no domain-name shorthand on top of the engine API).
const { report } = await scanCurrentDocument({ document, analyzers: [] });
```

## Bundle-size discipline

The package ships **only** ES2022 modules; the public bundle target is
≤ 50 KB minified, verified via `pnpm --filter @ariada-org/core-browser bundle:size`
and recorded in the engine-split `BUILD_REPORT`. The size budget is enforced
because the Chrome extension content-script must stay under the MV3 (Manifest
V3) inline-script size limit for fast injection. Avoid pulling Node-only
modules — there is no polyfill layer.

## Testing

Unit tests run with vitest + happy-dom:

```bash
pnpm --filter @ariada-org/core-browser test
```

## Layout

```
src/
  index.ts            — public exports
  browser-runner.ts   — scanCurrentDocument()
  dom-snapshot.ts     — captureBrowserSnapshot()
  bbox-resolver.ts    — createDomBoundingBoxResolver()
tests/
  *.test.ts           — vitest + happy-dom
```

## Licence

EUPL-1.2 — see `LICENSE`. Per-file SPDX headers + `REUSE.toml` keep
machine-readable metadata in sync. Trademarks not granted; see `TRADEMARK.md`.

## Security

Vulnerability reports → `https://github.com/ariada-org/ariada/security/advisories/new`
or `security@ariada.org`. See `SECURITY.md`.
