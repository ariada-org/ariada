<?php
/**
 * Remove Ariada LearnDash settings and report metadata.
 *
 * @package AriadaLearnDash
 */

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'ariada_learndash_settings' );
delete_post_meta_by_key( '_ariada_learndash_report' );
