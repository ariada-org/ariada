# Ariada SWC Wrapper

This is a JavaScript-side SWC pipeline wrapper, not a native Rust-to-Wasm SWC
plugin. Native SWC plugins cannot call the JavaScript Ariada engine directly, so
the wrapper runs `@swc/core` through an injected `transformSync` function and
then passes source-visible JSX markup to the shared Ariada scanner.

```ts
import { transformSync } from '@swc/core';
import { transformWithAriada } from '@ariada-org/swc-plugin';

transformWithAriada(source, { transformSync, scanner: ariadaJsxScanner });
```

Use output-stage build plugins when you need rendered HTML fidelity.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
