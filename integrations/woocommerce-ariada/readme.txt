=== Ariada for WooCommerce ===
Contributors: agonistdev
Tags: accessibility, woocommerce, wcag, eaa, checkout
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Scan WooCommerce product, cart, and checkout pages with the Ariada scanner.

== Description ==

Ariada for WooCommerce adds a WooCommerce admin scan panel and WP-CLI command
for store-page accessibility checks.

The plugin does not implement accessibility scanning itself. It discovers the
store URLs that matter to a WooCommerce merchant and sends each URL to one of
the supported Ariada boundaries:

* local CLI mode: `ariada scan <url> --domains accessibility`
* hosted mode: `POST /api/scan` on a configured Ariada scan endpoint

Local CLI mode keeps scanning on the merchant's server. Hosted mode is opt-in
and sends only the configured page URL plus scan options to the scan endpoint.

== Installation ==

1. Copy this directory to `wp-content/plugins/woocommerce-ariada`.
2. Activate WooCommerce.
3. Activate Ariada for WooCommerce.
4. Install the Ariada CLI on the server path, or configure a hosted endpoint.
5. Open WooCommerce -> Ariada Scan and run a product, cart, checkout, or all-page scan.

== WP-CLI ==

Run a scan from a WordPress shell:

`wp ariada-woocommerce scan --target=checkout`

Accepted targets are `product`, `cart`, `checkout`, and `all`.

== Frequently Asked Questions ==

= Does this replace WooCommerce checkout templates? =

No. It only scans store pages and stores the latest report in WordPress options.

= Does it inject front-end JavaScript? =

No. It runs from wp-admin or WP-CLI and does not add storefront scripts.

= Is the checkout scan local? =

Yes, when local CLI mode is selected. Hosted mode is explicit configuration.

== Changelog ==

= 0.1.0 =

* Initial WooCommerce scan panel and WP-CLI command.
