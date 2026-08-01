# @ariada-org/selenium-ariada

Runs an Ariada-compatible scan through Selenium's CDP session, or through the Ariada CLI fallback.

```ts
import { ariadaScan } from '@ariada-org/selenium-ariada';

const result = await ariadaScan(driver, {
  severityThreshold: 'serious',
  failOnViolation: true,
});
```
