# @ariada-org/playwright-ariada

Runs Ariada against a Playwright page and exposes a fixture, matcher, artifacts, and reporter.

```ts
import { expect, test } from '@ariada-org/playwright-ariada';

test('page has no blocking findings', async ({ page, ariada }) => {
  const result = await ariada.scan(page);
  expect(result).toHaveNoBlockingViolations();
});
```

Chromium can use the CDP accessibility tree; Firefox and WebKit use the DOM fallback recorded in `result.capabilities`.
