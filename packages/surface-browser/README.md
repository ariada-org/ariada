<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `@ariada-org/surface-browser`

In-browser surface adapter for `@ariada-org/core-engine`. Ships three entry
points for running a multi-domain compliance scan directly inside a browser
context: a bookmarklet entry, a DevTools panel entry, and an importable ES
module.

License: EUPL-1.2 (European Union Public Licence v1.2).

## Install

```bash
npm install @ariada-org/surface-browser
```

## Entry points

- **Bookmarklet** (`dist/bookmarklet-entry.js`) — run a scan of the current tab
  from a browser bookmark.
- **DevTools panel** (`dist/devtools-entry.js`) — the panel entry referenced by
  the extension's `src/panel.html`.
- **ES module** (`import from '@ariada-org/surface-browser'`) — embed the scan
  surface in your own page or tooling.

## Usage

```ts
import { scan } from '@ariada-org/surface-browser';

const report = await scan(document);
```

The adapter ships a first-party guard that blocks cross-origin analyzer
injection, so the scan surface only runs against the page that hosts it.

## Documentation

<https://github.com/ariada-org/ariada/tree/main/packages/surface-browser>.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
