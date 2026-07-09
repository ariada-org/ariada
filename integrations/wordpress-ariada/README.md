# Ariada for WordPress

General WordPress site-scan plugin for administrators who need to check rendered
pages and posts for WCAG/EAA issues. It is intentionally separate from the
WooCommerce channel.

## What It Does

- Adds `Tools -> Ariada Site Scan`.
- Lets an administrator scan the home page, a selected published page, or a
  selected published post, across a configurable set of domains
  (accessibility, privacy, security, sustainability, structured-data,
  ai-readiness) at a chosen severity threshold.
- Calls the existing Ariada CLI or a hosted `/api/scan` endpoint.
- Probes on activation for the Ariada CLI and a Playwright chromium browser
  and shows one of three admin notices: local CLI mode active, hosted mode
  (no CLI reachable), or CLI present but no browser installed.
- Exposes `GET /wp-json/ariada/v1/report` (requires `manage_options`) and a
  `wp ariada-site scan` WP-CLI command whose exit code reflects the
  underlying CLI's own severity-threshold gate — usable as a CI deploy gate.
- Stores and renders the latest scan result in wp-admin.

## Local Runner

```sh
npm install -g @ariada-org/cli
ariada scan https://example.test --domains accessibility,privacy --severity-threshold serious
```

The plugin invokes the same command with an output directory and reads the
raw CLI exit code: `0` (no findings at/above threshold) and `1` (findings
at/above threshold, a successful scan) both produce a stored report; other
codes are treated as a runtime error.

## Hosted Runner

Hosted mode is explicit configuration. The plugin posts only the rendered URL,
the selected domain list, and the severity threshold to `<endpoint>/api/scan`
with a bearer token.

## WP-CLI

```sh
wp ariada-site scan --url=https://example.test --severity-threshold=serious --domains=accessibility,privacy
echo $?   # 0 = clean, 1 = threshold breached OR scan could not run
```

## REST API

```sh
curl -H "Authorization: Bearer <wp-app-password>" https://example.test/wp-json/ariada/v1/report
```

Returns the latest stored report as JSON, or 401 without authentication.

## Local Verification

```sh
node scripts/validate-structure.mjs
```

This is the closest this package gets to `php -l` / a PHPUnit suite in an
environment with no PHP interpreter available: it parses `ariada-wordpress.php`
with `php-parser` (a real syntax check, not a string search) and then walks
the resulting AST to confirm the hooks, REST route, WP-CLI registration, and
domain-configuration surface actually exist as declared — not merely
mentioned in a comment.

Where a PHP interpreter or WP-CLI *is* available:

```sh
php -l ariada-wordpress.php
composer install && composer run lint    # PHP_CodeSniffer against the WordPress standard
```

## Known gaps (disclosed, not fabricated)

- **No PHPUnit / `WP_UnitTestCase` suite, no wp-env WordPress instance, no
  live activation test.** This package's own build environment has no PHP
  interpreter and no Docker daemon available, so none of `php -l`, PHPUnit,
  or a real WordPress activation could be executed here. `validate-structure.mjs`
  is the honest substitute available in this environment — it does not claim
  to be equivalent to running the plugin inside real WordPress.
- **The capability probe is a heuristic.** `ariada_wp_detect_capabilities()`
  checks `proc_open`, runs `<binary> --version`, and looks for a Playwright
  chromium browser in the standard cache locations (or
  `PLAYWRIGHT_BROWSERS_PATH`). A non-standard browser install location reads
  as "browser absent" even when a browser is in fact installed; the admin can
  always force hosted mode regardless.
- **No multisite network admin screen.** The PRD's network-wide dashboard
  (per-site finding counts across a WordPress multisite network) is not
  built; this is the lowest-priority item in the PRD's own scope (P2) and is
  flagged rather than stubbed.
- **`wp.org` plugin-check has not been run.** No PHP interpreter was
  available to install/run the official `@wordpress/plugin-check` tool in
  this environment.

## Review Blocker

WordPress.org directory submission is a founder action after a real hosted
WordPress smoke test (an actual WordPress install, not available in this
build environment) and plugin-directory account review.
