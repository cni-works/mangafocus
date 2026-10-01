<?php
/**
 * Analytics bootstrap.
 *
 * Core owns only the Analytics data lifecycle and storage contract. Collection,
 * REST, queries and reporting are supplied by the Pro add-on when available.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$ai_manga_viewer_analytics_dir = __DIR__ . '/analytics/';
require_once $ai_manga_viewer_analytics_dir . 'lifecycle.php';
require_once $ai_manga_viewer_analytics_dir . 'storage.php';
require_once $ai_manga_viewer_analytics_dir . 'settings.php';
unset( $ai_manga_viewer_analytics_dir );
