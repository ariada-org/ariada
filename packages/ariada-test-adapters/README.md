<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `@ariada-org/test-adapters`

Accessibility-assertion adapters for the five most common JavaScript test frameworks: **Jest**, **Vitest**, **Mocha + Chai**, **Playwright**, and **Cypress**. Each entry registers a single idiomatic, framework-native assertion that scans the target via `@ariada-org/core-playwright` and the rule packs from `@ariada-org/wcag-rules-extended`.

License: EUPL-1.2 (European Union Public Licence v1.2).

## Status

`v0.1.0` — five framework entries are shipped. WebdriverIO, Karma, and Jasmine are tracked for a later release.

## Install

```bash
npm install --save-dev @ariada-org/test-adapters
# pnpm add -D @ariada-org/test-adapters
# yarn add --dev @ariada-org/test-adapters
```

The five framework runtimes (`@jest/globals`, `vitest`, `chai`, `@playwright/test`, `cypress`) are listed as **optional peer dependencies**. Install only the ones you use — npm will not warn about the others.

## Usage

### Jest

```ts
import "@ariada-org/test-adapters/jest";

test("home page is accessible", async () => {
  await expect("https://example.com").toBeAccessible();
});
```

### Vitest

```ts
import "@ariada-org/test-adapters/vitest";

test("home page is accessible", async () => {
  await expect("https://example.com").toBeAccessible();
});
```

### Mocha + Chai

```ts
import chai, { expect } from "chai";
import { ariadaChai } from "@ariada-org/test-adapters/mocha-chai";

chai.use(ariadaChai);

it("home page is accessible", async () => {
  await expect("https://example.com").to.be.accessible();
});
```

### Playwright

```ts
import { test as base } from "@playwright/test";
import { extendPlaywrightTest } from "@ariada-org/test-adapters/playwright";

const test = extendPlaywrightTest(base);

test("home page is accessible", async ({ page, a11y }) => {
  await page.goto("https://example.com");
  const result = await a11y.scan(page);
  await a11y.toBeAccessible(result);
});
```

### Cypress

```ts
// cypress/support/e2e.ts
import "@ariada-org/test-adapters/cypress";

// any spec
it("home page is accessible", () => {
  cy.visit("https://example.com").checkA11y();
});
```

## Options

Every assertion accepts an optional `ScanOptions` object:

| Option      | Default     | Description                                                             |
| ----------- | ----------- | ----------------------------------------------------------------------- |
| `severity`  | `'serious'` | Severity threshold (`minor` / `moderate` / `serious` / `critical`).     |
| `packs`     | all three   | Rule-pack subset (`banking` / `checkout` / `statement`).                |
| `timeoutMs` | `30000`     | Scan timeout in milliseconds (`0 < n <= 120000`).                       |
| `locale`    | `'en'`      | Message locale (`en` / `sv` / `de` / `fr` / `nl` / `fi` / `da` / `no`). |
| `exclude`   | `[]`        | CSS selectors to skip during the scan.                                  |

## Failure message format

Every adapter produces violation lines in the same shape so output is identical across the test pyramid:

```
WCAG 1.4.3 (color-contrast) [serious]: .price-label — contrast 2.1:1 below 4.5:1 threshold
```

## What this package is and is not

- **Is** a thin facade over the OSS scanner — no rules of its own, no browser-control logic of its own, no telemetry.
- **Is not** a CI runner — see `@ariada-org/cli` for one-shot scans suitable for GitHub Actions / GitLab CI / Jenkins.
- **Is not** a rule authoring API — see `@ariada-org/wcag-rules-extended` for that.

## Compliance context

The packs target WCAG 2.2 AA and EN 301 549 v3.2.1 — the technical baseline for the European Accessibility Act (Directive (EU) 2019/882) which becomes enforceable on 2025-06-28. Shifting accessibility assertions left into your existing test pyramid reduces post-merge remediation cost and gives you evidence trails for accessibility statements (DOS-lagen 2018:1937, BFSG, RGAA).

## License + maintenance

EUPL-1.2 — see `LICENSE` and `NOTICE`.

Maintained by Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726).
