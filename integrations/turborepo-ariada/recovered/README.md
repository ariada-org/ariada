# Ariada for Turborepo (S228)

`@ariada-org/turborepo-ariada` is a thin, cache-aware task wrapper around the
real Ariada CLI, Playwright adapter, and axe rule package. It adds no scanner of
its own. It turns a package-level accessibility scan into a declared Turborepo
task and writes `.ariada/findings.json` as the cacheable output.

The package is complete as a local tarball but is **not published**. Registry
publication and credentials are an operator/founder step. Until publication,
use the tarball produced by `npm run package`.

## Contract

- `ariada-turbo --html dist/index.html` serves one local HTML file on loopback,
  then calls `@ariada-org/cli`, `@ariada-org/core-playwright`, and
  `@ariada-org/rules-axe`.
- `ariada-turbo --url https://example.test` scans a public HTTP(S) target; Ariada
  keeps its private-network/SSRF guard enabled.
- The default gate exits with exit code 1 when findings meet `--fail-on`.
- `--report-only` exits zero so Turborepo can cache a report while preserving
  `semanticExitCode: 1` in the artifact. Use gate mode for a blocking CI step.
- Invalid options exit 2; runtime or artifact failures exit 3.
- Browser executables are never packaged or downloaded. A compatible browser
  must already exist in `PLAYWRIGHT_BROWSERS_PATH`.

## Install and configure

After registry publication:

```sh
npm install --save-dev --ignore-scripts turbo@2.9.16 @ariada-org/turborepo-ariada@0.1.0
```

For the current local artifact:

```sh
npm run package
npm install --save-dev --ignore-scripts ./artifacts/ariada-org-turborepo-ariada-0.1.0.tgz
```

Merge `templates/turbo.json` into the repository root `turbo.json`, then add a
package script:

```json
{
  "scripts": {
    "a11y": "ariada-turbo --html dist/index.html --output .ariada/findings.json --fail-on moderate"
  }
}
```

Run all package scans:

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 turbo run a11y
```

The task depends on the package's `build` task. Its own command/config input is
the package manifest; the upstream build hash carries source changes. The
declared `.ariada/**` output lets Turborepo restore the findings artifact on a
cache hit. `PLAYWRIGHT_BROWSERS_PATH` and
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` are declared as `passThroughEnv` so
Turborepo's default strict environment mode preserves the provisioned-browser
contract without making a machine-local cache path part of the task hash. This
follows Turborepo's official guidance for
[task inputs and outputs](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
and uses its documented
[versioned JSON schema](https://turborepo.dev/docs/getting-started/editor-integration).

The ready-to-fork repository is in `examples/monorepo`. Its `a11y` task uses
report-only mode to demonstrate caching over a known-invalid page; run
`npm run a11y:gate -w @example/site` for semantic blocking.

## Verification

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run test:source-install
npm run lint
npm run typecheck
npm test
npm run test:schema
npm run docs:check
npm run security
npm run package:check
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:actual
PLAYWRIGHT_BROWSERS_PATH=/tmp/adopta-pw1228 npm run test:turbo
```

`package:check` packs twice, compares SHA-256 values, inspects exact-semver
manifests, installs into an empty npm cache with `--offline --ignore-scripts`,
runs `npm ls --all`, and imports the installed Ariada/core/rules APIs. The two
browser gates execute only against a pre-provisioned Chromium revision 1228.

Release outputs are:

- `artifacts/ariada-org-turborepo-ariada-0.1.0.tgz`
- `artifacts/inventory.json`
- `artifacts/SHA256SUMS`

See `docs/PRODUCTION-CONTRACT.md` for the complete production and publication
boundary, and `SECURITY.md` for target/input controls.
