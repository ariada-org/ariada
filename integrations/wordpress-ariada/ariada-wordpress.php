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

register_activation_hook( __FILE__, 'ariada_wp_activate' );

add_action( 'admin_menu', 'ariada_wp_admin_menu' );
add_action( 'admin_post_ariada_wp_scan', 'ariada_wp_handle_scan' );
add_action( 'admin_notices', 'ariada_wp_capabilities_notice' );
add_action( 'rest_api_init', 'ariada_wp_register_rest_routes' );

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::add_command( 'ariada-site', 'Ariada_WP_CLI_Command' );
}

/**
 * The domain ids this plugin can pass to the Ariada CLI / hosted endpoint.
 * Mirrors @ariada-org/core-engine's registered DomainModule ids exactly —
 * keep in sync if a domain is renamed or a new one registers.
 *
 * @return string[]
 */
function ariada_wp_available_domains(): array {
	return array( 'accessibility', 'privacy', 'security', 'sustainability', 'structured-data', 'ai-readiness' );
}

/**
 * Filter an arbitrary list down to known domain ids, defaulting to
 * accessibility-only when nothing valid survives (never an empty scan).
 *
 * @param array $raw Untrusted domain list, e.g. from $_POST or a WP-CLI flag.
 * @return string[]
 */
function ariada_wp_sanitize_domains( array $raw ): array {
	$allowed = ariada_wp_available_domains();
	$clean   = array();
	foreach ( $raw as $domain ) {
		$domain = sanitize_key( trim( (string) $domain ) );
		if ( in_array( $domain, $allowed, true ) ) {
			$clean[] = $domain;
		}
	}
	return array() === $clean ? array( 'accessibility' ) : array_values( array_unique( $clean ) );
}

function ariada_wp_config(): array {
	$defaults = array(
		'mode'      => 'local',
		'binary'    => 'ariada',
		'endpoint'  => 'https://scan.ariada.org',
		'api_key'   => '',
		'threshold' => 'serious',
		'domains'   => array( 'accessibility' ),
	);
	$stored = get_option( 'ariada_wp_config', array() );
	$merged = array_merge( $defaults, is_array( $stored ) ? $stored : array() );
	$merged['domains'] = ariada_wp_sanitize_domains( is_array( $merged['domains'] ) ? $merged['domains'] : array() );
	return $merged;
}

/**
 * Activation-time capability probe, re-run whenever the admin notice finds
 * no cached result. Distinguishes "no CLI reachable" (proc_open/binary
 * absent, always hosted-mode capable) from "CLI present but no Playwright
 * browser installed" (per the PRD's activation-checker requirement) so the
 * two produce different admin notices.
 */
function ariada_wp_activate(): void {
	update_option( 'ariada_wp_capabilities', ariada_wp_detect_capabilities() );
}

/**
 * Best-effort local-mode capability detection. This is a heuristic, not a
 * guarantee: it shells out to `<binary> --version` to confirm the CLI is
 * reachable, then looks for a Playwright chromium browser in the standard
 * cache locations (or PLAYWRIGHT_BROWSERS_PATH when set). A custom install
 * location that isn't one of those will read as "browser absent" even when
 * a browser is in fact installed — the admin can always force hosted mode
 * from the settings page regardless of what this detects.
 *
 * @return array{proc_open: bool, node: bool, browser: bool, mode: string, checked_at: int}
 */
function ariada_wp_detect_capabilities(): array {
	$has_proc_open = function_exists( 'proc_open' );
	$binary        = (string) ariada_wp_config()['binary'];
	$has_binary    = $has_proc_open && 0 === ariada_wp_exec( array( $binary, '--version' ) );
	$has_browser   = $has_binary && ariada_wp_playwright_browser_present();
	return array(
		'proc_open'  => $has_proc_open,
		'node'       => $has_binary,
		'browser'    => $has_browser,
		'mode'       => ( $has_binary && $has_browser ) ? 'local' : 'hosted',
		'checked_at' => time(),
	);
}

