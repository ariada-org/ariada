# Ariada JetBrains Plugin

JetBrains IDE adapter for Ariada. It offers two scans and is explicit about what
each one can see, because they answer different questions:

| | Scan the open file | Scan the site |
|---|---|---|
| What it reads | the editor's text, unsaved and unbuilt | a page served at an address, as a browser builds it |
| What it finds | images without alternative text, buttons with no accessible name | everything the scanner's rule packs report |
| When it helps | while the markup is being written | before the change goes out |

Both write into the same tool window, through the project service that holds the
last result. Neither sends anything anywhere.

## Status

- Gradle IntelliJ Platform plugin, Java 17 sources.
- The site scan runs `@ariada-org/cli` — scanner logic is not duplicated here.
  The file scan is two checks written in the plugin, and says so rather than
  implying it covered a criterion it never exercised.
- Marketplace submission is blocked on founder-controlled JetBrains vendor
  access, signing credentials, listing assets, and a verifier compatibility
  matrix.
- Known gap: the build targets Java 17 while the platform asks for 21. It
  compiles and runs; `verifyPluginProjectConfiguration` reports the mismatch and
  no Java 21 is installed on the build machine.

## The service and the panel, back again

The plugin was rewritten in July: a service and a panel that held their own state
gave way to a scanner that shells the command-line tool. The trade cost more than
it saved — without a service there was nowhere to keep the last result, and the
panel left behind was reachable only through a static map of windows.

A service and a panel are back, written fresh, and this time they sit beside the
command-line scanner rather than instead of it. Both scans report through the same
snapshot, and anything that wants results registers a listener rather than reaching
into a window.

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

If no URL is configured, the site scan prompts for one. It then runs:

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
node scripts/check-bundled-deps.mjs
node scripts/smoke-scan.mjs
```

`check-bundled-deps.mjs` reads the imports out of the sources and requires every
third-party package among them to be inside the built archive. The build
classpath is wider than the IDE the plugin runs in, so code written against
something only the build provides compiles, passes its tests, and fails the
first time a person uses the feature. That is not hypothetical: the report
reader was written against a JSON library no IntelliJ IDEA distribution
carries.

## Marketplace Blocker

JetBrains Marketplace publication is a founder/manual step. Before upload, this
package needs a Marketplace vendor profile, plugin signing credentials, final
icon/listing assets, and Plugin Verifier runs for the supported IDE matrix.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-09-05
