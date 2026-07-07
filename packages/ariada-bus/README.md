# @ariada-org/bus

`@ariada-org/bus` contains typed check/fix primitives for byte-stable facts.
The first target is a simple reconciler: a source fact renders into one or more
targets, and the caller chooses whether to only check drift or produce writes.

The package is deliberately small. It does not provide a database, queue, or
message bus; those belong to later orchestration layers once a concrete event
source needs them.

```ts
import { reconcileTargets } from '@ariada-org/bus';

const result = reconcileTargets(
  { version: '0.1.0' },
  [
    {
      id: 'readme-version',
      path: 'README.md',
      current: 'version: old\n',
      render: (source) => `version: ${source.version}\n`,
    },
  ],
  { mode: 'fix' },
);
```

`check` mode reports drift without writes. `fix` mode returns the exact bytes
that should be written by the caller.