/**
 * Heuristic filesystem check for an installed Playwright chromium browser.
 * See ariada_wp_detect_capabilities() doc-comment for the caveats.
 */
function ariada_wp_playwright_browser_present(): bool {
	$env_path = getenv( 'PLAYWRIGHT_BROWSERS_PATH' );
	if ( is_string( $env_path ) && '' !== $env_path && ariada_wp_dir_has_chromium( $env_path ) ) {
		return true;
	}
	$home = getenv( 'HOME' );
	$home = is_string( $home ) && '' !== $home ? $home : (string) getenv( 'USERPROFILE' );
	if ( '' === $home ) {
		return false;
	}
	foreach ( array( $home . '/Library/Caches/ms-playwright', $home . '/.cache/ms-playwright' ) as $dir ) {
		if ( ariada_wp_dir_has_chromium( $dir ) ) {
			return true;
		}
	}
	return false;
}

function ariada_wp_dir_has_chromium( string $dir ): bool {
	if ( ! is_dir( $dir ) ) {
		return false;
	}
	$matches = glob( rtrim( $dir, '/\\' ) . '/chromium*' );
	return is_array( $matches ) && count( $matches ) > 0;
}

/**
 * Admin notice distinguishing the three activation states the PRD requires:
 * local CLI mode active, hosted mode (no CLI reachable), and CLI present but
 * no browser installed. Only rendered on this plugin's own admin screen.
 */
