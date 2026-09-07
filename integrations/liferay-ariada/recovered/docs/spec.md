# Implementation specification

## Objective

Build a production-native Liferay 7.4 OSGi portlet that scans the current portal
page with the canonical Ariada CLI. A signed-in portal author must see pass/fail,
the highest-severity WCAG and EN 301 549 findings, and a full JSON report.

## Technology

- Java 17, Liferay Portal 7.4 GA132, MVC Portlet, OSGi Declarative Services
- Liferay Workspace plugin 10.1.1 and Gradle wrapper 8.5
- JUnit Jupiter 5.10.3
- Gson 2.11.0 and Commons Compress 1.27.1 embedded with `compileInclude`
- Node.js 22 packed runtime with exact direct dependency versions
- `@ariada-org/cli` 0.1.0 and Playwright 1.60.0

## Commands

- Build and unit/package gate: `./scripts/gate-package.sh`
- Packed offline actual: `PLAYWRIGHT_BROWSERS_PATH=/existing/cache ./scripts/gate-packed-runtime.sh`
- Live Liferay actual: `./scripts/gate-liferay-sandbox.sh`
- Maintainer-only runtime regeneration: `./scripts/build-runtime.sh`

## Structure

- `modules/ariada-liferay-portlet`: Java OSGi module, JSP, CSS, JS, tests
- `runtime`: immutable npm packed runtime, checksum, dependency inventory
- `scripts`: package, offline actual, and real-host gates
- `docs`: architecture, validation, sandbox, and Marketplace handoff
- `dist`: generated installable distribution

## Code style

Java classes use explicit immutable models, constructor validation, no wildcard
imports, and narrowly scoped OSGi services. Shell scripts use `set -euo pipefail`
and never print secret values.

## Testing strategy

JUnit tests parse representative canonical CLI multi-domain JSON and exercise
same-origin SSRF protection. The package gate inspects the actual JAR and
distribution. The packed gate performs a clean empty-cache offline install and
real browser scan. The Liferay actual gate verifies the deployed user flow and
captures screenshot/report evidence.

## Boundaries

- Always: exact dependency versions, checksum runtime before extraction,
  same-origin scan URLs, process timeout, report size bound, no secret logging.
- Ask first: changing the Liferay target release, enabling cross-origin scans,
  adding hosted services, or submitting to Marketplace.
- Never: embed credentials, download browsers during build/deploy, invoke a
  workspace package at runtime, run npm lifecycle scripts, publish, or edit
  another integration channel.

## Success criteria

- `./gradlew :modules:ariada-liferay-portlet:build --no-daemon` compiles Java,
  runs JUnit, and emits a deployable OSGi JAR.
- JUnit parses CLI JSON into pass/fail, severity counts, WCAG and EN mappings.
- The embedded runtime contains real CLI/core/Playwright/rules-axe packages.
- A clean empty npm cache installs the packed runtime offline.
- The packed artifact runs a real scan and emits an accessibility finding.
- The sandbox gate either passes on a supplied host or returns an explicit
  external `BLOCKED` status without pretending local completion is live proof.
