<?php
/**
 * Plugin Name: Ariada for WooCommerce
 * Description: Scan WooCommerce product, cart, and checkout pages with the Ariada CLI or hosted scan endpoint.
 * Version: 0.1.0
 * Author: Alexander Brichkin (Agonist Development AB)
 * License: GPL-2.0-or-later
 * Text Domain: ariada-woocommerce
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * WC requires at least: 8.0
 *
 * @package AriadaWooCommerce
 */

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_menu', 'ariada_woo_admin_menu' );
add_action( 'admin_post_ariada_woo_scan', 'ariada_woo_handle_scan' );

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::add_command( 'ariada-woocommerce', 'Ariada_Woo_CLI_Command' );
}
function ariada_woo_capability(): string {
	return current_user_can( 'manage_woocommerce' ) ? 'manage_woocommerce' : 'manage_options';
}
function ariada_woo_config(): array {
	$defaults = array(
		'mode'      => 'local',
		'binary'    => 'ariada',
		'endpoint'  => 'https://scan.ariada.org',
		'api_key'   => '',
		'threshold' => 'serious',
	);
	$stored = get_option( 'ariada_woo_config', array() );
	return array_merge( $defaults, is_array( $stored ) ? $stored : array() );
}
function ariada_woo_admin_menu(): void {
	$parent = class_exists( 'WooCommerce' ) ? 'woocommerce' : 'options-general.php';
	add_submenu_page(
		$parent,
		__( 'Ariada WooCommerce Scan', 'ariada-woocommerce' ),
		__( 'Ariada Scan', 'ariada-woocommerce' ),
		ariada_woo_capability(),
		'ariada-woocommerce',
		'ariada_woo_admin_page'
	);
}
function ariada_woo_admin_page(): void {
	if ( ! current_user_can( ariada_woo_capability() ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'ariada-woocommerce' ) );
	}
	$config = ariada_woo_config();
	$last   = get_option( 'ariada_woo_last_report', array() );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'Ariada WooCommerce Scan', 'ariada-woocommerce' ); ?></h1>
		<?php if ( ! class_exists( 'WooCommerce' ) ) : ?>
			<div class="notice notice-warning"><p><?php echo esc_html__( 'WooCommerce is not active. Activate it to scan product, cart, and checkout pages.', 'ariada-woocommerce' ); ?></p></div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="ariada_woo_scan" />
			<?php wp_nonce_field( 'ariada_woo_scan' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><label for="ariada_woo_target"><?php echo esc_html__( 'Store page', 'ariada-woocommerce' ); ?></label></th><td><select id="ariada_woo_target" name="target"><option value="all">All store pages</option><option value="product">Product</option><option value="cart">Cart</option><option value="checkout">Checkout</option></select></td></tr>
				<tr><th scope="row"><label for="ariada_woo_mode"><?php echo esc_html__( 'Runner', 'ariada-woocommerce' ); ?></label></th><td><select id="ariada_woo_mode" name="mode"><option value="local" <?php selected( $config['mode'], 'local' ); ?>>Local CLI</option><option value="hosted" <?php selected( $config['mode'], 'hosted' ); ?>>Hosted API</option></select></td></tr>
				<tr><th scope="row"><label for="ariada_woo_binary"><?php echo esc_html__( 'CLI binary', 'ariada-woocommerce' ); ?></label></th><td><input id="ariada_woo_binary" class="regular-text" name="binary" value="<?php echo esc_attr( $config['binary'] ); ?>" /></td></tr>
				<tr><th scope="row"><label for="ariada_woo_endpoint"><?php echo esc_html__( 'Hosted endpoint', 'ariada-woocommerce' ); ?></label></th><td><input id="ariada_woo_endpoint" class="regular-text" name="endpoint" value="<?php echo esc_url( $config['endpoint'] ); ?>" /></td></tr>
				<tr><th scope="row"><label for="ariada_woo_api_key"><?php echo esc_html__( 'API key', 'ariada-woocommerce' ); ?></label></th><td><input id="ariada_woo_api_key" class="regular-text" type="password" name="api_key" value="<?php echo esc_attr( $config['api_key'] ); ?>" autocomplete="off" /></td></tr>
			</table>
			<?php submit_button( __( 'Run scan', 'ariada-woocommerce' ) ); ?>
		</form>
		<h2><?php echo esc_html__( 'Latest result', 'ariada-woocommerce' ); ?></h2>
		<?php if ( empty( $last ) || ! is_array( $last ) ) : ?>
			<p><?php echo esc_html__( 'No WooCommerce scan has been stored yet.', 'ariada-woocommerce' ); ?></p>
		<?php else : ?>
			<table class="widefat striped"><thead><tr><th>Page</th><th>URL</th><th>Status</th><th>Finding count</th></tr></thead><tbody>
			<?php foreach ( $last as $name => $row ) : ?>
				<tr><td><?php echo esc_html( (string) $name ); ?></td><td><?php echo esc_html( (string) ( $row['url'] ?? '' ) ); ?></td><td><?php echo esc_html( ! empty( $row['ok'] ) ? 'scanned' : 'failed' ); ?></td><td><?php echo esc_html( (string) ariada_woo_count_findings( (array) ( $row['report'] ?? array() ) ) ); ?></td></tr>
			<?php endforeach; ?>
			</tbody></table>
		<?php endif; ?>
	</div>
	<?php
}
function ariada_woo_handle_scan(): void {
	check_admin_referer( 'ariada_woo_scan' );
	if ( ! current_user_can( ariada_woo_capability() ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'ariada-woocommerce' ) );
	}
	$config = array(
		'mode'     => sanitize_key( wp_unslash( $_POST['mode'] ?? 'local' ) ),
		'binary'   => sanitize_text_field( wp_unslash( $_POST['binary'] ?? 'ariada' ) ),
		'endpoint' => esc_url_raw( wp_unslash( $_POST['endpoint'] ?? 'https://scan.ariada.org' ) ),
		'api_key'  => sanitize_text_field( wp_unslash( $_POST['api_key'] ?? '' ) ),
	);
	$config = array_merge( ariada_woo_config(), $config );
	update_option( 'ariada_woo_config', $config );
	update_option( 'ariada_woo_last_report', ariada_woo_scan_targets( sanitize_key( wp_unslash( $_POST['target'] ?? 'all' ) ), $config ) );
	wp_safe_redirect( admin_url( 'admin.php?page=ariada-woocommerce' ) );
	exit;
}
function ariada_woo_targets( string $target ): array {
	$targets = array();
	if ( in_array( $target, array( 'all', 'product' ), true ) ) {
		$product = get_posts( array( 'post_type' => 'product', 'post_status' => 'publish', 'numberposts' => 1 ) );
		if ( $product ) {
			$targets['product'] = get_permalink( $product[0] );
		}
	}
	if ( in_array( $target, array( 'all', 'cart' ), true ) && function_exists( 'wc_get_cart_url' ) ) {
		$targets['cart'] = wc_get_cart_url();
	}
	if ( in_array( $target, array( 'all', 'checkout' ), true ) && function_exists( 'wc_get_checkout_url' ) ) {
		$targets['checkout'] = wc_get_checkout_url();
	}
	return array_filter( $targets );
}
function ariada_woo_scan_targets( string $target, array $config ): array {
	$results = array();
	foreach ( ariada_woo_targets( $target ) as $name => $url ) {
		$results[ $name ]        = ariada_woo_run_scan( (string) $url, $config );
		$results[ $name ]['url'] = (string) $url;
	}
	return $results;
}
function ariada_woo_run_scan( string $url, array $config ): array {
	if ( 'hosted' === ( $config['mode'] ?? 'local' ) ) {
		$body = wp_json_encode( array( 'url' => $url, 'domains' => array( 'accessibility' ), 'severityThreshold' => $config['threshold'] ?? 'serious' ) );
		$res  = wp_remote_post( rtrim( (string) $config['endpoint'], '/' ) . '/api/scan', array( 'headers' => array( 'Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . (string) $config['api_key'] ), 'body' => $body, 'timeout' => 45 ) );
		if ( is_wp_error( $res ) ) {
			return array( 'ok' => false, 'error' => $res->get_error_message() );
		}
		return array( 'ok' => true, 'report' => json_decode( wp_remote_retrieve_body( $res ), true ) ?: array() );
	}
	$out = wp_tempnam( 'ariada-woo' );
	if ( ! $out ) {
		return array( 'ok' => false, 'error' => 'Unable to allocate a temporary scan file.' );
	}
	unlink( $out );
	mkdir( $out, 0700, true );
	$code = ariada_woo_exec(
		array(
			(string) ( $config['binary'] ?? 'ariada' ),
			'scan',
			$url,
			'--domains',
			'accessibility',
			'--format',
			'json',
			'--output-dir',
			$out,
			'--severity-threshold',
			(string) ( $config['threshold'] ?? 'serious' ),
		)
	);
	$json = is_readable( $out . '/report.json' ) ? file_get_contents( $out . '/report.json' ) : false;
	ariada_woo_rm_rf( $out );
	if ( in_array( $code, array( 0, 1 ), true ) && is_string( $json ) ) {
		return array( 'ok' => true, 'report' => json_decode( $json, true ) ?: array() );
	}
	return array( 'ok' => false, 'error' => 'Ariada CLI exited with code ' . (string) $code . '.' );
}
function ariada_woo_exec( array $cmd ): int {
	if ( ! function_exists( 'proc_open' ) ) {
		return -1;
	}
	$proc = proc_open( $cmd, array( 0 => array( 'pipe', 'r' ), 1 => array( 'pipe', 'w' ), 2 => array( 'pipe', 'w' ) ), $pipes );
	if ( ! is_resource( $proc ) ) {
		return -1;
	}
	foreach ( $pipes as $pipe ) {
		stream_get_contents( $pipe );
		fclose( $pipe );
	}
	return proc_close( $proc );
}
function ariada_woo_rm_rf( string $dir ): void {
	foreach ( glob( $dir . '/*' ) ?: array() as $path ) {
		is_dir( $path ) ? ariada_woo_rm_rf( $path ) : unlink( $path );
	}
	is_dir( $dir ) && rmdir( $dir );
}
function ariada_woo_count_findings( array $report ): int {
	$count = 0;
	foreach ( (array) ( $report['grid'] ?? array() ) as $domains ) {
		foreach ( (array) $domains as $findings ) {
			$count += count( (array) $findings );
		}
	}
	return $count;
}

class Ariada_Woo_CLI_Command {
	public function scan( array $args, array $assoc_args ): void {
		$target  = (string) \WP_CLI\Utils\get_flag_value( $assoc_args, 'target', 'all' );
		$results = ariada_woo_scan_targets( $target, ariada_woo_config() );
		update_option( 'ariada_woo_last_report', $results );
		if ( 'json' === \WP_CLI\Utils\get_flag_value( $assoc_args, 'format', 'summary' ) ) {
			\WP_CLI::print_value( $results, array( 'format' => 'json' ) );
			return;
		}
		\WP_CLI::success( 'Ariada WooCommerce scan completed for ' . count( $results ) . ' page(s).' );
	}
}
