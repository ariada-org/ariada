# Gradle Ariada Plugin

`gradle-ariada` is a thin Gradle adapter for the shared `@ariada-org/cli`.
It does not implement scanning rules. It registers an `ariadaScan` task that
invokes `ariada scan`, reads the generated `scan.json`, prints a Gradle-native
summary, and can fail the build when findings cross the configured gate.

## Usage

```kotlin
plugins {
    id("org.ariada.scan") version "0.1.0"
}

ariada {
    targetUrl.set("https://example.com")
    domains.set("accessibility")
    severityThreshold.set("moderate")
    failOnViolations.set(true)
}
```

Run:

```bash
./gradlew ariadaScan
```

The task expects the shared CLI to be available as `ariada` on `PATH`. For local
workspace testing, set `cliCommand`:

```kotlin
ariada {
    cliCommand.set("node /path/to/packages/ariada-cli/dist/bin.js")
}
```

## Outputs

The task writes CLI artifacts to `build/ariada` by default and reads
`build/ariada/scan.json`.

## Human Gate

Publishing to the Gradle Plugin Portal is blocked on founder credentials:
Gradle Plugin Portal account, plugin namespace ownership, and publish key.
