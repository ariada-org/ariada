# Ariada for WordPress

General WordPress site-scan plugin for administrators who need to check rendered
pages and posts for WCAG/EAA issues. It is intentionally separate from the
WooCommerce channel.

## What It Does

- Adds `Tools -> Ariada Site Scan`.
- Lets an administrator scan the home page, a selected published page, or a
  selected published post.
- Calls the existing Ariada CLI or a hosted `/api/scan` endpoint.
- Stores and renders the latest scan result in wp-admin.

## Local Runner

```sh
npm install -g @ariada-org/cli
ariada scan https://example.test --domains accessibility --format json
```

The plugin invokes the same command with an output directory and accepts exit
codes `0` and `1` as completed scans.

## Hosted Runner

Hosted mode is explicit configuration. The plugin posts only the rendered URL,
domain list, and severity threshold to `<endpoint>/api/scan` with a bearer token.

## Local Verification

```sh
node scripts/validate-structure.mjs
php -l ariada-wordpress.php
```

`php -l` and WordPress host smoke require PHP/WP-CLI on the machine running the
check.

## Review Blocker

WordPress.org directory submission is a founder action after a real hosted
WordPress smoke and plugin-directory account review.
