# Ariada Eclipse Plugin

Eclipse plugin scaffold for turning Ariada CLI findings into IDE markers. It is
thin by design: Ariada CLI owns scanning, and the plugin maps returned findings
onto Eclipse marker concepts.

## What It Does

- Defines plugin metadata and a command id.
- Builds Java model classes for Ariada findings.
- Maps Ariada impact levels to Eclipse marker severities.

## Local Gates

```sh
bash scripts/compile-smoke.sh
```

Tycho/Maven packaging is blocked because Maven is not installed on this machine.
The local smoke compiles the Java mapper and runs a fixture assertion with
`javac/java`.

## Live-Host Blocker

Blocked: Eclipse Marketplace publication requires Tycho build output, an update
site, Marketplace account access, and store review.

Owner: founder. Next action: run Maven/Tycho packaging on a host with Maven and
Eclipse PDE dependencies, then submit the update site to Marketplace.
