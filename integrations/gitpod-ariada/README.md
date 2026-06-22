# Ariada Gitpod Integration

Gitpod recipe for running Ariada accessibility scans when a cloud workspace
opens or when a developer runs the scan task manually.

## What It Does

- Provides `.gitpod.yml` template content.
- Adds a small task script that builds Ariada CLI arguments for a URL or preview
  target.
- Validates that the template includes install and scan tasks.

## Local Gates

```sh
npm test
node scripts/validate-gitpod-template.mjs
```

`gp validate` is blocked because the Gitpod CLI is not installed locally.

## Live-Host Blocker

Blocked: Gitpod review requires a published example repository or organization
workspace where the template can be opened by reviewers.

Owner: founder. Next action: create or grant access to a Gitpod organization and
publish the example repository using this `.gitpod.yml`.
