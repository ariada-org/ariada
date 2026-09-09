# @ariada-org/cli

## 0.3.1

### Patch Changes

- 258c8da: The help text says what the rules reach instead of claiming the whole standard.

  It described the accessibility scan as the "full WCAG 2.2 AA rule set". The
  registered rules reference 23 of the 55 success criteria in WCAG 2.2 AA — a
  reasonable number, since most of the rest cannot be judged by a machine at all,
  but not the whole standard. It now says the automatable part and points at
  `list-rules`, which answers the question exactly.

- d7a10f5: The default accessibility analyzer now ships in the package that uses it.

  `scan()` reached for `@ariada-org/rules-axe` by name at runtime whenever the
  caller passed no analyzers. That package is not part of the published source
  tree, so an installation built from it had no default analyzer at all: the scan
  failed, and the error told the reader to install something they could not
  obtain. `createA11yAnalyzer` and `mapAxeImpact` are now exported from
  `@ariada-org/core-playwright` and used directly.

  `@ariada-org/rules-axe` re-exports both, so existing imports keep working.

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

- Updated dependencies [d7a10f5]
- Updated dependencies [3cc2ae5]
  - @ariada-org/core-playwright@0.4.0
  - @ariada-org/core-engine@0.3.1
  - @ariada-org/multi-domain@0.1.3
  - @ariada-org/scan-report-html@0.2.1

## 0.3.0

### Minor Changes

- 8bd4173: `ariada check` — one command, no arguments

  A project says what it wants checked in an `ariada.json` beside its build:
  which directory the build produces, which pages matter, which domains to run.
  `ariada check` serves that directory itself on a port the operating system
  hands out, waits for it to answer, confirms the response is a page from this
  project, scans, and prints the findings one per line.

  The Makefile rule this replaces did the serving itself on a fixed port. Tested
  on a machine where that port was taken, it scanned an unrelated local service
  and reported five findings about its error page, silently.

  Findings do not fail the build unless `--strict` is passed.

### Patch Changes

- 8bd4173: Say what to do when there is no browser

  Playwright's own message is a box telling the reader to download ninety-five
  megabytes. For someone trying a tool once, that is where they stop. Most
  machines already have a browser, so that answer goes first, and the message
  says why a browser is needed at all — a page that builds itself in the browser
  has contents no file contains.

  On a terminal, errors are printed as sentences rather than as a JSON object.
  The object is still what a program gets.

- Updated dependencies [8bd4173]
- Updated dependencies [8bd4173]
- Updated dependencies [8bd4173]
- Updated dependencies [8bd4173]
  - @ariada-org/core-playwright@0.3.0
  - @ariada-org/core-engine@0.3.0
  - @ariada-org/scan-report-html@0.2.0
  - @ariada-org/multi-domain@0.1.2
  - @ariada-org/rules-axe@0.2.1

## 0.2.0

### Minor Changes

- Scanner self-heal features: surface axe needs-review findings (not only violations), native SC 1.4.3 contrast pass in snapshot capture, configurable gate profiles (balanced/strict), and YAML policy-file loading in the diff gate.

### Patch Changes

- Updated dependencies
  - @ariada-org/core-engine@0.2.0
  - @ariada-org/core-playwright@0.2.0
  - @ariada-org/diff-schema@0.2.0
  - @ariada-org/multi-domain@0.1.1
  - @ariada-org/scan-report-html@0.1.1
  - @ariada-org/diff-stub@0.1.1
