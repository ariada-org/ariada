# @ariada-org/lighthouse-plugin

Adds Ariada conformance and high-impact audits to Lighthouse. Supply existing scan output through a provider or `ARIADA_LIGHTHOUSE_SCAN_OUTPUT`.

```ts
import plugin, { configureAriadaScanOutput } from '@ariada-org/lighthouse-plugin';

configureAriadaScanOutput({ report });
// Add `plugin` to the Lighthouse configuration's plugins list.
```
