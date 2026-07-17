# hexo-ariada

Hexo plugin that scans generated `public/` HTML with the shared Ariada CLI after
`hexo generate`.

The plugin is deliberately thin. It does not parse HTML, implement accessibility
rules, or score findings. It registers a Hexo `after_generate` filter, serves the
generated `public/` directory on `127.0.0.1`, and runs:

```sh
npx @ariada-org/cli scan http://127.0.0.1:<port>/ \
  --allow-private \
  --domains accessibility \
  --format json \
  --output-dir ariada-output
```

## Install

```sh
npm install --save-dev hexo-ariada @ariada-org/cli
```

Hexo loads packages whose names start with `hexo-` automatically. If your site
loads plugins manually, require the package from Hexo's plugin loader.

## Configure

```yaml
ariada:
  enabled: true
  publicDir: public
  outputDir: ariada-output
  failOnFindings: true
  severityThreshold: moderate
  domains: accessibility
  browser: chromium
  timeoutMs: 30000
```

`failOnFindings: true` makes `hexo generate` fail when the Ariada CLI exits with
violations. Set it to `false` to collect reports without gating the build.

## CI

```yaml
- run: npm ci
- run: npx hexo generate
- uses: actions/upload-artifact@v4
  with:
    name: ariada-report
    path: ariada-output/
```

## Local Validation

```sh
npm run typecheck
npm run lint
npm test
npm run evidence
```

The host integration test runs a minimal Hexo project only when `hexo` is
available on `PATH`. If the host tool is missing, the test marks that case as a
blocked host dependency instead of claiming end-to-end coverage.
