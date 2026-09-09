# @ariada-org/core-browser

## 0.2.1

### Patch Changes

- Updated dependencies [3cc2ae5]
  - @ariada-org/core-engine@0.3.1

## 0.2.0

### Minor Changes

- 8bd4173: Name an element so it can be found again

  A finding records which element failed. Two passes built that name and built
  it differently, both writing a running count into `:nth-of-type(n)` — which
  means the nth among its siblings, not the nth on the page. The names found
  nothing, and because the contrast pass is joined to the outline by that name,
  contrast violations were computed and then dropped.

  The naming now lives in one place and does not return a name until the
  document has confirmed it finds that element and only it. Measured on six
  sites: 153 of 245 findings could be placed before, 432 of 436 after.

### Patch Changes

- Updated dependencies [8bd4173]
  - @ariada-org/core-engine@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @ariada-org/core-engine@0.2.0
