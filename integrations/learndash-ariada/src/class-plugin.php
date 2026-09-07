<?php
/**
 * WordPress and LearnDash integration.
 *
 * @package AriadaLearnDash
 */

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Ariada\LearnDash;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers admin UI, LearnDash hooks, report storage, and scan actions.
 */
final class Plugin {

	public const OPTION_SETTINGS = 'ariada_learndash_settings';
	public const META_REPORT     = '_ariada_learndash_report';

	private const PAGE_SLUG  = 'learndash-ariada';
	private const CAPABILITY = 'manage_options';
	private const POST_TYPES = array( 'sfwd-courses', 'sfwd-lessons' );

	/**
	 * Whether a submenu was registered through LearnDash.
	 *
	 * @var bool
	 */
	private bool $menu_registered = false;

	/**
	 * Add hooks.
	 */
	public function register(): void {
		add_action( 'learndash_admin_menu', array( $this, 'register_learndash_menu' ), 10, 1 );
		add_action( 'admin_menu', array( $this, 'register_fallback_menu' ), 999 );
		add_action( 'admin_notices', array( $this, 'render_admin_notices' ) );
		add_action( 'admin_post_ariada_learndash_scan', array( $this, 'handle_scan' ) );
		add_action( 'admin_post_ariada_learndash_save_settings', array( $this, 'handle_save_settings' ) );
		add_action( 'add_meta_boxes_sfwd-courses', array( $this, 'register_report_meta_box' ) );
		add_action( 'add_meta_boxes_sfwd-lessons', array( $this, 'register_report_meta_box' ) );
		add_action( 'save_post_sfwd-courses', array( $this, 'mark_report_stale' ), 10, 3 );
		add_action( 'save_post_sfwd-lessons', array( $this, 'mark_report_stale' ), 10, 3 );
		add_filter( 'plugin_action_links_' . plugin_basename( ARIADA_LEARNDASH_FILE ), array( $this, 'plugin_action_links' ) );
	}

	/**
	 * Activation requirements and defaults.
	 */
	public static function activate(): void {
		global $wp_version;
		if ( version_compare( PHP_VERSION, '8.1', '<' ) ) {
			wp_die( esc_html__( 'Ariada Accessibility for LearnDash requires PHP 8.1 or newer.', 'learndash-ariada' ) );
		}
		if ( version_compare( (string) $wp_version, '6.5', '<' ) ) {
			wp_die( esc_html__( 'Ariada Accessibility for LearnDash requires WordPress 6.5 or newer.', 'learndash-ariada' ) );
		}
		add_option( self::OPTION_SETTINGS, self::default_settings(), '', false );
	}

	/**
	 * Register under LearnDash using its supported add-on hook.
	 *
	 * @param string $parent_slug LearnDash menu parent.
	 */
	public function register_learndash_menu( string $parent_slug ): void {
		$this->add_menu( $parent_slug );
	}

	/**
	 * Register a Tools fallback when LearnDash is unavailable or too old.
	 */
	public function register_fallback_menu(): void {
		if ( ! $this->menu_registered ) {
			$this->add_menu( 'tools.php' );
		}
	}

	/**
	 * Add the report submenu.
	 *
	 * @param string $parent_slug Parent menu slug.
	 */
	private function add_menu( string $parent_slug ): void {
		add_submenu_page(
			$parent_slug,
			__( 'Ariada LearnDash Reports', 'learndash-ariada' ),
			__( 'Accessibility Reports', 'learndash-ariada' ),
			self::CAPABILITY,
			self::PAGE_SLUG,
			array( $this, 'render_admin_page' )
		);
		$this->menu_registered = true;
	}

	/**
	 * Add a Reports shortcut.
	 *
	 * @param array<int,string> $links Existing links.
	 * @return array<int,string>
	 */
	public function plugin_action_links( array $links ): array {
		array_unshift(
			$links,
			'<a href="' . esc_url( $this->admin_page_url() ) . '">' . esc_html__( 'Reports', 'learndash-ariada' ) . '</a>'
		);
		return $links;
	}

