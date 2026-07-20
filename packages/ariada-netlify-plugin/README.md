# Ariada Netlify Build Plugin

Runs the `ariada` accessibility CLI after a Netlify build and scans the generated
publish directory through a temporary localhost server.

## What It Does

- Starts a local static server for the Netlify publish directory.
- Runs `ariada scan http://127.0.0.1:<port>/ --format both`.
- Writes `scan.json` and the human CLI output under `.netlify/ariada` by default.
- Fails the build when the CLI exits with accessibility violations, unless
  `failBuild` is set to `false`.

## Netlify Configuration

```toml
[[plugins]]
package = "@ariada-org/netlify-plugin"

  [plugins.inputs]
  severityThreshold = "moderate"
  failBuild = true
```

For local package review before publishing:

```toml
[[plugins]]
package = "./packages/ariada-netlify-plugin"
```

## Inputs

- `command`: CLI command or absolute path. Default: `ariada`.
- `publishDir`: publish directory. Defaults to Netlify's `PUBLISH_DIR`.
- `outputDir`: directory for CLI output. Default: `.netlify/ariada`.
- `severityThreshold`: one of `minor`, `moderate`, `serious`, `critical`.
- `failBuild`: fail when ariada exits with code `1`. Default: `true`.
- `timeoutMs`: CLI navigation timeout in milliseconds.

## Local Validation

This package intentionally uses only Node built-ins for local validation, so it
can be tested without editing the root lockfile:

```bash
npm run typecheck
npm run lint
npm test
```

The repository integration step still needs a root `pnpm install --lockfile-only`
after this package is accepted into the workspace. That step is outside this
stream because Pack 4 forbids editing the root lockfile.
