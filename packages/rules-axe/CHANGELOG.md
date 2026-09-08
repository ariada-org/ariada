# @ariada-org/rules-axe

## 0.3.0

### Minor Changes

- d7a10f5: The default accessibility analyzer now ships in the package that uses it.

  `scan()` reached for `@ariada-org/rules-axe` by name at runtime whenever the
  caller passed no analyzers. That package is not part of the published source
  tree, so an installation built from it had no default analyzer at all: the scan
  failed, and the error told the reader to install something they could not
  obtain. `createA11yAnalyzer` and `mapAxeImpact` are now exported from
  `@ariada-org/core-playwright` and used directly.

  `@ariada-org/rules-axe` re-exports both, so existing imports keep working.

### Patch Changes

- Updated dependencies [d7a10f5]
  - @ariada-org/core-playwright@0.4.0

## 0.2.1

### Patch Changes

- @ariada-org/core@0.1.2

## 0.2.0

### Minor Changes

- Scanner self-heal features: surface axe needs-review findings (not only violations), native SC 1.4.3 contrast pass in snapshot capture, configurable gate profiles (balanced/strict), and YAML policy-file loading in the diff gate.

### Patch Changes

- @ariada-org/core@0.1.1
