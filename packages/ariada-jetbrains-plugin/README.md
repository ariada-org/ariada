<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# @ariada-org/jetbrains-plugin

JetBrains IDE plugin skeleton for running Ariada accessibility scans from the editor and reviewing findings in a tool window. Open source under EUPL-1.2.

## Features

- `Tools > Scan with Ariada` action for HTML, JSX, TSX, Vue, and Svelte files.
- `Ariada` tool window listing the latest scan findings and remediation text.
- Deterministic local scanner boundary for the handoff build.
- Zero telemetry and no external model calls.

## Build

```sh
./gradlew test
./gradlew buildPlugin
```

`buildPlugin` writes the installable plugin archive to `build/distributions/`.

## Handoff Boundary

The current scanner implementation lives behind `AriadaRemediationWorkflow`.
`StubAriadaRemediationWorkflow` provides a local deterministic smoke path for
missing image alternative text and empty button names. The next implementation
slice can replace that class with a bridge to the Ariada CLI or published scanner
package while preserving the action and tool-window integration.

## Marketplace Notes

The plugin descriptor is `src/main/resources/META-INF/plugin.xml`. First
Marketplace submission remains a manual account step; this package only prepares
the build artifact.

## License

EUPL-1.2. See `LICENSE` and `NOTICE`.

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-06-22
