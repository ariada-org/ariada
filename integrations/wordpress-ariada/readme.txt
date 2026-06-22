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

* local CLI mode: `ariada scan <url> --domains accessibility`
* hosted mode: `POST /api/scan` on a configured Ariada endpoint

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

== Changelog ==

= 0.1.0 =

* Initial general WordPress site-scan plugin.
