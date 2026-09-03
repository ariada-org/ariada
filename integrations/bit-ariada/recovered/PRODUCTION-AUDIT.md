# Bit Ariada production audit

Audit date: 2026-07-14

## Production contract

`AriadaTask` structurally implements Bit Builder `BuildTask`. Its compile-time
declaration is pinned to, and gated against, the official
`@teambit/builder@1.0.1056` package declaration. It operates on
`originalSeedersCapsules`, emits a
`ComponentResult` for each capsule, and publishes Bit artifact definitions. Each
scan delegates to `@ariada-org/cli` `runScan`, real core Playwright, and
rules-axe. No scanner or finding is mocked in packed acceptance.

## Required gates

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run source-clean
npm run check:static
npm run package
npm run test:packed:offline
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:packed
```

The browser-required command is valid only with a pre-provisioned cache. Browser
download is not an accepted fallback.

## Dependency closure

- Top-level versions are exact and the packed manifest has no local protocol.
- Unpublished `@ariada-org/core@0.1.0` and `@ariada-org/rules-axe@0.1.0` resolve
  from checksum-recorded source tarballs during clean source install.
- All executable dependencies are bundled. Bit Builder remains a type-level,
  optional exact peer supplied by the host Bit process; its official source
  tarball is checksum-recorded as a contract-validation input.
- Playwright is pinned to `1.61.1`, matching Chromium cache revision `1228`.

## Determinism and evidence

Packaging requires two byte-identical tarballs and normalized file inventories.
Packed acceptance uses an empty npm cache and the installed artifact. Its fixture
renders a custom element with an open shadow root, verifies a serious
`color-contrast` finding, checks shadow text in Chromium AX evidence, preserves
raw CLI exit `1`, passes a critical threshold, and fails a serious threshold.

## Security decision

The package is suitable for trusted Bit component pipelines that produce static
rendered output. It serves only loopback, constrains file paths, does not spawn a
runtime shell, does not download a browser, and does not handle credentials.

## External blocker

Publication to bit.dev and npm requires owner-controlled registry credentials,
provenance release infrastructure, and marketplace review. No publication is
performed or claimed here.
