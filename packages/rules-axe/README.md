# @ariada-org/rules-axe

The axe-core accessibility analyzer now ships in
[`@ariada-org/core-playwright`](../core-playwright), the package the scanner
loads it from when no analyzer is passed. This package re-exports it so existing
installations keep working.

Nothing here needs to change to keep using it:

```ts
import { createA11yAnalyzer } from '@ariada-org/rules-axe';
```

New code should import the same function from `@ariada-org/core-playwright`,
which is where it lives, and which is already installed wherever the scanner is.

## Why it moved

The scanner reached across the package boundary for its default analyzer,
importing this package by name at runtime. That resolved in this workspace and
nowhere else, so a scanner installed from the published source could not scan
until the caller supplied an analyzer of their own — and the error it raised
named a package the reader had no way to obtain. A default that cannot be
installed alongside the thing defaulting to it is not a default.

## Licence

EUPL-1.2, as in the repository root. `axe-core` and `@axe-core/playwright` are
MPL-2.0 — see the NOTICE file.