function ariada_wp_capabilities_notice(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen instanceof WP_Screen && 'tools_page_ariada-wordpress' !== $screen->id ) {
		return;
	}
	$capabilities = get_option( 'ariada_wp_capabilities', array() );
	if ( ! is_array( $capabilities ) || empty( $capabilities ) ) {
		$capabilities = ariada_wp_detect_capabilities();
		update_option( 'ariada_wp_capabilities', $capabilities );
	}
	if ( empty( $capabilities['proc_open'] ) || empty( $capabilities['node'] ) ) {
		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__( 'Hosted scan mode — configure an API key. The Ariada CLI was not detected on this server.', 'ariada-wordpress' )
		);
		return;
	}
	if ( empty( $capabilities['browser'] ) ) {
		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__( 'Node.js detected but Playwright chromium not installed — run `npx playwright install chromium`.', 'ariada-wordpress' )
		);
		return;
	}
	printf(
		'<div class="notice notice-success"><p>%s</p></div>',
		esc_html__( 'Local CLI mode active — ariada binary detected.', 'ariada-wordpress' )
	);
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
				<tr>
					<th scope="row"><?php echo esc_html__( 'Domains', 'ariada-wordpress' ); ?></th>
					<td>
						<?php foreach ( ariada_wp_available_domains() as $domain ) : ?>
							<label style="display:block;">
								<input type="checkbox" name="domains[]" value="<?php echo esc_attr( $domain ); ?>" <?php checked( in_array( $domain, $config['domains'], true ) ); ?> />
								<?php echo esc_html( $domain ); ?>
							</label>
						<?php endforeach; ?>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="ariada_wp_threshold"><?php echo esc_html__( 'Severity threshold', 'ariada-wordpress' ); ?></label></th>
					<td>
						<select id="ariada_wp_threshold" name="threshold">
							<?php foreach ( array( 'minor', 'moderate', 'serious', 'critical' ) as $level ) : ?>
								<option value="<?php echo esc_attr( $level ); ?>" <?php selected( $config['threshold'], $level ); ?>><?php echo esc_html( $level ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr><th scope="row"><label for="ariada_wp_binary"><?php echo esc_html__( 'CLI binary', 'ariada-wordpress' ); ?></label></th><td><input id="ariada_wp_binary" class="regular-text" name="binary" value="<?php echo esc_attr( $config['binary'] ); ?>" /></td></tr>
				<tr><th scope="row"><label for="ariada_wp_endpoint"><?php echo esc_html__( 'Hosted endpoint', 'ariada-wordpress' ); ?></label></th><td><input id="ariada_wp_endpoint" class="regular-text" name="endpoint" value="<?php echo esc_url( $config['endpoint'] ); ?>" /></td></tr>
				<tr><th scope="row"><label for="ariada_wp_api_key"><?php echo esc_html__( 'API key', 'ariada-wordpress' ); ?></label></th><td><input id="ariada_wp_api_key" class="regular-text" type="password" name="api_key" value="<?php echo esc_attr( $config['api_key'] ); ?>" autocomplete="off" /></td></tr>
			</table>
			<?php submit_button( __( 'Scan rendered URL', 'ariada-wordpress' ) ); ?>
		</form>
		<h2><?php echo esc_html__( 'Latest result', 'ariada-wordpress' ); ?></h2>
		<?php ariada_wp_render_result( is_array( $last ) ? $last : array() ); ?>
		<h2><?php echo esc_html__( 'REST API', 'ariada-wordpress' ); ?></h2>
		<p><code>GET <?php echo esc_url( rest_url( 'ariada/v1/report' ) ); ?></code> — <?php echo esc_html__( 'returns the latest stored report as JSON for an authenticated request with the manage_options capability.', 'ariada-wordpress' ); ?></p>
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
			'mode'      => sanitize_key( wp_unslash( $_POST['mode'] ?? 'local' ) ),
			'binary'    => sanitize_text_field( wp_unslash( $_POST['binary'] ?? 'ariada' ) ),
			'endpoint'  => esc_url_raw( wp_unslash( $_POST['endpoint'] ?? 'https://scan.ariada.org' ) ),
			'api_key'   => sanitize_text_field( wp_unslash( $_POST['api_key'] ?? '' ) ),
			'threshold' => sanitize_key( wp_unslash( $_POST['threshold'] ?? 'serious' ) ),
			'domains'   => ariada_wp_sanitize_domains( wp_unslash( (array) ( $_POST['domains'] ?? array() ) ) ),
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
	$domains = ariada_wp_sanitize_domains( is_array( $config['domains'] ?? null ) ? $config['domains'] : array() );
	$res     = wp_remote_post(
		rtrim( (string) $config['endpoint'], '/' ) . '/api/scan',
		array(
			'headers' => array( 'Authorization' => 'Bearer ' . (string) $config['api_key'], 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array( 'url' => $url, 'domains' => $domains, 'severityThreshold' => $config['threshold'] ?? 'serious' ) ),
			'timeout' => 45,
		)
	);
	if ( is_wp_error( $res ) ) {
		return array( 'ok' => false, 'url' => $url, 'error' => $res->get_error_message() );
	}
	return array( 'ok' => true, 'url' => $url, 'report' => json_decode( wp_remote_retrieve_body( $res ), true ) ?: array() );
}

/**
 * Run the local CLI scan and return a result that always carries the raw
 * `exitCode`. The Ariada CLI's own severity-threshold gate is authoritative
 * (exit 0 = no findings at/above threshold, exit 1 = threshold breached,
 * anything else = a runtime error) — this function does not re-derive a
 * verdict from the report JSON, it just reports what the CLI already
 * decided so WP-CLI can propagate the correct exit code (see
 * Ariada_WP_CLI_Command::scan()).
 */
