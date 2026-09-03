# @ariada-org/extension-chrome

> Click the icon. Dracula flies over the page pointing at accessibility violations.
> Local scan. 0 bytes leave your browser unless you hit "Share scorecard".

Chrome Manifest V3 extension that consumes [`@ariada-org/core-engine`](../core-engine)

+ [`@ariada-org/core-browser`](../core-browser) and draws the results on the page
through the shared overlay.

## Quick start

```bash
# from monorepo root
pnpm install
pnpm -F @ariada-org/extension-chrome build
# load the unpacked extension:
# Chrome → chrome://extensions → Developer mode ON → "Load unpacked" →
# select packages/extension-chrome/.output/chrome-mv3
```

See [`LOAD_INSTRUCTIONS.md`](./LOAD_INSTRUCTIONS.md) for the full hand-off path
the user follows.

## Architecture

```
[ icon click ] ── chrome.action ──▶ popup
   │
   ▼
popup ──"start_scan"──▶ background ──"start_scan"──▶ content
                            │                            │
                            │◀──── ScanEvent stream ─────│
                            │                            ▼
                            │              ┌───────────────────────────┐
                            │              │ Shadow-DOM Dracula overlay │
                            │              │ animates through bbox      │
                            │              │ coords of violations       │
                            │              └───────────────────────────┘
                            ▼
                      chrome.storage.local
                      (last-N scans)
```

Three contexts (per ADR-002):

| Context             | Runtime          | Imports                                     |
|---------------------|------------------|---------------------------------------------|
| Content script      | host page (MV3)  | `@ariada-org/core-engine`, `@ariada-org/core-browser`, `@ariada-org/dracula-agent`, `axe-core` |
| Popup (React 19)    | extension page   | none of the scanner — only messaging        |
| Background SW       | service worker   | none — message router + chrome.storage      |
| DevTools panel      | extension page   | none — message router; polls last scan       |

## Patent bindings

| Module                              | Binding                  |
|-------------------------------------|--------------------------|
| `src/scanner/runScan.ts`            | `J/IC1`, `J/IC3`         |
| `src/overlay/DraculaOverlay.tsx`    | `K/IC1`, `K/IC2`         |
| `src/overlay/inject.ts`             | `K/IC4`                  |

## Privacy

+ All scans run **inside your browser**. No URL, DOM snapshot, or violation
  payload ever leaves the device.
+ The optional **Share scorecard** button is the only network egress; default OFF.
+ No analytics, no telemetry, no remote scripts.

## Development

```bash
pnpm -F @ariada-org/extension-chrome dev          # WXT dev mode (auto-loads Chrome)
pnpm -F @ariada-org/extension-chrome typecheck
pnpm -F @ariada-org/extension-chrome test
pnpm -F @ariada-org/extension-chrome size         # bundle-size budget check
pnpm -F @ariada-org/extension-chrome a11y:ci      # cobbler's-shoes axe scan of popup
```

## License

Apache-2.0 — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
