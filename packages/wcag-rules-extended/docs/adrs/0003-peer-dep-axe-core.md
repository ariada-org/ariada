<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# ADR 0003 — `axe-core` as a peer dependency, not bundled

| Field   | Value                                                          |
|---------|----------------------------------------------------------------|
| Status  | Accepted                                                       |
| Date    | 2026-05-14                                                     |
| Authors | Agonist Development AB (Sweden)                                |

## Context

The package extends axe-core via the documented `axe.configure({ rules, checks })` API. axe-core can be wired into the package in three ways: as a regular dependency (bundled, version pinned), as a peer dependency (consumer-supplied, range-versioned), or as a forked / vendored copy.

## Decision

Declare `axe-core` as a **peer dependency** with version range `^4.10.0`, and require the consumer to install axe-core themselves. Do not bundle axe-core, do not vendor it, and do not modify its source.

## Rationale

Three reasons:

1. **Avoids fork-lock.** If this package bundled axe-core and consumers also installed axe-core for other purposes (e.g., `@axe-core/playwright`, `@axe-core/react`), npm would resolve two copies. Two copies of axe-core in the same process produce ambiguous configuration: a rule registered on copy A is invisible to a scan run from copy B. The peer-dependency pattern forces a single shared copy in the resolution tree.
2. **MPL-2.0 license discipline.** axe-core is licensed MPL-2.0, which is file-level copyleft: modifications to MPL files must be published back under MPL. By not vendoring or modifying axe-core, this EUPL-1.2 package does not touch MPL files and the MPL copyleft does not apply to the rest of the package. The IP-boundary guard (`scripts/oss-ip-guard.sh`) verifies that no axe-core source files have been copied into this repository.
3. **Follows ecosystem standards.** Every other axe-core extension on npm (`@axe-core/playwright`, `@axe-core/puppeteer`, `axe-html-reporter`, `pa11y-ci-axe`) declares axe-core as a peer dependency, not a regular dependency. Following the convention means the package interoperates with the ecosystem without surprise.

Alternatives considered and rejected:

- **Bundle axe-core as a regular dependency.** Rejected for the duplicate-copy reason above.
- **Vendor axe-core and modify its rules to fit our patterns.** Rejected for the MPL copyleft reason. Modifying axe-core source would force this package to relicense under MPL, which is incompatible with the EUPL-1.2 strategy from ADR 0001.
- **Use axe-core's webdriver bindings instead.** Rejected because this package is a rule library, not a scanner. Consumers may use any axe-core invocation surface (playwright, puppeteer, webdriverio, in-page direct).

## Consequences

- `package.json` declares `"peerDependencies": { "axe-core": "^4.10.0" }` and lists axe-core in `devDependencies` for tests only.
- The README documents the install command including axe-core explicitly: `npm install --save-dev @ariada-org/wcag-rules-extended axe-core`.
- When a major axe-core release (5.x, 6.x) ships, this package must explicitly bump the peer-range in a minor-version release. The package is not auto-compatible with future axe-core majors.
- If a future axe-core breaking change removes the `axe.configure({ rules, checks })` API (the package's only integration surface), the package's integration must be reworked. This is a known fragility but is unlikely given the API's stability since axe-core 4.0.
- Consumers may use this package's rules directly without axe-core by importing the rule's `check` function and calling it on their own DOM, since each rule exposes a pure-function check. This pattern is documented for tooling-builder consumers in the rule's source files.

## References

- axe-core peer-dep convention: <https://github.com/dequelabs/axe-core/blob/develop/doc/developer-guide.md>
- MPL-2.0 text: <https://www.mozilla.org/en-US/MPL/2.0/>
- package.json `peerDependencies` and `devDependencies` blocks.
- `scripts/oss-ip-guard.sh` — verifies no MPL-licensed files copied in.
