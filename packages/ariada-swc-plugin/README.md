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
