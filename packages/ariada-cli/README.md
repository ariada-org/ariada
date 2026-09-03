<!--
SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `@ariada-org/cli`

Single-binary command-line runner for the **ariada** accessibility scanner pipeline. Scans URLs against WCAG 2.2 AA + EN 301 549 rule packs, emits human-readable and machine-readable reports, and returns standard exit codes suitable for CI gates.

License: EUPL-1.2 (European Union Public Licence v1.2).

## Status

`v0.1.0` — scaffold. Three subcommands fully implemented (`scan`, `list-rules`, `version`). Two subcommands stubbed (`generate-statement`, `estimate-penalty`) and tracked via public issues.

## Install

```bash
# One-off via npx
npx @ariada-org/cli scan https://example.com

# Global install
npm install -g @ariada-org/cli
ariada scan https://example.com

# Workspace dev
pnpm --filter @ariada-org/cli build
node packages/ariada-cli/dist/bin.js scan https://example.com
```

Requires Node 22 LTS or newer. Playwright browser binaries are a peer concern — install them via `npx playwright install chromium` before running `scan`.

## Subcommands

### `ariada scan <url>`

Run the OSS scanner pipeline against one URL.

```bash
ariada scan https://example.com
ariada scan https://example.com --browser webkit --severity-threshold serious
ariada scan https://example.com --format json --output-dir ./out
```

Options:

| Option | Default | Description |
|---|---|---|
| `--output-dir <path>` | `./ariada-output` | Directory for machine-readable artefacts |
| `--browser <name>` | `chromium` | `chromium` \| `firefox` \| `webkit` |
| `--format <name>` | `human` | `human` \| `json` \| `both` |
| `--severity-threshold <level>` | `moderate` | `minor` \| `moderate` \| `serious` \| `critical` |
| `--timeout-ms <ms>` | `30000` | Per-URL navigation timeout |

### `ariada list-rules`

Print every rule registered by `@ariada-org/wcag-rules-extended`.

```bash
ariada list-rules                # human-readable table
ariada list-rules --format json  # JSON array
ariada list-rules --pack checkout
```

### `ariada version`

Print CLI version + linked `@ariada-org/*` peer versions + Node version.

### `ariada generate-statement` (stub, exit 4)

Will emit an EN 301 549 article 7 accessibility statement. The underlying
library lives at `@ariada-org/statement-generator`.

### `ariada estimate-penalty` (stub, exit 4)

Will emit a penalty exposure estimate. The underlying library lives at
`@ariada-org/penalty-estimator`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | OK, no violations at or above `--severity-threshold` |
| `1` | Violations found |
| `2` | Invalid arguments (parser rejected the invocation) |
| `3` | Runtime error (navigation failure, timeout, IO, browser crash) |
| `4` | Unimplemented subcommand (stub) |
| `5` | Reserved — license / pre-check failure |

## Errors

Errors are emitted to stderr as single-line JSON, e.g.:

```json
{"level":"error","code":"E_INVALID_URL","message":"Argument is not a parseable http(s) URL: ftp://example.com","details":{"url":"ftp://example.com"}}
```

Error codes: `E_INVALID_URL`, `E_INVALID_OPTION`, `E_RULE_NOT_FOUND`, `E_NAVIGATION_TIMEOUT`, `E_NAVIGATION_FAILED`, `E_BROWSER_LAUNCH`, `E_BROWSER_CRASH`, `E_OUTPUT_WRITE`, `E_UNIMPLEMENTED`, `E_INTERNAL`.

## Library use

The CLI is also importable as a library for programmatic use:

```ts
import { run, runScan, runListRules } from '@ariada-org/cli';

const exitCode = await run(['scan', 'https://example.com']);
```

## Maintainer

Maintained by Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726).

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
