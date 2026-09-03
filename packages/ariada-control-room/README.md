# @ariada-org/control-room

Pure view engine for the internal Control Room panel.

The package is intentionally small: it does not read files, run a service, or make network
calls. Callers read the `.ariada/control-room-snapshot.json` file produced by
`scripts/control-room-snapshot.mjs` (bus catalog, self-regulating loop facts, cron state,
channel/package inventory, product-surface build state) and pass the parsed JSON in; this
package only derives a rendered view — a set of lamp-scored tiles — from that data.

## API

```ts
import { deriveControlRoomView } from '@ariada-org/control-room';

const view = deriveControlRoomView(snapshot);
// view.bus.status, view.loop.status, view.cron[].status, view.overall — each 'ok' | 'warn' | 'fail' | 'unknown'
```

Missing or malformed input always renders `'unknown'`, never a fabricated `'ok'` — a tile's
lamp is driven only by a real signal in the snapshot, never inferred from absence.

## Consuming app

The `@ariada-org/ariada-admin` app renders this view as the Control Room screen.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
