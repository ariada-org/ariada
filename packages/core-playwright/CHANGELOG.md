# @ariada-org/core-playwright

## 0.3.0

### Minor Changes

- 8bd4173: Say what to do when there is no browser

  Playwright's own message is a box telling the reader to download ninety-five
  megabytes. For someone trying a tool once, that is where they stop. Most
  machines already have a browser, so that answer goes first, and the message
  says why a browser is needed at all — a page that builds itself in the browser
  has contents no file contains.

  On a terminal, errors are printed as sentences rather than as a JSON object.
  The object is still what a program gets.

- 8bd4173: Name an element so it can be found again

  A finding records which element failed. Two passes built that name and built
  it differently, both writing a running count into `:nth-of-type(n)` — which
  means the nth among its siblings, not the nth on the page. The names found
  nothing, and because the contrast pass is joined to the outline by that name,
  contrast violations were computed and then dropped.

  The naming now lives in one place and does not return a name until the
  document has confirmed it finds that element and only it. Measured on six
  sites: 153 of 245 findings could be placed before, 432 of 436 after.

- 8bd4173: Use a browser the machine already has

  `ARIADA_BROWSER_PATH` names the browser binary outright, which is what a Linux
  distribution's package needs — it installs to a path no Playwright channel
  refers to. Without this, trying the scanner meant downloading ninety-five
  megabytes of an engine most machines already have.

### Patch Changes

- Updated dependencies [8bd4173]
  - @ariada-org/core-engine@0.3.0

## 0.2.0

### Minor Changes

- Scanner self-heal features: surface axe needs-review findings (not only violations), native SC 1.4.3 contrast pass in snapshot capture, configurable gate profiles (balanced/strict), and YAML policy-file loading in the diff gate.

### Patch Changes

- Updated dependencies
  - @ariada-org/core-engine@0.2.0
