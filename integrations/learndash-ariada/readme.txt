=== Ariada Accessibility for LearnDash ===
Contributors: agonistdev
Tags: accessibility, learndash, lms, wcag, eaa
Requires at least: 6.5
Tested up to: 6.5
Requires PHP: 8.1
Requires Plugins: sfwd-lms
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Scan rendered LearnDash course and lesson pages with Ariada and review WCAG findings in WordPress.

== Description ==

Ariada Accessibility for LearnDash adds an accessibility report screen to
LearnDash administration and a report meta box to course and lesson editors.

Scans are delegated to a server-installed Ariada CLI. This add-on does not
reimplement scanning and does not inject scripts into learner pages.

Features:

* Published course and lesson inventory.
* Administrator-triggered, same-origin rendered-page scans.
* Severity totals and full normalized WCAG finding reports.
* Stale-report tracking when course or lesson content changes.
* WP-CLI command for controlled automation.
* Current scan.json and legacy direct-report parsing.

== Installation ==

1. Install and activate a licensed LearnDash plugin.
2. Install the Ariada CLI and its Playwright browser on the WordPress server.
3. Upload and activate this plugin.
4. If needed, define ARIADA_LEARNDASH_CLI in wp-config.php with the absolute CLI path.
5. Open LearnDash > Accessibility Reports.

== Frequently Asked Questions ==

= Does this plugin scan in the learner's browser? =

No. An administrator explicitly starts a server-side CLI scan. No front-end
JavaScript is injected.

= Does it send pages to a hosted service? =

No. Version 1.0.0 uses only the locally configured Ariada CLI.

= What happens for protected lesson content? =

The CLI scans the page visible to an anonymous browser. If LearnDash redirects
that browser to an enrollment or login gate, that rendered gate is what is
reported.

= Why is LearnDash not bundled? =

LearnDash is separately licensed commercial software. This package neither
contains nor downloads it.

== Changelog ==

= 1.0.0 =

* Initial production release with admin reports, CLI delegation, tests,
  packaging, and a licensed-sandbox smoke gate.
