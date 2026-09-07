<?php
/**
 * Plugin Name: Ariada Accessibility for LearnDash
 * Description: Scan rendered LearnDash course and lesson pages with the Ariada CLI and review WCAG findings in WordPress.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Requires Plugins: sfwd-lms
 * Author: Alexander Brichkin (Agonist Development AB)
 * Author URI: https://ariada.org
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: learndash-ariada
 * Domain Path: /languages
 *
 * @package AriadaLearnDash
 */

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ARIADA_LEARNDASH_VERSION', '1.0.0' );
define( 'ARIADA_LEARNDASH_FILE', __FILE__ );
define( 'ARIADA_LEARNDASH_DIR', plugin_dir_path( __FILE__ ) );

require_once ARIADA_LEARNDASH_DIR . 'src/class-report.php';
require_once ARIADA_LEARNDASH_DIR . 'src/class-clirunner.php';
require_once ARIADA_LEARNDASH_DIR . 'src/class-plugin.php';
require_once ARIADA_LEARNDASH_DIR . 'src/class-wpclicommand.php';

register_activation_hook( ARIADA_LEARNDASH_FILE, array( '\Ariada\LearnDash\Plugin', 'activate' ) );

/**
 * Boot the add-on after all plugins have loaded.
 */
function ariada_learndash_boot(): void {
	$plugin = new \Ariada\LearnDash\Plugin();
	$plugin->register();

	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		\WP_CLI::add_command( 'ariada-learndash', new \Ariada\LearnDash\WpCliCommand( $plugin ) );
	}
}

add_action( 'plugins_loaded', 'ariada_learndash_boot' );
