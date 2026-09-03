# `@ariada-org/nx`

Nx executor and generator for a cacheable Ariada accessibility gate. The plugin runs the real `@ariada-org/cli` scanner over a project's built output or an already-running preview. It does not implement accessibility rules itself.

## Runtime contract

- `@ariada-org/nx:a11y` serves `outputPath` on loopback, invokes Ariada CLI with the accessibility domain, and writes `multi-domain-report.json` to `reportDir`.
- Ariada exit `0` returns `{ success: true }`; findings exit `1` returns `{ success: false }`; argument/runtime exits `2+` fail the target as infrastructure errors.
- Chromium must already be provisioned. Installation and execution set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; this package has no lifecycle script and never downloads a browser.
- The generator makes built-output targets cacheable and includes the report directory plus `PLAYWRIGHT_BROWSERS_PATH` in Nx metadata. A live URL is non-deterministic and therefore generated with `cache: false`.

Nx's executor and generator conventions are documented in [Write a Simple Executor](https://nx.dev/docs/extending-nx/local-executors), [Extending Nx with Plugins](https://nx.dev/docs/extending-nx/intro), and [`updateProjectConfiguration`](https://nx.dev/docs/reference/devkit/updateProjectConfiguration).

## Install and configure

The package is not published yet. After a reviewed registry release:

```sh
npm install --save-dev --ignore-scripts @ariada-org/nx@0.1.0
npx nx generate @ariada-org/nx:init --project web
npx nx run web:a11y
```

The generator infers `outputPath` from the project's `build` target. Supply it explicitly when the build executor does not expose that option:

```sh
npx nx generate @ariada-org/nx:init \
  --project web \
  --outputPath dist/apps/web \
  --reportDir .ariada/web
```

See [`examples/project.json`](examples/project.json) for the generated target and [`examples/github-actions.yml`](examples/github-actions.yml) for CI with a pre-provisioned browser.

## Options

| Option | Meaning |
|---|---|
| `outputPath` | Built static directory. Mutually exclusive with `url`. |
| `url` | Existing HTTP(S) preview. Mutually exclusive with `outputPath`. |
| `reportDir` | Cacheable report output; defaults to `.ariada/<project>`. |
| `severityThreshold` | `minor`, `moderate`, `serious`, or `critical`. |
| `timeoutMs` | Navigation timeout from 1,000 to 300,000 ms. |
| `allowPrivate` | Explicit opt-in for caller-provided private/loopback URLs. Local `outputPath` serving enables loopback only for its own ephemeral server. |
| `browser` | `chromium`; required for CDP accessibility-tree capture. |

## Source, package, and acceptance gates

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
npm run test:schemas
npm run docs:check
npm run ci:check
npm run examples:check
npm run security
npm run audit:prod
npm run package
npm run test:packed
PLAYWRIGHT_BROWSERS_PATH=/path/to/provisioned-cache npm run test:integration
```

`npm run package` performs two independent packs and requires matching SHA-256 values. It writes:

- `artifacts/ariada-org-nx-0.1.0.tgz`
- `artifacts/checksums.sha256`
- `artifacts/inventory.json`

The source manifest has no Ariada registry dependency. The packed manifest adds exact-version Ariada packages as bundled dependencies, including the CLI, core engine, Playwright adapter, and rules-axe analyzer. `test:packed` installs that tarball with an empty npm cache, `--offline`, and `--ignore-scripts`, then runs `npm ls --all`. `test:integration` runs the installed artifact as a real Nx target against a known-bad page and requires a real axe finding plus semantic exit `1`.

## Security

Build and report paths are constrained to the workspace. Static content is bound to `127.0.0.1`, traversal and escaping symlinks are rejected, subprocesses use argument arrays with `shell: false`, and private network scanning remains opt-in. See [`SECURITY.md`](SECURITY.md).

## Release status

Implementation and local artifacts do not mean the package is published. npm publication credentials, provenance signing, and an Nx plugin registry listing are external maintainer actions.