	/**
	 * Render dependency and action notices.
	 */
	public function render_admin_notices(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}
		if ( ! self::is_learndash_active() ) {
			echo '<div class="notice notice-warning"><p>';
			echo esc_html__( 'Ariada Accessibility for LearnDash is inactive until the licensed LearnDash plugin is installed and activated.', 'learndash-ariada' );
			echo '</p></div>';
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin notice navigation.
		$notice   = isset( $_GET['ariada_notice'] ) ? sanitize_key( wp_unslash( $_GET['ariada_notice'] ) ) : '';
		$messages = array(
			'scanned'        => array( 'success', __( 'The rendered LearnDash page was scanned and its report was stored.', 'learndash-ariada' ) ),
			'settings_saved' => array( 'success', __( 'Ariada LearnDash settings were saved.', 'learndash-ariada' ) ),
			'scan_failed'    => array( 'error', __( 'The scan failed. Review the page row for the recorded error.', 'learndash-ariada' ) ),
			'invalid_target' => array( 'error', __( 'The requested scan target is not a published LearnDash course or lesson.', 'learndash-ariada' ) ),
		);
		if ( isset( $messages[ $notice ] ) ) {
			printf(
				'<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>',
				esc_attr( $messages[ $notice ][0] ),
				esc_html( $messages[ $notice ][1] )
			);
		}
	}

