# Ariada Hugo Module

Author: GAUSS (orchestrator)

`integrations/hugo-ariada` is a thin Hugo module and post-build bridge for the
shared Ariada scanner. It does not parse HTML, implement WCAG rules, or replace
`@ariada-org/cli`; it only decides where a Hugo project should run the scanner
and how to retain the evidence.

## Intended workflow

```sh
hugo --minify
npx hugo-ariada --target-dir public --output-dir ariada-output
```

The wrapper serves the built `public/` directory locally, calls:

```sh
npx -y @ariada-org/cli scan <local-preview-url> --format both --output-dir ariada-output
```

and maps the shared CLI result to a release-gate exit code.

## Hugo module usage

Add the module to a Hugo site:

```toml
[module]
  [[module.imports]]
    path = "github.com/ariada-org/hugo-ariada"

[params.ariada]
  badgeLabel = "Ariada evidence available"
  evidenceHref = "/ariada/evidence/"
```

Then place the optional badge where the site wants a public evidence link:

```go-html-template
{{ partial "ariada/badge.html" . }}
```

The badge is intentionally small. The real product value is the post-build
evidence packet and hosted retention path, not a visual widget.

## Local validation

This runner does not have the `hugo` binary installed, so the true Hugo build
gate is blocked locally. The channel still includes:

- a Hugo module skeleton (`go.mod`, `hugo.toml`, partial and shortcode);
- a minimal Hugo source fixture under `examples/site`;
- a rendered `public/`-style fixture under `examples/rendered-public`;
- Node tests that prove wrapper command construction, local serving, JSON parsing
  and gate mapping;
- a generated scan-evidence report with tested-host and scan-result screenshots.

Run the locally available gates:

```sh
cd integrations/hugo-ariada
pnpm lint
pnpm typecheck
pnpm test
node scripts/build-evidence.mjs
node scripts/validate-screenshot.mjs \
  scan-evidence/screenshots/tested-host-surface.png \
  scan-evidence/screenshots/scan-result-preview.png
```

When Hugo is installed, add:

```sh
hugo --source examples/site --destination ../../scan-evidence/public
node src/index.mjs --target-dir scan-evidence/public --output-dir scan-evidence/ariada-output
```

Update:
- Author: GAUSS (orchestrator)
- Date: 2026-07-01
