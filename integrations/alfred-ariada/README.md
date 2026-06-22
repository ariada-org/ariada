# Ariada Alfred Workflow

Alfred workflow scaffold for running Ariada accessibility scans from a launcher
keyword.

## What It Does

- Defines keyword `ariada`.
- Builds `ariada scan <url> --format json`.
- Emits Alfred Script Filter JSON for pass/fail and top findings.

## Local Gates

```sh
plutil -lint info.plist
npm test
```

## Live-Host Blocker

Blocked: distributing a `.alfredworkflow` requires a signed release asset or
Alfred Gallery submission.

Owner: founder. Next action: package the workflow on macOS with Alfred
Powerpack, attach the release asset, and submit gallery metadata.
