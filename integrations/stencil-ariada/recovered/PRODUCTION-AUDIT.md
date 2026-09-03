# Stencil Ariada production audit

Audit date: 2026-07-14

## Production contract

The package implements Stencil's native `OutputTargetCustom` contract and runs
after non-watch builds. It scans rendered component usages through
`@ariada-org/cli` `runScan`, injects the real `@ariada-org/core-playwright` scan,
and explicitly supplies `@ariada-org/rules-axe`. No scanner or finding is mocked
in the packed acceptance path.

## Required gates

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run source-clean
npm run check:static
npm run package
npm run test:packed:offline
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:packed
```

The browser-required command is valid only when the cache is provisioned before
the run. Browser download is not an accepted fallback.

## Dependency closure

- Top-level runtime dependencies use exact semver and no local protocol.
- `@ariada-org/core@0.1.0` and `@ariada-org/rules-axe@0.1.0` are unavailable from
  the registry. Source install resolves their official package tarballs from
  `vendor/`; the packed manifest remains exact semver.
- `bundleDependencies` embeds all direct runtime packages and their transitive
  graph. Empty-cache offline installation with `--ignore-scripts` and `npm ls`
  is mandatory.
- Playwright is pinned to `1.61.1`, matching Chromium cache revision `1228`.

## Determinism and evidence

`npm run package` requires two independently produced tarballs to have the same
SHA-256 and normalized npm file inventory. It records the complete production
lock closure and vendor input hashes. Packed acceptance runs the installed
artifact, not source imports, against a Stencil shadow-root contrast defect and
checks the axe shadow selector, Chromium AX tree text, raw CLI exit `1`, passing
critical threshold, and failing serious threshold.

## Security decision

The package is suitable for local production builds of trusted Stencil component
libraries. It never serves publicly, downloads a browser, invokes a shell,
executes an install hook, uploads reports, or accepts credentials. Scanner and
browser vulnerabilities remain gated by `npm audit --omit=dev --audit-level=high`.

## External blocker

Publication requires npm registry credentials and a provenance-capable release
job controlled by the release owner. No publication is performed or claimed by
this implementation.
