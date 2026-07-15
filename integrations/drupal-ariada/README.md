<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Ariada Drupal Module

Drupal 10/11 module that runs Ariada accessibility scans from the admin UI and
from Drush. The module is a thin adapter: it does not implement scanning logic.
It calls the Ariada CLI locally, or an explicitly configured hosted scan
endpoint.

## Install

Place this directory at `web/modules/custom/ariada_drupal` in a Drupal site, or
install it as a Composer path repository during development:

```json
{
  "repositories": [
    {
      "type": "path",
      "url": "../integrations/drupal-ariada"
    }
  ],
  "require": {
    "ariada/drupal-ariada": "*"
  }
}
```

Enable the module:

```bash
drush en ariada_drupal -y
drush cache:rebuild
```

## Local CLI Mode

Install the Ariada CLI where PHP can execute it:

```bash
npm install -g @ariada-org/cli
npx playwright install chromium
ariada version
```

Configure the Drupal module at
`/admin/config/development/ariada`. In local mode, the scanner runs:

```bash
ariada scan <url> --format json --output-dir <tmp-dir> --severity-threshold <level> --timeout-ms <ms>
```

The module accepts CLI exit code `0` for a clean scan and `1` for findings, then
reads `scan.json` from the output directory.

## Hosted Endpoint Mode

Hosted mode is opt-in. Configure an endpoint base URL and API key in the admin
form. The module calls `POST /api/scan` with the URL and severity threshold. If
the endpoint returns an asynchronous scan ID, the module polls
`GET /api/scan/{id}` until it receives a completed report or times out.

## Admin UI

Administrators with the `administer ariada scanner` permission can:

- choose auto, local CLI, or hosted execution mode;
- set the default scan URL and severity threshold;
- run a manual scan from the configuration form;
- review a render-array table of the latest findings.

The module also adds a Drupal Status Report entry showing whether the configured
scan boundary is available and the latest scan summary.

## Drush

Run a scan from CI or a deployment script:

```bash
drush ariada:scan https://example.com
drush ariada:scan https://example.com --severity-threshold=critical --format=json
```

Exit codes:

- `0`: scan completed and no findings met the threshold;
- `1`: scan completed and at least one finding met the threshold;
- `2`: invalid Drush option;
- `3`: scan failed at the CLI or hosted boundary.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-06-22
