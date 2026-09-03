# Validation evidence

## Source gates

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run ci:check
npm run examples:check
npm run docs
npm run security
```

The source manifest has no production dependencies and no install/prepare/prepack
hooks. Therefore the clean install cannot request unpublished Ariada packages and
cannot download a browser.

## Distribution gates

```sh
npm run package:check
npm run package:determinism
```

Expected markers include `PACKED_CONSUMER_PASS`, `PACKED_MANIFEST_PASS`,
`RUNTIME_CLOSURE_PASS`, and `DETERMINISM_PASS`. Review these artifacts:

- `artifacts/ariada-org-changesets-ariada-0.1.0.tgz`
- `artifacts/SHA256SUMS`
- `artifacts/package-inventory.json`
- `artifacts/dependency-inventory.json`

The package check rejects `file:`, `workspace:`, and `link:` metadata, non-exact
top-level runtime versions, lifecycle scripts, source/tests, scanner substitutes,
browser binaries, missing closure entries, checksum drift, and runtime resolution
outside the installed package.

## Packed actual

```sh
PLAYWRIGHT_BROWSERS_PATH=/path/to/provisioned/ms-playwright \
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
npm run test:actual
```

The host must use Node 22 and already contain the Chromium revision required by
Playwright 1.61.1. The test never provisions a browser. Expected markers are
`PACKED_ACTUAL_PASS` and `CHANGESETS_GATE_PASS`, with `fail_exit=1`, `pass_exit=0`,
and a real `image-alt` rule. Machine-readable results are written to
`artifacts/acceptance-evidence.json`.
