# @ariada-org/cli

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
