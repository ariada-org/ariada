<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `@ariada-org/lerna-ariada`

Production glue for running the existing Ariada CLI once per Lerna package and
combining the canonical scan artifacts. It does not implement a scanner. Lerna
owns topology and task fan-out; Ariada owns browser execution and findings.

## Install

```bash
npm install --save-dev --save-exact lerna@9.0.7 @ariada-org/lerna-ariada@0.1.0
```

Node 22 or newer is required. The package has no install script and never
downloads browsers. CI must provision a compatible Playwright cache and set
`PLAYWRIGHT_BROWSERS_PATH`.

## Package target

Add the same task to every package that should be scanned:

```json
{
  "scripts": {
    "a11y": "lerna-ariada scan --target-env ARIADA_TARGET_URL --severity-threshold serious"
  }
}
```

`--target URL` is also repeatable. `--target-env` names an uppercase environment
variable; the value is passed as one argv element, never interpreted by a shell.
The wrapper discovers the nearest `lerna.json`, reads the current package name,
and writes to `ariada-output/packages/<stable-package-key>/`.

## Fan-out and aggregate

```bash
export ARIADA_TARGET_URL=https://preview.example.test
npx lerna run a11y --no-bail --stream
npx lerna-ariada aggregate
```

Finding-bearing package scans intentionally make `lerna run a11y` exit `1`.
Run the aggregate command even after that expected status. The shell-free
`templates/root-a11y.mjs` recipe does both and distinguishes findings from
operational failures.

The aggregate command reads the package globs selected by `lerna.json`, falling
back to the root `workspaces` field. Every workspace with an `a11y` script must
have a valid package summary and canonical `cli-scan.v1` artifact. The output is
`ariada-output/aggregate.json` with package counts, targets, impacts and rule IDs.

## Semantic exits

- exit `0`: every validated scan passed the configured finding threshold.
- exit `1`: one or more validated scans contain threshold findings.
- exit `2`: invalid command-line usage.
- exit `3`: topology, spawn, artifact-contract or aggregation failure.
- exits `4` and `5`: preserved Ariada operational statuses where applicable.

## Security and reproducibility

- Child processes use argv arrays with `shell: false`.
- Only `http:` and `https:` targets are accepted.
- Reports are re-read and contract-validated before aggregation.
- Runtime dependencies use exact semver and are bundled in the tarball.
- Two clean packs must have the same SHA-256 and inventory.
- The packed consumer installs from an empty cache with `--offline --ignore-scripts`.
- Browser binaries and credentials are excluded from source and package artifacts.

## Verification

```bash
npm ci --ignore-scripts
npm run ci
PLAYWRIGHT_BROWSERS_PATH=/path/to/preprovisioned/cache npm run test:actual
```

The actual gate runs a real minimal two-package Lerna monorepo, invokes the
installed packed helper through `lerna run a11y`, scans a loopback page with known
axe findings, and validates the aggregate.

## Publication status

npm publication is external and is not claimed here. A maintainer must publish
with registry credentials, provenance and required 2FA. Until that happens,
consume the generated tarball or workspace package without claiming availability
from the public registry.

Lerna task behavior follows the official run-task and configuration contracts:
<https://lerna.js.org/docs/features/run-tasks> and
<https://lerna.js.org/docs/api-reference/configuration>.
