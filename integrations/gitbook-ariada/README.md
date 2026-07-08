# Ariada GitBook Integration

GitBook is a hosted documentation platform, so this integration does not pretend to
own a local GitBook build hook. It scans the surface GitBook actually exposes to
external automation: a published docs URL or an exported/static HTML bundle.

Official sources checked:

- https://gitbook.com/docs/docs-site/publish-a-docs-site documents publishing docs sites.
- https://gitbook.com/docs/developers documents GitBook's developer platform, API, SDK, CLI, and custom integrations.
- https://gitbook.com/docs/integrations/install-an-integration documents installed GitBook integrations, which are not a local static HTML build hook.

The wrapper is a thin launcher over `@ariada-org/cli`; it does not implement
accessibility scanning, HTML parsing, or rule logic.

## Published URL

```bash
npm install --global @ariada-org/cli
node integrations/gitbook-ariada/scripts/gitbook-ariada.mjs \
  --target "https://docs.example.com" \
  --cli ariada \
  --report-dir ariada-output/gitbook \
  --fail-on-severity serious
```

## Exported HTML

If you have an exported GitBook static bundle, point the wrapper at the directory.
The wrapper starts a local read-only server and scans that URL through
`@ariada-org/cli` with `--allow-private`.

```bash
node integrations/gitbook-ariada/scripts/gitbook-ariada.mjs \
  --target ./gitbook-export \
  --cli ariada \
  --report-dir ariada-output/gitbook
```

## CI

See `examples/github-actions.yml` for a URL-scan workflow. A real GitBook space scan
requires the founder/user to provide either a published docs URL or an exported HTML
bundle. There is no local GitBook build hook in this integration.

## Local validation

```bash
node --check src/config.mjs
node --check scripts/gitbook-ariada.mjs
node --check tests/gitbook-ariada.test.mjs
npm test
npm run validate
```

## Host blocker

End-to-end scanning of a real GitBook space is blocked until a published GitBook docs
URL or exported static HTML bundle is provided. The included integration test uses
`fixtures/export/` as the GitBook export boundary and a fake CLI binary to assert the
wrapper's invocation, report parsing, and non-zero gate behavior without
re-implementing production scanning.
