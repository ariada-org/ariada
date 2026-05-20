# @ariada/core-playwright

Node + Playwright adapter for [`@ariada/core-engine`](../core-engine). The
canonical Node entry point used by `clamper`, `blamer`, `reverter`, and any
other CI-gate consumer that needs to scan a URL from a Node process.

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Package name   | `@ariada/core-playwright`                                             |
| Version        | 0.1.0                                                                 |
| Licence        | EUPL-1.2 (European Union Public Licence)                              |
| Runtime        | Node `>= 22`                                                          |
| Dependencies   | `@ariada/core-engine`, `playwright`, `pino`, `ulid`                   |
| Peer deps      | `playwright >= 1.49`                                                  |
| REUSE-compliant | yes — `REUSE.toml` + per-file SPDX headers                           |

## Public API (v0.1)

```ts
import {
  scan,
  createScanner,
  launchBrowser,
  captureSnapshot,
  createPlaywrightBoundingBoxResolver,
  createLogger,
} from '@ariada/core-playwright';

const report = await scan('https://example.com', {
  domains: ['a11y'],
  ai: 'off',
});
```

- `scan(url, opts?)` — single-call entry point: launches Playwright, navigates
  to `url`, captures a `UnifiedSnapshot`, runs `runOrchestration`, returns
  the `UnifiedReport`. Closes the browser on exit.
- `createScanner(defaults)` — factory for a reusable `Scanner` instance with
  fixed defaults (good for batch CLI runs).
- `launchBrowser(name, headless)` — Playwright browser launch helper.
- `captureSnapshot(page, opts?)` — `UnifiedSnapshot` capture via CDP
  (Chrome DevTools Protocol).
- `createPlaywrightBoundingBoxResolver(page)` — `BoundingBoxResolver` impl
  for the engine's element iterator.
- `createLogger()` — `pino` logger configured for ariada's log levels.

## Usage — CLI / CI gate

```ts
// scripts/scan.mts
import { scan } from '@ariada/core-playwright';

const url = process.argv[2];
if (!url) {
  console.error('Usage: scan <url>');
  process.exit(2);
}

const result = await scan(url, { domains: ['a11y'] });
console.log(JSON.stringify(result.report.stats, null, 2));
if (result.report.stats.totalViolations > 0) process.exit(1);
```

## Usage — reusable scanner (batch mode)

```ts
import { createScanner } from '@ariada/core-playwright';

const scanner = createScanner({
  ai: 'off',
  playwright: { browser: 'chromium', headless: true },
});

for (const url of urls) {
  const result = await scanner.scan(url);
  console.log(url, result.report.stats.totalViolations);
}
```

## Testing

Unit tests run with vitest; end-to-end tests (real Chromium via Playwright)
live behind `pnpm --filter @ariada/core-playwright test:e2e` (`playwright.config.ts`)
and require a working Playwright browser install (`pnpm exec playwright install chromium`).

## Layout

```
src/
  index.ts            — public exports
  scanner.ts          — scan() + createScanner()
  snapshot.ts         — captureSnapshot()
  cdp.ts              — CDP wiring
  bbox-resolver.ts    — Playwright BoundingBoxResolver
  logger.ts           — pino setup
tests/
  *.test.ts           — vitest unit tests
```

## Licence

EUPL-1.2 — see `LICENSE`. Per-file SPDX headers + `REUSE.toml` keep
machine-readable metadata in sync. Trademarks not granted; see `TRADEMARK.md`.

## Security

Vulnerability reports → `https://github.com/ariada-org/ariada/security/advisories/new`
or `security@ariada.org`. See `SECURITY.md`.
