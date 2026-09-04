# Histoire and Ladle Ariada production audit

Audit date: 2026-07-14

## Production contract

The package consumes Ladle's public `meta.json` contract or an explicit Histoire
story manifest, waits for rendered story readiness, and invokes
`@ariada-org/cli` `runScan` with the real `@ariada-org/core-playwright` scan and
`@ariada-org/rules-axe`. It does not reimplement or mock scanning in packed
acceptance.

## Required gates

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run source-clean
npm run check:static
npm run package
npm run test:packed:offline
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:packed
```

The browser-required command is valid only with a cache provisioned before the
run. Browser download is not an accepted fallback.

## Dependency closure

- Top-level runtime, optional peer, and development dependencies use exact semver.
- Package-local tarballs resolve unpublished `@ariada-org/core@0.1.0` and
  `@ariada-org/rules-axe@0.1.0` during source installation.
- The public manifest remains exact semver and contains no local protocol.
- `bundleDependencies` embeds the Ariada runtime closure. Histoire and Ladle stay
  optional peers because consumers already own their story platform.
- Empty-cache offline installation with `--ignore-scripts` and `npm ls` is
  mandatory.
- Playwright `1.61.1` matches Chromium cache revision `1228`.

## Determinism and evidence

Packaging builds one real Ladle fixture and one real Histoire fixture, then
requires two independent npm packs to have the same SHA-256 and normalized file
inventory. Packed browser acceptance runs the installed runner against both
static platform outputs. Each must expose a serious shadow-root contrast finding,
custom-element descendant selector, non-empty Chromium AX tree, passing critical
gate, and failing serious gate.

## Security decision

The package is suitable for CI scans of trusted component libraries. Metadata and
manifest boundaries are capped and validated, local serving is loopback-only,
readiness fails closed, reports are written atomically, and no install hook,
browser download, secret, public listener, or remote upload is present.

## External blocker

Publication requires npm registry credentials and a provenance-capable release
job controlled by the release owner. No publication is performed or claimed by
this implementation.
