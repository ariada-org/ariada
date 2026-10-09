# @ariada-org/clamper

Deterministically validates Ariada's public module catalog, public text, and robots.txt policy.

```ts
import { evaluateClamperProfile } from '@ariada-org/clamper';

const decision = evaluateClamperProfile('public-module-catalog', catalog);
if (decision.result === 'fail') {
  console.error(decision.findings);
}
```
