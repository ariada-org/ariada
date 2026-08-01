# @ariada-org/axe-ruleset

Adapts Ariada's existing WCAG rules and checks into an axe-core configuration payload.

```ts
import axe from 'axe-core';
import { registerAriadaRules } from '@ariada-org/axe-ruleset';

registerAriadaRules(axe);
const results = await axe.run();
```
