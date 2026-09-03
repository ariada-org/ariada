# S234 production contract

The package invokes the real `@ariada-org/cli` `runScan` export. Loopback access is supplied by a narrow bridge to the real `@ariada-org/core-playwright` scanner, whose default analyzer is the real `@ariada-org/rules-axe`. The integration does not traverse shadow DOM or evaluate accessibility rules itself.

## Distribution invariants

- The distributable root manifest uses exact semver for every dependency and dev dependency.
- No `file:`, `workspace:`, or `link:` protocol is present in the packed artifact.
- Ariada source workspaces are built package artifacts, so a clean source install does not query unpublished Ariada registry packages.
- All runtime dependencies are bundled and an empty-cache offline consumer installs with `--ignore-scripts` and passes `npm ls --all`.
- Two independent clean packs must have the same SHA-256 digest. `artifacts/package-inventory.json` and `artifacts/SHA256SUMS` record the result.
- Playwright packages are included, but no browser binary and no browser download hook is included.

## Runtime invariants

- Fixture URLs are limited to credential-free loopback HTTP URLs.
- Exit `0` means no finding meets the configured severity threshold.
- Exit `1` means one or more findings meet the threshold.
- Other scanner exits are operational failures and are never converted into findings.
- A component finding is reported only when the real analyzer selector path is rooted at the configured custom-element tag.

## Publication status

The package is prepared for npm publication but is not claimed as published. Registry authentication and the founder-controlled publish action are external blockers.
