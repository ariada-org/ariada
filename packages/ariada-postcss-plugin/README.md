# Ariada PostCSS Plugin

PostCSS 8 adapter for Ariada CSS-domain accessibility checks. It emits findings
through `result.warn()` so existing CSS pipelines and CI logs show the same
diagnostics as other PostCSS plugins.

```js
import { ariadaPostcss } from '@ariada-org/postcss-plugin';

export default {
  plugins: [ariadaPostcss({ scanner: ariadaCssScanner })],
};
```

The plugin does not implement CSS accessibility rules locally. The `scanner`
option is where the shared Ariada CSS scanner is connected.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
