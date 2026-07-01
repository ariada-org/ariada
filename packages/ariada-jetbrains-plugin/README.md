# Ariada JetBrains Plugin

JetBrains IDE adapter for Ariada. The plugin adds a Tools menu action and an
`Ariada` tool window that invokes the existing `@ariada-org/cli` scanner for a
project URL and lists returned findings.

## Status

- MVP Gradle IntelliJ Platform plugin.
- Uses Ariada CLI as the scan engine; scanner logic is not duplicated here.
- Marketplace submission is blocked on founder-controlled JetBrains vendor
  access, signing credentials, listing assets, and a verifier compatibility
  matrix.

## Install For Local Testing

```sh
cd packages/ariada-jetbrains-plugin
./gradlew buildPlugin
```

Install the generated ZIP from `build/distributions/` with JetBrains IDE
`Settings -> Plugins -> Install Plugin from Disk`.

## Development Usage

Install or build the Ariada CLI first:

```sh
pnpm --filter @ariada-org/cli build
```

Set a project URL in one of three ways:

```sh
export ARIADA_SCAN_URL=http://127.0.0.1:4173/
printf 'http://127.0.0.1:4173/\n' > .ariada-url
export ARIADA_CLI_COMMAND=ariada
```

If no URL is configured, the action prompts for one. The plugin runs:

```sh
ariada scan <url> --domains accessibility --format json --output-dir <project>/.ariada/jetbrains --severity-threshold minor
```

Exit code `0` and `1` are both valid scanner outcomes: `1` means Ariada found
violations at or above the configured threshold.

## Fixture And Evidence

The local fixture lives at `fixtures/bad-site/index.html` and intentionally
contains missing alternative text, an empty button, an empty link, and skipped
heading order.

Run the package smoke path:

```sh
pnpm --filter @ariada-org/cli build
cd packages/ariada-jetbrains-plugin
node scripts/smoke-scan.mjs
```

The smoke script invokes the built Ariada CLI for rule metadata, scans the
fixture through the existing Ariada IDE analyzer bridge, and writes:

- `scan-evidence/ariada-bridge-report.json`
- `scan-evidence/cli-list-rules.json`
- `scan-evidence/findings.json`
- `scan-evidence/cli-list-rules.txt`
- `scan-evidence/result.html`
- `test-report/smoke.json`
- `test-report/result.html`

## Tests

```sh
./gradlew test
./gradlew buildPlugin
pnpm --filter @ariada-org/cli... build
pnpm --filter @ariada-org/vscode-extension build
node scripts/smoke-scan.mjs
```

## Marketplace Blocker

JetBrains Marketplace publication is a founder/manual step. Before upload, this
package needs a Marketplace vendor profile, plugin signing credentials, final
icon/listing assets, and Plugin Verifier runs for the supported IDE matrix.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01
