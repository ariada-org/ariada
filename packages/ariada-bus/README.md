# @ariada-org/bus

`@ariada-org/bus` contains typed check/fix primitives for byte-stable facts.
A source fact renders into one or more targets, and the caller chooses whether
to only check drift or produce stable writes.

The package is deliberately small. It does not provide a database, queue,
service, or message bus. Those belong to later orchestration layers once a
concrete event source needs them.

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

`check` mode reports drift without writes. `fix` mode returns stable writes;
applying them and running the same reconciliation again should produce no
further writes.

The first additional fact class is `live-deploy-drift`, which compares current
build bytes with rendered live bytes and emits a fact only when their hashes
differ.
