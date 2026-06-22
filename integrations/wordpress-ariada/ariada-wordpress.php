<?php
/**
 * Plugin Name: Ariada Site Accessibility Scan
 * Description: Scan rendered WordPress pages and posts with the Ariada CLI or hosted scan API.
 * Version: 0.1.0
 * Author: Alexander Brichkin (Agonist Development AB)
 * License: GPL-2.0-or-later
 * Text Domain: ariada-wordpress
 * Requires at least: 6.4
 * Requires PHP: 8.1
 *
 * @package AriadaWordPress
 */

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_menu', 'ariada_wp_admin_menu' );
add_action( 'admin_post_ariada_wp_scan', 'ariada_wp_handle_scan' );

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::add_command( 'ariada-site', 'Ariada_WP_CLI_Command' );
}

function ariada_wp_config(): array {
	$defaults = array(
		'mode'      => 'local',
		'binary'    => 'ariada',
		'endpoint'  => 'https://scan.ariada.org',
		'api_key'   => '',
		'threshold' => 'serious',
	);
	$stored = get_option( 'ariada_wp_config', array() );
	return array_merge( $defaults, is_array( $stored ) ? $stored : array() );
}

function ariada_wp_admin_menu(): void {
	add_management_page(
		__( 'Ariada Site Scan', 'ariada-wordpress' ),
		__( 'Ariada Site Scan', 'ariada-wordpress' ),
		'manage_options',
		'ariada-wordpress',
		'ariada_wp_admin_page'
	);
}

function ariada_wp_admin_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'ariada-wordpress' ) );
	}
	$config = ariada_wp_config();
	$last   = get_option( 'ariada_wp_last_report', array() );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'Ariada Site Scan', 'ariada-wordpress' ); ?></h1>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="ariada_wp_scan" />
			<?php wp_nonce_field( 'ariada_wp_scan' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><label for="ariada_wp_target"><?php echo esc_html__( 'Page to scan', 'ariada-wordpress' ); ?></label></th><td><select id="ariada_wp_target" name="target"><?php ariada_wp_target_options(); ?></select></td></tr>
				<tr><th scope="row"><label for="ariada_wp_mode"><?php echo esc_html__( 'Runner', 'ariada-wordpress' ); ?></label></th><td><select id="ariada_wp_mode" name="mode"><option value="local" <?php selected( $config['mode'], 'local' ); ?>>Local CLI</option><option value="hosted" <?php selected( $config['mode'], 'hosted' ); ?>>Hosted API</option></select></td></tr>
				<tr><th scope="row"><label for="ariada_wp_binary"><?php echo esc_html__( 'CLI binary', 'ariada-wordpress' ); ?></label></th><td><input id="ariada_wp_binary" class="regular-text" name="binary" value="<?php echo esc_attr( $config['binary'] ); ?>" /></td></tr>
				<tr><th scope="row"><label for="ariada_wp_endpoint"><?php echo esc_html__( 'Hosted endpoint', 'ariada-wordpress' ); ?></label></th><td><input id="ariada_wp_endpoint" class="regular-text" name="endpoint" value="<?php echo esc_url( $config['endpoint'] ); ?>" /></td></tr>
				<tr><th scope="row"><label for="ariada_wp_api_key"><?php echo esc_html__( 'API key', 'ariada-wordpress' ); ?></label></th><td><input id="ariada_wp_api_key" class="regular-text" type="password" name="api_key" value="<?php echo esc_attr( $config['api_key'] ); ?>" autocomplete="off" /></td></tr>
			</table>
			<?php submit_button( __( 'Scan rendered URL', 'ariada-wordpress' ) ); ?>
		</form>
		<h2><?php echo esc_html__( 'Latest result', 'ariada-wordpress' ); ?></h2>
		<?php ariada_wp_render_result( is_array( $last ) ? $last : array() ); ?>
	</div>
	<?php
}

function ariada_wp_target_options(): void {
	echo '<option value="home">' . esc_html__( 'Home page', 'ariada-wordpress' ) . '</option>';
	foreach ( get_posts( array( 'post_type' => array( 'page', 'post' ), 'post_status' => 'publish', 'numberposts' => 50 ) ) as $post ) {
		printf( '<option value="%d">%s</option>', (int) $post->ID, esc_html( get_the_title( $post ) ) );
	}
}

