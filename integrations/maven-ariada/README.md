# Ariada Maven Plugin

Thin Maven build-gate adapter over the shared `@ariada-org/cli` scanner.

## What It Does

- Adds the `ariada:scan` Maven goal.
- Runs the Ariada CLI against either a configured `ariada.url` or a generated
  static Maven site directory.
- Parses the CLI `scan.json` envelope.
- Fails the Maven build when violations meet or exceed the configured severity
  threshold.

The scanner stays in `@ariada-org/cli`; this plugin only gives Java teams the
native Maven entry point expected in Spring MVC, Thymeleaf, JSF, JSP and Maven
site release flows.

## Usage

```xml
<plugin>
  <groupId>org.ariada.integrations</groupId>
  <artifactId>ariada-maven-plugin</artifactId>
  <version>0.1.0</version>
  <configuration>
    <url>https://example.com</url>
    <severityThreshold>moderate</severityThreshold>
  </configuration>
  <executions>
    <execution>
      <phase>verify</phase>
      <goals>
        <goal>scan</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

Default CLI command:

```sh
npx --yes @ariada-org/cli scan <url> --format json --output-dir target/ariada
```

Set `ariada.cliExecutable=ariada` when the CLI is installed globally, or point it
to a test stub for local Maven invoker tests.

## Local Gates

```sh
mvn -B package
mvn -B verify
```

`verify` runs unit tests and an invoker fixture where the plugin scans a minimal
webapp fixture through a stubbed Ariada CLI and correctly fails the build on a
serious violation.

## Evidence

The scan evidence report lives at:

```text
integrations/maven-ariada/scan-evidence/result.html
```

The report embeds a screenshot of the Maven evidence page and records whether a
real CLI scan or a documented host blocker was used.

## Live-Host Blocker

Publishing is blocked on founder-owned Maven Central / Sonatype Central Portal
setup: namespace verification for `org.ariada`, GPG signing key, publishing
token, and release review. Until those exist, this integration is locally built
and review-ready, not published.
