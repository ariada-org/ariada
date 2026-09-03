---
'@ariada-org/core-engine': patch
'@ariada-org/cli': patch
---

A finding the analyser could not decide is no longer reported as a failure.

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