function ariada_wp_handle_scan(): void {
	check_admin_referer( 'ariada_wp_scan' );
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Insufficient permissions.', 'ariada-wordpress' ) );
	}
	$config = array_merge(
		ariada_wp_config(),
		array(
			'mode'     => sanitize_key( wp_unslash( $_POST['mode'] ?? 'local' ) ),
			'binary'   => sanitize_text_field( wp_unslash( $_POST['binary'] ?? 'ariada' ) ),
			'endpoint' => esc_url_raw( wp_unslash( $_POST['endpoint'] ?? 'https://scan.ariada.org' ) ),
			'api_key'  => sanitize_text_field( wp_unslash( $_POST['api_key'] ?? '' ) ),
		)
	);
	update_option( 'ariada_wp_config', $config );
	update_option( 'ariada_wp_last_report', ariada_wp_run_scan( ariada_wp_target_url( sanitize_text_field( wp_unslash( $_POST['target'] ?? 'home' ) ) ), $config ) );
	wp_safe_redirect( admin_url( 'tools.php?page=ariada-wordpress' ) );
	exit;
}

function ariada_wp_target_url( string $target ): string {
	if ( 'home' === $target ) {
		return home_url( '/' );
	}
	$url = get_permalink( (int) $target );
	return is_string( $url ) && '' !== $url ? $url : home_url( '/' );
}

function ariada_wp_run_scan( string $url, array $config ): array {
	if ( 'hosted' === ( $config['mode'] ?? 'local' ) ) {
		return ariada_wp_hosted_scan( $url, $config );
	}
	return ariada_wp_cli_scan( $url, $config );
}

function ariada_wp_hosted_scan( string $url, array $config ): array {
	$res = wp_remote_post(
		rtrim( (string) $config['endpoint'], '/' ) . '/api/scan',
		array(
			'headers' => array( 'Authorization' => 'Bearer ' . (string) $config['api_key'], 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array( 'url' => $url, 'domains' => array( 'accessibility' ), 'severityThreshold' => $config['threshold'] ?? 'serious' ) ),
			'timeout' => 45,
		)
	);
	if ( is_wp_error( $res ) ) {
		return array( 'ok' => false, 'url' => $url, 'error' => $res->get_error_message() );
	}
	return array( 'ok' => true, 'url' => $url, 'report' => json_decode( wp_remote_retrieve_body( $res ), true ) ?: array() );
}

function ariada_wp_cli_scan( string $url, array $config ): array {
	$out = wp_tempnam( 'ariada-wordpress' );
	if ( ! $out ) {
		return array( 'ok' => false, 'url' => $url, 'error' => 'Unable to allocate a temporary scan file.' );
	}
	unlink( $out );
	mkdir( $out, 0700, true );
	$code = ariada_wp_exec( array( (string) ( $config['binary'] ?? 'ariada' ), 'scan', $url, '--domains', 'accessibility', '--format', 'json', '--output-dir', $out, '--severity-threshold', (string) ( $config['threshold'] ?? 'serious' ) ) );
	$json = is_readable( $out . '/report.json' ) ? file_get_contents( $out . '/report.json' ) : false;
	ariada_wp_rm_rf( $out );
	if ( in_array( $code, array( 0, 1 ), true ) && is_string( $json ) ) {
		return array( 'ok' => true, 'url' => $url, 'report' => json_decode( $json, true ) ?: array() );
	}
	return array( 'ok' => false, 'url' => $url, 'error' => 'Ariada CLI exited with code ' . (string) $code . '.' );
}

function ariada_wp_exec( array $cmd ): int {
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

function ariada_wp_rm_rf( string $path ): void {
	if ( ! is_dir( $path ) ) {
		return;
	}
	foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $path, RecursiveDirectoryIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST ) as $item ) {
		$item->isDir() ? rmdir( $item->getPathname() ) : unlink( $item->getPathname() );
	}
	rmdir( $path );
}

function ariada_wp_render_result( array $result ): void {
	if ( empty( $result ) ) {
		echo '<p>' . esc_html__( 'No site scan has been stored yet.', 'ariada-wordpress' ) . '</p>';
		return;
	}
	printf( '<p><strong>%s</strong> %s</p>', esc_html( ! empty( $result['ok'] ) ? 'scanned' : 'failed' ), esc_html( (string) ( $result['url'] ?? '' ) ) );
	if ( ! empty( $result['error'] ) ) {
		printf( '<p>%s</p>', esc_html( (string) $result['error'] ) );
	}
	printf( '<pre>%s</pre>', esc_html( wp_json_encode( $result['report'] ?? array(), JSON_PRETTY_PRINT ) ?: '{}' ) );
}

final class Ariada_WP_CLI_Command {
	public function scan( array $args, array $assoc_args ): void {
		$url    = isset( $assoc_args['url'] ) ? esc_url_raw( (string) $assoc_args['url'] ) : home_url( '/' );
		$result = ariada_wp_run_scan( $url, ariada_wp_config() );
		WP_CLI::line( wp_json_encode( $result, JSON_PRETTY_PRINT ) ?: '{}' );
		if ( empty( $result['ok'] ) ) {
			WP_CLI::halt( 1 );
		}
	}
}
