# @ariada-org/eslint-plugin-a11y

ESLint 9 flat-config plugin for source-detectable ariada accessibility checks.
It is a fast editor and CI gate for issues visible in JSX-like source before a
browser scan runs.

## Install

```sh
pnpm add -D @ariada-org/eslint-plugin-a11y eslint
```

## Flat config

```js
import ariadaA11y from '@ariada-org/eslint-plugin-a11y';

export default [
  ariadaA11y.configs.recommended,
];
```

The recommended config enables:

- `@ariada-org/a11y/img-alt`
- `@ariada-org/a11y/label-has-associated-control`
- `@ariada-org/a11y/heading-order`
- `@ariada-org/a11y/html-has-lang`

## Scope

These rules intentionally stay source-only. They catch missing image text,
unassociated labels, skipped heading levels, and missing document language in
JSX-like files. Runtime checks such as contrast, focus order, ARIA computation,
and generated DOM state still belong in the ariada browser scanner.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
