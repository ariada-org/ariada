# @ariada-org/wdio-ariada-service

WebdriverIO runner service that scans after tests or selected commands and writes canonical Ariada reports.

```ts
import AriadaService from '@ariada-org/wdio-ariada-service';

export const config = {
  services: [[AriadaService, { scanAfterTest: true, failOnViolation: true }]],
};
```
