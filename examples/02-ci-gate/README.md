<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Example 02 — CI gate using the EAA audit reusable workflow

A copy-paste-ready GitHub Actions workflow that calls
`ariada-org/ariada/.github/workflows/eaa-audit.yml` as a reusable workflow
from a downstream repository. Use it as the basis for your own `eaa-audit`
job.

## What this shows

The reusable workflow installs Node 22, pnpm, axe-core, and
`@ariada-org/wcag-rules-extended`; scans the URLs you pass in; posts a PR
comment with the violation summary; uploads a SARIF report consumed by
GitHub Security / code-scanning; and uploads an artefact bundle
(`report.json` plus optional accessibility-statement HTML and VPAT).

Full input / output reference:
`packages/eaa-pipeline/docs/INPUTS.md` and
`packages/eaa-pipeline/docs/OUTPUTS.md`.

## How to use

1. In your own repository, create the file
   `.github/workflows/eaa-audit.yml`.
2. Copy the contents of
   [`.github/workflows/example.yml`](./.github/workflows/example.yml)
   into it.
3. Adjust the four common inputs:
   - `site-url` — your production URL, e.g. `https://your-site.com`.
   - `pages` — comma-separated list of paths to scan; default is `/`.
   - `fail-on` — comma-separated axe-core impact levels that fail the
     job. Allowed values: `minor`, `moderate`, `serious`, `critical`.
   - `locale` — BCP-47 locale tag for the emitted accessibility
     statement, e.g. `sv`, `en`, `de`, `fr`.

The workflow runs on every pull request to `main`, on a weekly schedule,
and on manual dispatch.

## Pinning policy

The example pins the reusable workflow at `v0.1.0-rc.1`. For production use
either keep that pin (exact reproducibility), pin to the latest stable
`v0.1`-line tag once one is published, or pin to a specific commit SHA for
OpenSSF Scorecard ≥ 8 compliance. See the package CHANGELOG for the tag
policy in detail.
