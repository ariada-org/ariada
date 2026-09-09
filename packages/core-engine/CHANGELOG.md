# @ariada-org/core-engine

## 0.3.1

### Patch Changes

- 3cc2ae5: A finding the analyser could not decide is no longer reported as a failure.

  An analyser marks a finding `needsReview` when it could not determine the
  answer — contrast against a background it cannot resolve, for instance. The
  cross-site comparison treated any finding as a failure, so a site whose only
  findings needed review counted as failing; and when it was the only site
  scanned, the rule was promoted to `systemic`, the strongest statement the engine
  makes.

  Measured on this project's own site: eleven contrast findings, every one of them
  `needsReview` at a confidence of one half, reported as a systemic failure. All
  eleven pass when the ratio is computed in a browser.

  The scan summary now counts the two apart — `11 to review` rather than
  `11 found`, or `3 found, 8 to review` where both occur. Undecided findings are
  still shown, and are still in the report: they are the places worth a person's
  attention, and two of those eleven sat at 4.88:1 against a threshold of 4.5.

## 0.3.0

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

## 0.2.0

### Minor Changes

- Scanner self-heal features: surface axe needs-review findings (not only violations), native SC 1.4.3 contrast pass in snapshot capture, configurable gate profiles (balanced/strict), and YAML policy-file loading in the diff gate.
