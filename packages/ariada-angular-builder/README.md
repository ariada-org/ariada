<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Angular Builder

Angular CLI builder metadata and schematic helper for running Ariada over an
Angular `dist/` directory. The package reuses `@ariada-org/vite-plugin` static
HTML scanning and does not implement accessibility rules itself.

Official contract checked during implementation:

- Angular CLI builders integrate with workspace configuration and custom targets.
  Source: https://angular.dev/tools/cli/cli-builder

The `ng-add` helper adds an `ariada` target:

```json
{
  "builder": "@ariada-org/angular-builder:scan",
  "options": {
    "outputPath": "dist/app",
    "reportFile": "ariada-angular-report.json"
  }
}
```

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
