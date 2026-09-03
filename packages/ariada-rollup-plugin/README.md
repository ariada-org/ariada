# Ariada Rollup Plugin

Scans Rollup HTML assets during `writeBundle` and emits Ariada findings through
Rollup warnings, or errors when `failOn` is configured.

```js
import { ariadaRollup } from '@ariada-org/rollup-plugin';

export default {
  plugins: [ariadaRollup({ failOn: 'serious' })],
};
```

This package is only the Rollup adapter. Keep the scanner implementation in the
shared Ariada engine or CLI layer and pass it through the `scanner` option.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
