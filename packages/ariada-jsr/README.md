# @ariada-org/ariada-jsr

JSR-facing TypeScript adapter for Ariada. It gives Deno and TS-first consumers a
small typed surface for building the shared `@ariada-org/cli` scan command.

The package does not implement scanner logic. Scanning remains in the published
`@ariada-org/cli` package and the shared Ariada scanner packages.

## Install

```sh
deno add jsr:@ariada-org/ariada-jsr
```

## Consumer fixture

```ts
import { buildAriadaNpxCommand } from '@ariada-org/ariada-jsr';

const command = buildAriadaNpxCommand({
  target: 'https://example.test',
  outputDir: './ariada-output',
  domains: ['accessibility', 'privacy'],
  format: 'both',
  severityThreshold: 'moderate',
});

console.log(command.display);
```

The generated command delegates to the shared CLI:

```sh
npx --yes @ariada-org/cli@latest scan https://example.test --output-dir ./ariada-output --format both --severity-threshold moderate --domains accessibility,privacy
```

## Local validation

```sh
pnpm --filter @ariada-org/ariada-jsr typecheck
pnpm --filter @ariada-org/ariada-jsr lint
pnpm --filter @ariada-org/ariada-jsr test
pnpm --filter @ariada-org/ariada-jsr validate:jsr
```

`validate:jsr` checks the local JSR manifest and runs `deno publish --dry-run`.
Actual publication to `jsr.io` requires a JSR scope/package account and either
interactive auth, a token, or linked GitHub Actions OIDC publishing.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
