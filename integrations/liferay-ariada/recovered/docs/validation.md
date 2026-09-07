# Validation and evidence

## Package gate

Command:

`./scripts/gate-package.sh`

The gate runs Java and explicit JSP compilation plus the JUnit suite, validates the runtime checksum,
confirms the OSGi manifest, confirms the packed runtime is embedded, tests the
distribution ZIP, and validates `dist/SHA256SUMS`.

## Linux SHA-256 portability regression

Command:

`./scripts/gate-sha256-portability.sh`

This gate constructs an isolated tool path containing GNU `sha256sum` but no
`shasum`, exercises checksum creation and check semantics, and verifies the real
packed runtime artifact through that path.

## Complete Linux gate

Command:

`PLAYWRIGHT_BROWSERS_PATH=/existing/cache ./scripts/gate-linux.sh`

The complete gate disables browser downloads and runs the SHA-256 portability
regression, runtime verification, Gradle/JSP/JUnit/Bnd package gate, and the
empty-cache offline packed actual against an existing Chromium installation.

Evidence after execution:

- `build/evidence/package/gradle-build.log`
- `build/evidence/package/osgi-manifest.txt`
- `build/evidence/package/jar-contents.txt`
- `build/evidence/package/distribution-zip.txt`
- `build/evidence/package/status.json`

## Packed runtime actual gate

Command:

`PLAYWRIGHT_BROWSERS_PATH=/existing/cache ./scripts/gate-packed-runtime.sh`

The npm cache and consumer directory begin empty. npm runs with `--offline`,
`--ignore-scripts`, and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. The gate imports
the real required packages and executes the packed Ariada CLI against an HTTP
fixture containing genuine accessibility violations.

Evidence after execution:

- `build/evidence/packed-runtime/module-resolution.log`
- `build/evidence/packed-runtime/browser-resolution.log`
- `build/evidence/packed-runtime/multi-domain-report.json` or `scan.json`
- `build/evidence/packed-runtime/stdout.log`
- `build/evidence/packed-runtime/stderr.log`
- `build/evidence/packed-runtime/status.json`

## Live Liferay actual gate

Command:

`./scripts/gate-liferay-sandbox.sh`

This is not replaced by compilation or the packed scan. It needs a real Liferay
host, account, and live page. Missing values return exit 2 with `BLOCKED`.

Evidence after a successful supplied-host execution:

- `build/evidence/liferay-sandbox/ariada-portlet.png`
- `build/evidence/liferay-sandbox/ariada-full-report.json`
- `build/evidence/liferay-sandbox/status.json`
