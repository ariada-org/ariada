# Ariada Raycast Extension

Raycast extension scaffold for running the Ariada CLI from macOS launcher
commands and showing scan results in a list-friendly shape.

## What It Does

- Defines a Raycast command named `scan-url`.
- Builds the Ariada CLI command for a URL.
- Converts Ariada CLI JSON into list items with severity, rule id, and report
  actions.

## Local Gates

```sh
npm test
npm run typecheck
```

`ray build` and `ray lint` are blocked on this machine because the Raycast CLI is
not installed.

## Live-Host Blocker

Blocked: Raycast Store submission requires a Raycast developer account, local
Raycast app/CLI validation, and store review.

Owner: founder. Next action: install/sign in to Raycast, run `ray build` and
`ray lint`, then submit the extension to the Raycast Store.
