# Ariada Webpack Plugin

Runs Ariada over emitted Webpack HTML assets after emit and reports findings via
`compilation.warnings` or `compilation.errors`.

```js
import AriadaWebpackPlugin from '@ariada-org/webpack-plugin';

export default {
  plugins: [new AriadaWebpackPlugin({ failOn: 'serious' })],
};
```

This package is a lifecycle adapter. It does not contain scanner rules; inject
the shared Ariada scanner or CLI runner through `scanner`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
