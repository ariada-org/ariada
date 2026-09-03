# @ariada-org/bus

Typed reconciliation primitives for keeping derived files aligned with source facts.

The package is intentionally small: it does not run a service, open sockets, or store state
in a database. Callers provide a source fact, derived targets, and choose `check` or `fix`.

## API

```ts
import { applyReconcileWrites, reconcileTargets } from '@ariada-org/bus';

const source = { version: '0.1.0' };
const result = reconcileTargets(source, [
  {
    id: 'readme-version',
    path: 'README.md',
    current: 'version: old\n',
    render: (fact) => `version: ${fact.version}\n`,
  },
], { mode: 'fix' });

applyReconcileWrites(result.writes);
```

`check` mode reports drift without writes. `fix` mode returns stable writes; applying them
and running the same reconciliation again should produce no further writes.

The first additional fact class is `live-deploy-drift`, which compares current build bytes
with rendered live bytes and emits a fact only when their hashes differ.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
