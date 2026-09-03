# Ariada esbuild Plugin

Runs Ariada after an esbuild build and reports findings through esbuild
warnings or errors. The plugin is a thin adapter: pass a scanner implementation
from the Ariada CLI or engine layer and the plugin handles esbuild lifecycle and
diagnostic formatting.

```ts
import { ariadaEsbuild } from '@ariada-org/esbuild-plugin';

export default {
  plugins: [ariadaEsbuild({ outdir: 'dist', failOn: 'serious' })],
};
```

The default scanner is intentionally empty for package-level tests. Production
configuration should inject the shared Ariada scanner or CLI runner rather than
copying rule logic into this package.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
