<?php
/**
 * WP-CLI command for host validation and automation.
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
 * Runs the same service used by the wp-admin actions.
 */
final class WpCliCommand {

	/**
	 * Plugin service.
	 *
	 * @var Plugin
	 */
	private Plugin $plugin;

	/**
	 * Configure the command.
	 *
	 * @param Plugin $plugin Plugin service.
	 */
	public function __construct( Plugin $plugin ) {
		$this->plugin = $plugin;
	}

	/**
	 * Scan one page or a bounded set of all published courses and lessons.
	 *
	 * ## OPTIONS
	 *
	 * [--post=<id>]
	 * : Scan one LearnDash course or lesson.
	 *
	 * [--all]
	 * : Scan published LearnDash courses and lessons.
	 *
	 * [--limit=<count>]
	 * : Maximum pages with --all. Defaults to 100.
	 *
	 * [--format=<format>]
	 * : summary or json. Defaults to summary.
	 *
	 * ## EXAMPLES
	 *
	 *     wp ariada-learndash scan --post=42 --format=json
	 *     wp ariada-learndash scan --all --limit=20
	 *
	 * @param array<int,string>   $args       Positional arguments.
	 * @param array<string,mixed> $assoc_args Named arguments.
	 */
	public function scan( array $args, array $assoc_args ): void {
		unset( $args );
		$post_id = isset( $assoc_args['post'] ) ? absint( $assoc_args['post'] ) : 0;
		$all     = isset( $assoc_args['all'] );
		if ( 0 === $post_id && ! $all ) {
			\WP_CLI::error( 'Pass --post=<id> or --all.' );
		}

		if ( $post_id > 0 ) {
			$ids = array( $post_id );
		} else {
			$limit = isset( $assoc_args['limit'] ) ? max( 1, min( 1000, absint( $assoc_args['limit'] ) ) ) : 100;
			$ids   = get_posts(
				array(
					'post_type'      => array( 'sfwd-courses', 'sfwd-lessons' ),
					'post_status'    => 'publish',
					'posts_per_page' => $limit,
					'fields'         => 'ids',
					'orderby'        => 'ID',
					'order'          => 'ASC',
				)
			);
		}

		$results = array();
		$failed  = 0;
		foreach ( $ids as $id ) {
			$result               = $this->plugin->scan_post( (int) $id );
			$results[ (int) $id ] = $result;
			if ( empty( $result['ok'] ) ) {
				++$failed;
			}
		}
		if ( 'json' === ( $assoc_args['format'] ?? 'summary' ) ) {
			$json = wp_json_encode( $results, JSON_PRETTY_PRINT );
			\WP_CLI::line( false !== $json ? $json : '{}' );
		}
		if ( $failed > 0 ) {
			\WP_CLI::error( sprintf( '%d of %d LearnDash page scans failed.', $failed, count( $ids ) ) );
		}
		\WP_CLI::success( sprintf( 'Stored %d LearnDash accessibility report(s).', count( $ids ) ) );
	}
}