	/**
	 * Render report list or one full report.
	 */
	public function render_admin_page(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You are not allowed to view LearnDash accessibility reports.', 'learndash-ariada' ) );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only report navigation.
		$report_id = isset( $_GET['report_id'] ) ? absint( wp_unslash( $_GET['report_id'] ) ) : 0;
		if ( $report_id > 0 ) {
			$this->render_full_report( $report_id );
			return;
		}

		$settings = self::settings();
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only pagination.
		$paged = isset( $_GET['paged'] ) ? max( 1, absint( wp_unslash( $_GET['paged'] ) ) ) : 1;
		$query = new \WP_Query(
			array(
				'post_type'      => self::POST_TYPES,
				'post_status'    => 'publish',
				'posts_per_page' => 20,
				'paged'          => $paged,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			)
		);
		?>
		<div class="wrap">
			<h1><?php echo esc_html__( 'LearnDash Accessibility Reports', 'learndash-ariada' ); ?></h1>
			<p><?php echo esc_html__( 'Scans run only when an administrator requests them. No front-end JavaScript is injected.', 'learndash-ariada' ); ?></p>
			<h2><?php echo esc_html__( 'Scanner settings', 'learndash-ariada' ); ?></h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="ariada_learndash_save_settings" />
				<?php wp_nonce_field( 'ariada_learndash_save_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php echo esc_html__( 'CLI executable', 'learndash-ariada' ); ?></th>
						<td><code><?php echo esc_html( self::cli_binary() ); ?></code><p class="description"><?php echo esc_html__( 'Set ARIADA_LEARNDASH_CLI in wp-config.php to use an absolute path.', 'learndash-ariada' ); ?></p></td>
					</tr>
					<tr>
						<th scope="row"><label for="ariada-threshold"><?php echo esc_html__( 'Severity threshold', 'learndash-ariada' ); ?></label></th>
						<td>
							<select id="ariada-threshold" name="threshold">
								<?php foreach ( array( 'minor', 'moderate', 'serious', 'critical' ) as $level ) : ?>
									<option value="<?php echo esc_attr( $level ); ?>" <?php selected( $settings['threshold'], $level ); ?>><?php echo esc_html( ucfirst( $level ) ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="ariada-timeout"><?php echo esc_html__( 'Navigation timeout', 'learndash-ariada' ); ?></label></th>
						<td><input id="ariada-timeout" name="timeout_seconds" type="number" min="5" max="120" value="<?php echo esc_attr( (string) ( (int) $settings['timeout_ms'] / 1000 ) ); ?>" /> <?php echo esc_html__( 'seconds', 'learndash-ariada' ); ?></td>
					</tr>
				</table>
				<?php submit_button( __( 'Save settings', 'learndash-ariada' ), 'secondary' ); ?>
			</form>

			<h2><?php echo esc_html__( 'Published courses and lessons', 'learndash-ariada' ); ?></h2>
			<table class="widefat striped">
				<thead>
					<tr>
						<th scope="col"><?php echo esc_html__( 'Page', 'learndash-ariada' ); ?></th>
						<th scope="col"><?php echo esc_html__( 'Type', 'learndash-ariada' ); ?></th>
						<th scope="col"><?php echo esc_html__( 'Status', 'learndash-ariada' ); ?></th>
						<th scope="col"><?php echo esc_html__( 'Findings', 'learndash-ariada' ); ?></th>
						<th scope="col"><?php echo esc_html__( 'Last scan', 'learndash-ariada' ); ?></th>
						<th scope="col"><?php echo esc_html__( 'Actions', 'learndash-ariada' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php if ( ! $query->have_posts() ) : ?>
						<tr><td colspan="6"><?php echo esc_html__( 'No published LearnDash courses or lessons were found.', 'learndash-ariada' ); ?></td></tr>
					<?php else : ?>
						<?php foreach ( $query->posts as $post ) : ?>
							<?php $this->render_report_row( $post ); ?>
						<?php endforeach; ?>
					<?php endif; ?>
				</tbody>
			</table>
			<?php
			$pagination = paginate_links(
				array(
					'base'    => add_query_arg( 'paged', '%#%', $this->admin_page_url() ),
					'current' => $paged,
					'total'   => max( 1, (int) $query->max_num_pages ),
					'type'    => 'list',
				)
			);
			if ( is_string( $pagination ) ) {
				echo '<nav aria-label="' . esc_attr__( 'Report pages', 'learndash-ariada' ) . '">' . wp_kses_post( $pagination ) . '</nav>';
			}
			?>
		</div>
		<?php
	}

	/**
	 * Render one report-list row.
	 *
	 * @param \WP_Post $post LearnDash post.
	 */
	private function render_report_row( \WP_Post $post ): void {
		$record   = self::get_record( $post->ID );
		$report   = isset( $record['report'] ) && is_array( $record['report'] ) ? $record['report'] : array();
		$summary  = isset( $report['summary'] ) && is_array( $report['summary'] ) ? $report['summary'] : array();
		$total    = isset( $summary['total'] ) ? (int) $summary['total'] : 0;
		$edit_url = get_edit_post_link( $post->ID );
		$page_url = get_permalink( $post );
		$edit_url = is_string( $edit_url ) ? $edit_url : '#';
		$page_url = is_string( $page_url ) ? $page_url : '';
		?>
		<tr>
			<td>
				<strong><a href="<?php echo esc_url( $edit_url ); ?>"><?php echo esc_html( get_the_title( $post ) ); ?></a></strong>
				<div><a href="<?php echo esc_url( $page_url ); ?>"><?php echo esc_html__( 'View rendered page', 'learndash-ariada' ); ?></a></div>
			</td>
			<td><?php echo esc_html( self::post_type_label( $post->post_type ) ); ?></td>
			<td>
				<?php echo esc_html( self::record_status( $record ) ); ?>
				<?php
				if ( ! empty( $record['last_error'] ) ) :
					?>
					<p><small><?php echo esc_html( (string) $record['last_error'] ); ?></small></p><?php endif; ?>
			</td>
			<td><?php echo esc_html( (string) $total ); ?></td>
			<td><?php echo esc_html( (string) ( $record['scanned_at'] ?? '—' ) ); ?></td>
			<td>
				<?php $this->render_scan_form( $post->ID ); ?>
				<?php
				if ( ! empty( $report ) ) :
					?>
					<a class="button button-secondary" href="<?php echo esc_url( $this->report_url( $post->ID ) ); ?>"><?php echo esc_html__( 'Full report', 'learndash-ariada' ); ?></a><?php endif; ?>
			</td>
		</tr>
		<?php
	}

	/**
	 * Render a full normalized report.
	 *
	 * @param int $post_id LearnDash post ID.
	 */
	private function render_full_report( int $post_id ): void {
		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			wp_die( esc_html__( 'This report target is not a LearnDash course or lesson.', 'learndash-ariada' ) );
		}
		$record   = self::get_record( $post_id );
		$report   = isset( $record['report'] ) && is_array( $record['report'] ) ? $record['report'] : array();
		$summary  = isset( $report['summary'] ) && is_array( $report['summary'] ) ? $report['summary'] : array();
		$findings = isset( $report['findings'] ) && is_array( $report['findings'] ) ? $report['findings'] : array();
		$counts   = isset( $summary['by_impact'] ) && is_array( $summary['by_impact'] ) ? $summary['by_impact'] : array();
		$page_url = get_permalink( $post );
		$page_url = is_string( $page_url ) ? $page_url : '';
		?>
		<div class="wrap">
			<p><a href="<?php echo esc_url( $this->admin_page_url() ); ?>">&larr; <?php echo esc_html__( 'All LearnDash reports', 'learndash-ariada' ); ?></a></p>
			<h1><?php echo esc_html( get_the_title( $post ) ); ?></h1>
			<p>
				<?php
				printf(
					/* translators: 1: total findings, 2: critical, 3: serious, 4: moderate, 5: minor. */
					esc_html__( '%1$d findings: %2$d critical, %3$d serious, %4$d moderate, %5$d minor.', 'learndash-ariada' ),
					(int) ( $summary['total'] ?? 0 ),
					(int) ( $counts['critical'] ?? 0 ),
					(int) ( $counts['serious'] ?? 0 ),
					(int) ( $counts['moderate'] ?? 0 ),
					(int) ( $counts['minor'] ?? 0 )
				);
				?>
			</p>
			<p><a class="button button-secondary" href="<?php echo esc_url( $page_url ); ?>"><?php echo esc_html__( 'View rendered page', 'learndash-ariada' ); ?></a> <?php $this->render_scan_form( $post_id ); ?></p>
			<?php if ( ! empty( $summary['is_truncated'] ) ) : ?>
				<div class="notice notice-warning inline"><p><?php echo esc_html__( 'The stored display list reached its 5,000-finding safety limit; summary totals retain the CLI count.', 'learndash-ariada' ); ?></p></div>
			<?php endif; ?>
			<?php if ( empty( $findings ) ) : ?>
				<p><?php echo esc_html__( 'No WCAG findings are stored for this page.', 'learndash-ariada' ); ?></p>
			<?php else : ?>
				<table class="widefat striped">
					<thead><tr><th scope="col"><?php echo esc_html__( 'Impact', 'learndash-ariada' ); ?></th><th scope="col"><?php echo esc_html__( 'Rule', 'learndash-ariada' ); ?></th><th scope="col"><?php echo esc_html__( 'Finding', 'learndash-ariada' ); ?></th><th scope="col"><?php echo esc_html__( 'Target', 'learndash-ariada' ); ?></th></tr></thead>
					<tbody>
						<?php foreach ( $findings as $finding ) : ?>
							<tr>
								<td><?php echo esc_html( (string) ( $finding['impact'] ?? 'unknown' ) ); ?></td>
								<td><code><?php echo esc_html( (string) ( $finding['rule_id'] ?? 'unknown' ) ); ?></code>
								<?php
								if ( ! empty( $finding['criterion'] ) ) :
									?>
									<div><?php echo esc_html( (string) $finding['criterion'] ); ?></div><?php endif; ?></td>
								<td><?php echo esc_html( (string) ( $finding['message'] ?? '' ) ); ?></td>
								<td><code><?php echo esc_html( (string) ( $finding['selector'] ?? '' ) ); ?></code></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Register the report meta box on LearnDash edit screens.
	 *
	 * @param \WP_Post $post Current post.
	 */
	public function register_report_meta_box( \WP_Post $post ): void {
		add_meta_box(
			'ariada-learndash-report',
			__( 'Ariada accessibility', 'learndash-ariada' ),
			array( $this, 'render_report_meta_box' ),
			$post->post_type,
			'side',
			'default'
		);
	}

	/**
	 * Render the edit-screen report meta box.
	 *
	 * @param \WP_Post $post Current post.
	 */
	public function render_report_meta_box( \WP_Post $post ): void {
		if ( 'publish' !== $post->post_status ) {
			echo '<p>' . esc_html__( 'Publish this page before scanning its rendered URL.', 'learndash-ariada' ) . '</p>';
			return;
		}
		$record = self::get_record( $post->ID );
		echo '<p><strong>' . esc_html( self::record_status( $record ) ) . '</strong></p>';
		$this->render_scan_form( $post->ID );
		if ( ! empty( $record['report'] ) ) {
			echo '<p><a href="' . esc_url( $this->report_url( $post->ID ) ) . '">' . esc_html__( 'Open full report', 'learndash-ariada' ) . '</a></p>';
		}
	}

	/**
	 * Render a nonce-protected scan form.
	 *
	 * @param int $post_id LearnDash post ID.
	 */
	private function render_scan_form( int $post_id ): void {
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<input type="hidden" name="action" value="ariada_learndash_scan" />
			<input type="hidden" name="post_id" value="<?php echo esc_attr( (string) $post_id ); ?>" />
			<?php wp_nonce_field( 'ariada_learndash_scan_' . $post_id ); ?>
			<button type="submit" class="button button-primary"><?php echo esc_html__( 'Scan rendered page', 'learndash-ariada' ); ?></button>
		</form>
		<?php
	}

	/**
	 * Process one administrator scan request.
	 */
	public function handle_scan(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You are not allowed to run LearnDash accessibility scans.', 'learndash-ariada' ) );
		}
		$post_id = isset( $_POST['post_id'] ) ? absint( wp_unslash( $_POST['post_id'] ) ) : 0;
		check_admin_referer( 'ariada_learndash_scan_' . $post_id );
		$result = $this->scan_post( $post_id );
		$notice = ! empty( $result['ok'] ) ? 'scanned' : ( 'invalid_target' === ( $result['code'] ?? '' ) ? 'invalid_target' : 'scan_failed' );
		wp_safe_redirect(
			add_query_arg(
				array(
					'page'          => self::PAGE_SLUG,
					'report_id'     => ! empty( $result['ok'] ) ? $post_id : false,
					'ariada_notice' => $notice,
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Save bounded scanner settings.
	 */
	public function handle_save_settings(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You are not allowed to change LearnDash scanner settings.', 'learndash-ariada' ) );
		}
		check_admin_referer( 'ariada_learndash_save_settings' );
		$threshold = isset( $_POST['threshold'] ) ? sanitize_key( wp_unslash( $_POST['threshold'] ) ) : 'serious';
		if ( ! in_array( $threshold, array( 'minor', 'moderate', 'serious', 'critical' ), true ) ) {
			$threshold = 'serious';
		}
		$seconds = isset( $_POST['timeout_seconds'] ) ? absint( wp_unslash( $_POST['timeout_seconds'] ) ) : 30;
		update_option(
			self::OPTION_SETTINGS,
			array(
				'threshold'  => $threshold,
				'timeout_ms' => max( 5, min( 120, $seconds ) ) * 1000,
			),
			false
		);
		wp_safe_redirect( add_query_arg( 'ariada_notice', 'settings_saved', $this->admin_page_url() ) );
		exit;
	}

	/**
	 * Scan and store one published course or lesson.
	 *
	 * @param int $post_id LearnDash post ID.
	 * @return array<string,mixed>
	 */
	public function scan_post( int $post_id ): array {
		$post = get_post( $post_id );
		if ( ! $post instanceof \WP_Post || 'publish' !== $post->post_status || ! in_array( $post->post_type, self::POST_TYPES, true ) ) {
			return array(
				'ok'    => false,
				'code'  => 'invalid_target',
				'error' => 'Invalid LearnDash scan target.',
			);
		}
		$url = get_permalink( $post );
		if ( ! is_string( $url ) || ! self::is_same_origin_url( $url ) ) {
			return array(
				'ok'    => false,
				'code'  => 'invalid_target',
				'error' => 'The LearnDash permalink is not a same-origin HTTP(S) URL.',
			);
		}

		$settings = self::settings();
		$runner   = new CliRunner( self::cli_binary() );
		$result   = $runner->run( $url, (string) $settings['threshold'], (int) $settings['timeout_ms'] );
		$record   = self::get_record( $post_id );
		if ( empty( $result['ok'] ) || ! $result['report'] instanceof Report ) {
			$record['status']          = 'error';
			$record['last_attempt_at'] = gmdate( 'c' );
			$record['last_error']      = sanitize_text_field( (string) ( $result['error'] ?? 'Unknown scanner error.' ) );
			update_post_meta( $post_id, self::META_REPORT, $record );
			return array(
				'ok'     => false,
				'code'   => 'scan_failed',
				'record' => $record,
			);
		}

		$record = array(
			'status'          => 'complete',
			'stale'           => false,
			'scanned_at'      => gmdate( 'c' ),
			'last_attempt_at' => gmdate( 'c' ),
			'url'             => $url,
			'exit_code'       => (int) $result['exit_code'],
			'report'          => $result['report']->to_array(),
		);
		update_post_meta( $post_id, self::META_REPORT, $record );
		return array(
			'ok'     => true,
			'record' => $record,
		);
	}

	/**
	 * Mark a stored report stale after course or lesson content changes.
	 *
	 * @param int      $post_id Post ID.
	 * @param \WP_Post $post    Post.
	 * @param bool     $update  Whether this is an update.
	 */
	public function mark_report_stale( int $post_id, \WP_Post $post, bool $update ): void {
		unset( $post );
		if ( ! $update || wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		$record = self::get_record( $post_id );
		if ( ! empty( $record['report'] ) ) {
			$record['stale'] = true;
			update_post_meta( $post_id, self::META_REPORT, $record );
		}
	}

	/**
	 * Read sanitized settings.
	 *
	 * @return array{threshold:string,timeout_ms:int}
	 */
	public static function settings(): array {
		$stored = get_option( self::OPTION_SETTINGS, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$merged = array_merge( self::default_settings(), $stored );
		if ( ! in_array( $merged['threshold'], array( 'minor', 'moderate', 'serious', 'critical' ), true ) ) {
			$merged['threshold'] = 'serious';
		}
		$merged['timeout_ms'] = max( 5000, min( 120000, (int) $merged['timeout_ms'] ) );
		return $merged;
	}

	/**
	 * Default settings.
	 *
	 * @return array{threshold:string,timeout_ms:int}
	 */
	private static function default_settings(): array {
		return array(
			'threshold'  => 'serious',
			'timeout_ms' => 30000,
		);
	}

	/**
	 * Resolve trusted CLI configuration.
	 *
	 * @return string
	 */
	public static function cli_binary(): string {
		$binary = defined( 'ARIADA_LEARNDASH_CLI' ) ? (string) ARIADA_LEARNDASH_CLI : 'ariada';
		$binary = (string) apply_filters( 'ariada_learndash_cli_binary', $binary );
		if ( '' === trim( $binary ) || preg_match( '/[\x00-\x1F\x7F]/', $binary ) ) {
			return 'ariada';
		}
		return trim( $binary );
	}

	/**
	 * Check LearnDash availability without assuming a specific version.
	 *
	 * @return bool
	 */
	public static function is_learndash_active(): bool {
		return defined( 'LEARNDASH_VERSION' ) || class_exists( 'SFWD_LMS' ) || post_type_exists( 'sfwd-courses' );
	}

	/**
	 * Read one stored report record.
	 *
	 * @param int $post_id Post ID.
	 * @return array<string,mixed>
	 */
	private static function get_record( int $post_id ): array {
		$record = get_post_meta( $post_id, self::META_REPORT, true );
		return is_array( $record ) ? $record : array();
	}

	/**
	 * Human-readable record status.
	 *
	 * @param array<string,mixed> $record Stored record.
	 * @return string
	 */
	private static function record_status( array $record ): string {
		if ( empty( $record ) ) {
			return __( 'Not scanned', 'learndash-ariada' );
		}
		if ( 'error' === ( $record['status'] ?? '' ) ) {
			return __( 'Last attempt failed', 'learndash-ariada' );
		}
		if ( ! empty( $record['stale'] ) ) {
			return __( 'Report is stale', 'learndash-ariada' );
		}
		return __( 'Current', 'learndash-ariada' );
	}

	/**
	 * Return the post type label.
	 *
	 * @param string $post_type Post type.
	 * @return string
	 */
	private static function post_type_label( string $post_type ): string {
		$object = get_post_type_object( $post_type );
		return $object && isset( $object->labels->singular_name ) ? (string) $object->labels->singular_name : $post_type;
	}

	/**
	 * Enforce same-origin scan targets.
	 *
	 * @param string $url Candidate URL.
	 * @return bool
	 */
	private static function is_same_origin_url( string $url ): bool {
		$target = wp_parse_url( $url );
		$home   = wp_parse_url( home_url( '/' ) );
		if ( ! is_array( $target ) || ! is_array( $home ) ) {
			return false;
		}
		$target_scheme = strtolower( (string) ( $target['scheme'] ?? '' ) );
		$home_scheme   = strtolower( (string) ( $home['scheme'] ?? '' ) );
		$target_host   = strtolower( (string) ( $target['host'] ?? '' ) );
		$home_host     = strtolower( (string) ( $home['host'] ?? '' ) );
		$target_port   = (int) ( $target['port'] ?? ( 'https' === $target_scheme ? 443 : 80 ) );
		$home_port     = (int) ( $home['port'] ?? ( 'https' === $home_scheme ? 443 : 80 ) );
		return in_array( $target_scheme, array( 'http', 'https' ), true )
			&& $target_scheme === $home_scheme
			&& '' !== $target_host
			&& $target_host === $home_host
			&& $target_port === $home_port;
	}

	/**
	 * Admin report list URL.
	 *
	 * @return string
	 */
	private function admin_page_url(): string {
		return add_query_arg( 'page', self::PAGE_SLUG, admin_url( 'admin.php' ) );
	}

	/**
	 * Full report URL.
	 *
	 * @param int $post_id Post ID.
	 * @return string
	 */
	private function report_url( int $post_id ): string {
		return add_query_arg(
			array(
				'page'      => self::PAGE_SLUG,
				'report_id' => $post_id,
			),
			admin_url( 'admin.php' )
		);
	}
}
