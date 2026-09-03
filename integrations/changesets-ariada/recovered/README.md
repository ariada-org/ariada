# Changesets Ariada release gate

`@ariada-org/changesets-ariada` is a Changesets release hook that runs the real
Ariada accessibility CLI before versioning or publishing packages. It adds no
scanner logic: the bundled `@ariada-org/cli`, core Playwright scanner, and
`@ariada-org/rules-axe` analyzer own scanning and threshold semantics.

## Production contract

The recommended release sequence is:

1. `changesets-ariada gate --require-changeset`
2. `changeset version`
3. `changesets-ariada append --report .ariada/release-gate.json --changelog CHANGELOG.md`
4. Review the generated versions and changelogs.
5. `changesets-ariada gate && changeset publish`

This ordering blocks `changeset version` before it consumes pending files and
blocks `changeset publish` immediately before registry writes. The separate
`append` command runs after Changesets generates changelogs. A `prepublishOnly`
script is also supported for a single-package repository; the root release script
is preferable in a monorepo because npm invokes package lifecycle hooks per package.

Changesets documents the `version` then `publish` sequence and supports custom
version/publish commands in its release action:
https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md
and https://github.com/changesets/action. npm documents that `prepublishOnly` runs
only for `npm publish`: https://docs.npmjs.com/cli/using-npm/scripts/.

## Wiring

Use the exact scripts from [`examples/package.json`](examples/package.json). Set
the target in CI rather than committing environment-specific endpoints:

```sh
export ARIADA_URL=https://preview.example.org
export PLAYWRIGHT_BROWSERS_PATH=/path/to/provisioned/ms-playwright
npm run version-packages
npm run release
```

Equivalent direct commands:

```sh
changesets-ariada gate \
  --url https://preview.example.org \
  --severity-threshold serious \
  --require-changeset \
  --report .ariada/release-gate.json
changeset version
changesets-ariada append \
  --report .ariada/release-gate.json \
  --changelog CHANGELOG.md
```

Exit `0` means the configured threshold passed. Exit `1` is Ariada's semantic
findings result and blocks the release. Exit `2` or another Ariada operational
code means configuration, browser, navigation, or scanner execution failed and
also blocks the release. The hook never treats an operational failure as a pass.

Private and loopback literal targets are denied by the hook unless the caller
explicitly adds `--allow-private`. The process runner never uses a shell. Playwright browser
downloads are disabled; CI must provision a browser that matches the packed
Playwright runtime and set `PLAYWRIGHT_BROWSERS_PATH`.

## Local gates

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run package:check
npm run package:determinism
npm run ci:check
npm run examples:check
npm run docs
npm run security
PLAYWRIGHT_BROWSERS_PATH=/path/to/provisioned/ms-playwright npm run test:actual
```

`package:check` builds `artifacts/ariada-org-changesets-ariada-0.1.0.tgz`,
compares two independent `npm pack` byte streams, writes deterministic SHA-256
and sorted file/dependency inventories, and installs only that tarball outside the
repository. The consumer starts with an asserted-empty npm cache and uses
`--offline --ignore-scripts`, followed by `npm ls --all`. It resolves the real CLI,
core, Playwright, and rules-axe packages from inside the installed artifact.

`test:actual` repeats that packed install, serves the minimal Changesets workspace
fixtures, and executes the installed hook twice. The inaccessible page must emit
a real `image-alt` finding and exit `1`; the accessible page must exit `0`.
No browser binary is bundled and no browser download command exists.

See [`docs/release-hook.md`](docs/release-hook.md),
[`docs/validation.md`](docs/validation.md), and [`SECURITY.md`](SECURITY.md).

## Publication status

**BLOCKED_EXTERNAL:** npm publication requires an authorized `ariada-org` registry
publisher and provenance-capable release credentials. Owner: founder/release
operator. Next action: review the packed artifact and inventories, then publish
`@ariada-org/changesets-ariada@0.1.0`. Local build and validation do not imply that
the package is published.
