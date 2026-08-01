# @ariada-org/event-contracts

Typed Ariada product-event envelopes with runtime validation.

```ts
import { createProductEvent, eventSubject } from '@ariada-org/event-contracts';

const event = createProductEvent('scan.requested', {
  source: 'scanner',
  tenantId: 'tenant-1',
  correlationId: 'correlation-1',
  subject: eventSubject('scan.requested'),
  data: { scanId: 'scan-1', targets: ['https://example.com'] },
});
```
