=== Ariada Site Accessibility Scan ===
Contributors: agonistdev
Tags: accessibility, wcag, eaa, site audit
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Scan WordPress pages and posts through the Ariada CLI or a configured hosted scan endpoint.

== Description ==

Ariada Site Accessibility Scan is the general WordPress plugin for pages, posts,
and templates. It is separate from the WooCommerce plugin, which focuses on
product, cart, and checkout surfaces.

The plugin does not implement accessibility rules. It sends rendered public URLs
to an existing Ariada boundary:

* local CLI mode: `ariada scan <url> --domains <list> --severity-threshold <level>`
* hosted mode: `POST /api/scan` on a configured Ariada endpoint

On activation the plugin probes for the Ariada CLI and a Playwright chromium
browser and shows one of three notices in wp-admin: local CLI mode active,
hosted mode (no CLI reachable), or CLI present but no browser installed. The
probe is a best-effort filesystem/exec check, not a guarantee — the runner
mode can always be overridden from the settings page regardless of what it
detects.

Six domains are selectable from the settings page: accessibility, privacy,
security, sustainability, structured-data, ai-readiness. At least one must be
selected; the plugin defaults back to accessibility-only if none survive
validation.

== REST API ==

`GET /wp-json/ariada/v1/report` returns the most recently stored report as
JSON. Requires the `manage_options` capability; an unauthenticated request
receives HTTP 401.

== WP-CLI ==

`wp ariada-site scan [--url=<url>] [--severity-threshold=<level>] [--domains=<list>]`

Exit code semantics come straight from the underlying Ariada CLI's own
severity-threshold gate:

* `0` — scan completed, no findings at or above the threshold.
* `1` — scan completed, at least one finding at or above the threshold, OR the
  scan could not run at all (CLI missing, browser missing, network failure).
  The JSON result on stdout carries `ok` (false only for the runtime-error
  case) and the raw CLI `exitCode`, so a caller can tell the two apart.

== Installation ==

1. Copy this directory to `wp-content/plugins/wordpress-ariada`.
2. Activate the plugin.
3. Install the Ariada CLI on the server path, or configure a hosted endpoint.
4. Open Tools -> Ariada Site Scan and run a page, post, or home-page scan.

== Frequently Asked Questions ==

= Does it add front-end JavaScript? =

No. It runs from wp-admin or WP-CLI and stores the latest report in options.

= Is hosted scanning required? =

No. Local CLI mode is the default. Hosted mode is opt-in.

= How do I gate a CI deploy on this? =

Run `wp ariada-site scan --url=<url> --severity-threshold=serious` and check
the exit code; a non-zero exit blocks the deploy.

== Changelog ==

= 0.1.0 =

* Initial general WordPress site-scan plugin.
* Added the REST report endpoint, WP-CLI severity-threshold/domains flags
  with correct threshold-breach exit codes, multi-domain selection in the
  settings page, and an activation capability notice.