function ariada_wp_cli_scan( string $url, array $config ): array {
	$out = wp_tempnam( 'ariada-wordpress' );
	if ( ! $out ) {
		return array( 'ok' => false, 'url' => $url, 'error' => 'Unable to allocate a temporary scan file.', 'exitCode' => -1 );
	}
	unlink( $out );
	mkdir( $out, 0700, true );
	$domains = ariada_wp_sanitize_domains( is_array( $config['domains'] ?? null ) ? $config['domains'] : array() );
	$code    = ariada_wp_exec(
		array(
			(string) ( $config['binary'] ?? 'ariada' ),
			'scan',
			$url,
			'--domains',
			implode( ',', $domains ),
			'--format',
			'json',
			'--output-dir',
			$out,
			'--severity-threshold',
			(string) ( $config['threshold'] ?? 'serious' ),
		)
	);
	$json = is_readable( $out . '/report.json' ) ? file_get_contents( $out . '/report.json' ) : false;
	ariada_wp_rm_rf( $out );
	if ( in_array( $code, array( 0, 1 ), true ) && is_string( $json ) ) {
		return array( 'ok' => true, 'url' => $url, 'report' => json_decode( $json, true ) ?: array(), 'exitCode' => $code );
	}
	return array( 'ok' => false, 'url' => $url, 'error' => 'Ariada CLI exited with code ' . (string) $code . '.', 'exitCode' => $code );
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
	if ( isset( $result['exitCode'] ) ) {
		printf( '<p>%s %d</p>', esc_html__( 'CLI exit code:', 'ariada-wordpress' ), (int) $result['exitCode'] );
	}
	if ( ! empty( $result['error'] ) ) {
		printf( '<p>%s</p>', esc_html( (string) $result['error'] ) );
	}
	printf( '<pre>%s</pre>', esc_html( wp_json_encode( $result['report'] ?? array(), JSON_PRETTY_PRINT ) ?: '{}' ) );
}

/**
 * REST API: GET /wp-json/ariada/v1/report — the latest stored report,
 * requires the manage_options capability. WordPress's REST framework
 * returns 401 automatically for an unauthenticated request against a route
 * whose permission_callback denies access.
 */
function ariada_wp_register_rest_routes(): void {
	register_rest_route(
		'ariada/v1',
		'/report',
		array(
			'methods'             => 'GET',
			'callback'            => 'ariada_wp_rest_get_report',
			'permission_callback' => 'ariada_wp_rest_permission',
		)
	);
}

function ariada_wp_rest_permission(): bool {
	return current_user_can( 'manage_options' );
}

function ariada_wp_rest_get_report( WP_REST_Request $request ): WP_REST_Response {
	$last = get_option( 'ariada_wp_last_report', array() );
	if ( empty( $last ) ) {
		return new WP_REST_Response( array( 'ok' => false, 'error' => 'no_scan_yet' ), 404 );
	}
	return new WP_REST_Response( $last, 200 );
}

final class Ariada_WP_CLI_Command {
	/**
	 * Run a scan from WP-CLI.
	 *
	 * ## OPTIONS
	 *
	 * [--url=<url>]
	 * : URL to scan. Defaults to the site's home URL.
	 *
	 * [--severity-threshold=<level>]
	 * : minor | moderate | serious | critical. Overrides the stored setting.
	 *
	 * [--domains=<list>]
	 * : Comma-separated domain ids, e.g. accessibility,privacy. Overrides the stored setting.
	 *
	 * ## EXAMPLES
	 *
	 *     wp ariada-site scan --url=https://example.test --severity-threshold=serious
	 *
	 * @when after_wp_load
	 */
	public function scan( array $args, array $assoc_args ): void {
		$config = ariada_wp_config();
		if ( isset( $assoc_args['severity-threshold'] ) ) {
			$config['threshold'] = sanitize_key( (string) $assoc_args['severity-threshold'] );
		}
		if ( isset( $assoc_args['domains'] ) ) {
			$config['domains'] = ariada_wp_sanitize_domains( explode( ',', (string) $assoc_args['domains'] ) );
		}
		$url    = isset( $assoc_args['url'] ) ? esc_url_raw( (string) $assoc_args['url'] ) : home_url( '/' );
		$result = ariada_wp_run_scan( $url, $config );
		WP_CLI::line( wp_json_encode( $result, JSON_PRETTY_PRINT ) ?: '{}' );

		if ( empty( $result['ok'] ) ) {
			// Runtime error (CLI missing, browser missing, network failure, ...).
			WP_CLI::halt( 1 );
		}
		if ( 1 === (int) ( $result['exitCode'] ?? 0 ) ) {
			// A successful scan whose findings breached --severity-threshold.
			WP_CLI::halt( 1 );
		}
	}
}
