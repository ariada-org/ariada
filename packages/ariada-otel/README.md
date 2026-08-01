# @ariada-org/otel

Records metrics and a span from an existing Ariada CLI JSON result. It does not run a scan or configure an OpenTelemetry SDK.

```ts
import { recordAriadaScan } from '@ariada-org/otel';

recordAriadaScan(scanJson, meter, tracer);
```
