# @ariada-org/cypress-ariada

Cypress custom command and Node task for running Ariada accessibility scans from Cypress suites.

```ts
// cypress.config.ts
import { defineConfig } from 'cypress';
import { setupAriadaNodeEvents } from '@ariada-org/cypress-ariada/plugin';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return setupAriadaNodeEvents(on, config);
    },
  },
});
```

```ts
// cypress/support/e2e.ts
import '@ariada-org/cypress-ariada';
```

```ts
cy.visit('/checkout');
cy.ariadaScan({ severityThreshold: 'serious' });
```

`cy.ariadaScan()` reads the current Cypress-controlled URL, calls the `ariada:scan` Node task, and fails the Cypress command when findings at or above the configured threshold are returned.

## Scanner Path

The package is a thin Cypress adapter. The Node task delegates to the shared `@ariada-org/cli` scanner and normalises its JSON output for Cypress assertions; it does not implement scanning rules.

Chromium runs use the Ariada CLI scanner's Chromium path, where the engine can use the richer browser accessibility tree. For non-Chromium browsers or environments where a CDP accessibility-tree session is not reachable, the result is reported as `dom-fallback` and still uses the shared rule-library output from the Ariada CLI pipeline.

## API

- `registerAriadaCommand(Cypress?, cy?)`: registers `cy.ariadaScan()`.
- `setupAriadaNodeEvents(on, config, defaults?)`: registers the `ariada:scan` task.
- `runAriadaScan(url, options?)`: Node-side wrapper around `@ariada-org/cli` `runScan`.

Options:

- `severityThreshold`: `minor`, `moderate`, `serious`, or `critical`; default `moderate`.
- `browser`: `chromium`, `firefox`, or `webkit`; default `chromium`.
- `timeoutMs`: scanner navigation timeout.
- `outputDir`: directory for CLI JSON output.
- `failOnViolation`: set `false` to return findings without throwing in Cypress.
- `logOnly`: set `true` to log findings without failing the Cypress command.
- `taskTimeoutMs`: Cypress task timeout; default 120 seconds.

## Evidence

Run:

```sh
pnpm --filter @ariada-org/cypress-ariada scan:evidence
```

This writes `scan-evidence/result.html` with embedded evidence for the Cypress failure surface.
