# @ariada-org/core

A web-accessibility scanner that visits a page once and lets every domain read
that single pass: one traversal, a plugin per domain, an event per element, and a
detector that sees across domains rather than inside one. It drives the
element-by-element stream that a visualiser consumes over server-sent events.

## Install

```sh
pnpm add @ariada-org/core @ariada-org/rules-axe playwright
pnpm exec playwright install chromium
```

## Quickstart (programmatic)

```ts
import { scan } from '@ariada-org/core';

const { report } = await scan('https://example.com');
console.log(report.findings, report.stats);
```

## Element-iteration mode (Dracula / SSE consumers)

```ts
import { scan, createEventEmitter } from '@ariada-org/core';

const emitter = createEventEmitter();
emitter.on((ev) => console.log(ev.kind, ev));

const { report } = await scan('https://example.com', {
  elementIter: true,
  emitter,
});
```

The emitter emits `scan_started` → N × `element_scan` → `scan_complete` (or `scan_error`).
The `ScanEvent` shape is locked — see `src/events.ts` for the definition every consumer reads.

## Public API

| Export                   | Purpose                                                           |
|--------------------------|-------------------------------------------------------------------|
| `scan(url, opts)`        | One-shot scan; returns `ScanResult { report, events? }`           |
| `createScanner(opts)`    | Reusable scanner bound to a set of analyzers                      |
| `createRegistry()`       | Analyzer plugin registry (`{ register, get, all }`)               |
| `registerAnalyzer(a)`    | Register an analyzer on the module-default registry               |
| `createEventEmitter()`   | `ScanEventEmitter` factory (required for `elementIter: true`)     |
| `scoreFromCounts(c)`     | Pure helper — locked scoring formula                              |
| `fingerprint({ruleId,selector})` | Stable short hash (stub; TODO full murmurhash3)           |
| `ScanEvent`              | Locked event union consumed by SSE downstreams                    |
| `DomainAnalyzer`         | Plugin interface                                                  |
| `UnifiedSnapshot`, `UnifiedReport`, `Finding`, `ConflictFinding`  | Core types |

## Options

```ts
interface ScanOptions {
  domains?: Domain[];                  // default ['a11y']
  ai?: 'off' | 'opt-in' | 'full';      // default 'off' (P1 only)
  elementIter?: boolean;               // default false
  emitter?: ScanEventEmitter;          // required when elementIter=true
  timeoutMs?: number;                  // per-URL default 30000
  playwright?: { browser?: 'chromium' | 'firefox' | 'webkit'; headless?: boolean };
  analyzers?: DomainAnalyzer[];        // default: bundled a11y
  logger?: pino.Logger;
}
```

## Where each piece lives

- `scanner.ts`, `snapshot.ts` — the single pass over the page, and the snapshot it takes
- `cross-domain.ts`           — findings that only appear when two domains are read together
- `element-iter.ts`           — the per-element walk and the events it emits
- `registry.ts`               — the plugin registry a domain analyser registers with
- `fingerprint.ts`            — a stable identity for an element (a stub; full hashing is still to come)

## Licence

Apache-2.0. See repository `LICENSE` + this package `NOTICE` for patent notice.

## Update

- Author: Alekszandr Bricskin (Agonist Development AB)
- Date: 2026-04-19
