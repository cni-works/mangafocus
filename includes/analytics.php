<?php
/**
 * Minimal, disabled-by-default storage foundation for reader analytics.
 *
 * No IP address, full user agent, destination URL, or pointer coordinate is stored.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AI_MANGA_VIEWER_ANALYTICS_DB_VERSION', '3' );

/** Return analytics table names for the current site. */
function ai_manga_viewer_analytics_tables() {
	global $wpdb;
	return array(
		'sessions' => $wpdb->prefix . 'amv_reader_sessions',
		'reaches'  => $wpdb->prefix . 'amv_page_reaches',
		'events'   => $wpdb->prefix . 'amv_reader_events',
	);
}

/** Create or update the analytics tables without enabling collection. */
function ai_manga_viewer_install_analytics_tables() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$tables  = ai_manga_viewer_analytics_tables();
	$collate = $wpdb->get_charset_collate();
	dbDelta( "CREATE TABLE {$tables['sessions']} (
		session_id varchar(80) NOT NULL,
		visitor_key char(64) NOT NULL DEFAULT '',
		viewer_key varchar(64) NOT NULL,
		instance_key varchar(64) NOT NULL,
		started_at datetime NOT NULL,
		last_activity_at datetime NOT NULL,
		start_mode varchar(20) NOT NULL DEFAULT '',
		used_standard tinyint(1) unsigned NOT NULL DEFAULT 0,
		used_fullscreen tinyint(1) unsigned NOT NULL DEFAULT 0,
		used_zoom tinyint(1) unsigned NOT NULL DEFAULT 0,
		used_focus tinyint(1) unsigned NOT NULL DEFAULT 0,
		max_page_number int unsigned NOT NULL DEFAULT 0,
		page_count int unsigned NOT NULL DEFAULT 0,
		cta_clicked tinyint(1) unsigned NOT NULL DEFAULT 0,
		active_seconds int unsigned NOT NULL DEFAULT 0,
		PRIMARY KEY  (session_id),
		KEY viewer_key (viewer_key),
		KEY visitor_key (visitor_key),
		KEY instance_key (instance_key),
		KEY started_at (started_at)
	) ENGINE=InnoDB $collate;" );
	dbDelta( "CREATE TABLE {$tables['reaches']} (
		session_id varchar(80) NOT NULL,
		page_key varchar(64) NOT NULL,
		viewer_key varchar(64) NOT NULL,
		instance_key varchar(64) NOT NULL,
		page_number int unsigned NOT NULL,
		page_count int unsigned NOT NULL,
		mode varchar(20) NOT NULL,
		first_reached_at datetime NOT NULL,
		PRIMARY KEY  (session_id,page_key),
		KEY viewer_key (viewer_key),
		KEY instance_key (instance_key),
		KEY first_reached_at (first_reached_at)
	) ENGINE=InnoDB $collate;" );
	dbDelta( "CREATE TABLE {$tables['events']} (
		id bigint unsigned NOT NULL AUTO_INCREMENT,
		event_id varchar(80) NOT NULL,
		session_id varchar(80) NOT NULL DEFAULT '',
		visitor_key char(64) NOT NULL DEFAULT '',
		name varchar(32) NOT NULL,
		viewer_key varchar(64) NOT NULL,
		instance_key varchar(64) NOT NULL,
		page_key varchar(64) NOT NULL DEFAULT '',
		page_number int unsigned NOT NULL DEFAULT 0,
		page_count int unsigned NOT NULL DEFAULT 0,
		cta_key varchar(64) NOT NULL DEFAULT '',
		mode varchar(20) NOT NULL,
		reading_started tinyint(1) unsigned NOT NULL DEFAULT 0,
		active_seconds_delta smallint unsigned NOT NULL DEFAULT 0,
		client_occurred_at bigint unsigned NOT NULL,
		received_at datetime NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY event_id (event_id),
		KEY session_id (session_id),
		KEY visitor_key (visitor_key),
		KEY viewer_key (viewer_key),
		KEY instance_key (instance_key),
		KEY received_at (received_at)
	) ENGINE=InnoDB $collate;" );
	update_option( 'ai_manga_viewer_analytics_db_version', AI_MANGA_VIEWER_ANALYTICS_DB_VERSION, false );
	if ( false === get_option( 'ai_manga_viewer_analytics_enabled', false ) ) {
		add_option( 'ai_manga_viewer_analytics_enabled', '0', '', false );
	}
	if ( false === get_option( 'ai_manga_viewer_analytics_retention_days', false ) ) {
		add_option( 'ai_manga_viewer_analytics_retention_days', '90', '', false );
	}
	if ( false === get_option( 'ai_manga_viewer_analytics_delete_on_uninstall', false ) ) {
		add_option( 'ai_manga_viewer_analytics_delete_on_uninstall', '0', '', false );
	}
	if ( ! wp_next_scheduled( 'ai_manga_viewer_analytics_daily_cleanup' ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'ai_manga_viewer_analytics_daily_cleanup' );
	}
}

/** Install schema upgrades while leaving collection disabled. */
function ai_manga_viewer_maybe_upgrade_analytics() {
	if ( AI_MANGA_VIEWER_ANALYTICS_DB_VERSION !== get_option( 'ai_manga_viewer_analytics_db_version', '' ) ) {
		ai_manga_viewer_install_analytics_tables();
	}
}
add_action( 'plugins_loaded', 'ai_manga_viewer_maybe_upgrade_analytics' );

/** Remove the scheduled job when the plugin is deactivated. */
function ai_manga_viewer_deactivate_analytics() {
	wp_clear_scheduled_hook( 'ai_manga_viewer_analytics_daily_cleanup' );
}

/** Read the administrator-controlled collection switch; its default is OFF. */
function ai_manga_viewer_analytics_enabled() {
	return (bool) apply_filters( 'ai_manga_viewer_analytics_enabled', '1' === get_option( 'ai_manga_viewer_analytics_enabled', '0' ) );
}

/** Keep retention within a bounded range suitable for detailed event rows. */
function ai_manga_viewer_sanitize_retention_days( $value ) {
	$value = absint( $value );
	return (string) max( 30, min( 365, $value ?: 90 ) );
}

/** Normalize checkbox options to an explicit 0/1 string. */
function ai_manga_viewer_sanitize_checkbox( $value ) {
	return empty( $value ) ? '0' : '1';
}

/** Delete detailed rows older than the configured retention window. */
function ai_manga_viewer_cleanup_analytics_data() {
	global $wpdb;
	$tables = ai_manga_viewer_analytics_tables();
	$days   = (int) ai_manga_viewer_sanitize_retention_days( get_option( 'ai_manga_viewer_analytics_retention_days', '90' ) );
	$cutoff = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS * $days );
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$tables['events']} WHERE received_at < %s", $cutoff ) );
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$tables['reaches']} WHERE first_reached_at < %s", $cutoff ) );
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$tables['sessions']} WHERE last_activity_at < %s", $cutoff ) );
}
add_action( 'ai_manga_viewer_analytics_daily_cleanup', 'ai_manga_viewer_cleanup_analytics_data' );

/** Delete every analytics row while retaining the schema and settings. */
function ai_manga_viewer_delete_all_analytics_data() {
	global $wpdb;
	foreach ( array_reverse( ai_manga_viewer_analytics_tables() ) as $table ) {
		$wpdb->query( "DELETE FROM $table" );
	}
}

/** Drop analytics storage only when the administrator opted into uninstall deletion. */
function ai_manga_viewer_uninstall_analytics() {
	wp_clear_scheduled_hook( 'ai_manga_viewer_analytics_daily_cleanup' );
	if ( '1' !== get_option( 'ai_manga_viewer_analytics_delete_on_uninstall', '0' ) ) {
		return;
	}
	global $wpdb;
	foreach ( array_reverse( ai_manga_viewer_analytics_tables() ) as $table ) {
		$wpdb->query( "DROP TABLE IF EXISTS $table" );
	}
	delete_option( 'ai_manga_viewer_analytics_enabled' );
	delete_option( 'ai_manga_viewer_analytics_retention_days' );
	delete_option( 'ai_manga_viewer_analytics_delete_on_uninstall' );
	delete_option( 'ai_manga_viewer_analytics_db_version' );
}

/** Register the three analytics operating options. */
function ai_manga_viewer_register_analytics_settings() {
	register_setting( 'ai_manga_viewer_analytics', 'ai_manga_viewer_analytics_enabled', array( 'type' => 'string', 'sanitize_callback' => 'ai_manga_viewer_sanitize_checkbox', 'default' => '0' ) );
	register_setting( 'ai_manga_viewer_analytics', 'ai_manga_viewer_analytics_retention_days', array( 'type' => 'string', 'sanitize_callback' => 'ai_manga_viewer_sanitize_retention_days', 'default' => '90' ) );
	register_setting( 'ai_manga_viewer_analytics', 'ai_manga_viewer_analytics_delete_on_uninstall', array( 'type' => 'string', 'sanitize_callback' => 'ai_manga_viewer_sanitize_checkbox', 'default' => '0' ) );
}
add_action( 'admin_init', 'ai_manga_viewer_register_analytics_settings' );

/** Add analytics settings beneath Manga Library. */
function ai_manga_viewer_add_analytics_settings_page() {
	add_submenu_page( 'edit.php?post_type=amv_viewer', __( '漫画解析', 'ai-manga-viewer' ), __( '漫画解析', 'ai-manga-viewer' ), 'manage_options', 'ai-manga-viewer-analytics-report', 'ai_manga_viewer_render_analytics_report_page' );
	add_submenu_page( 'edit.php?post_type=amv_viewer', __( '漫画解析設定', 'ai-manga-viewer' ), __( '解析設定', 'ai-manga-viewer' ), 'manage_options', 'ai-manga-viewer-analytics', 'ai_manga_viewer_render_analytics_settings_page' );
}
add_action( 'admin_menu', 'ai_manga_viewer_add_analytics_settings_page' );

/** Load report interactions only on the Manga Analytics screen. */
function ai_manga_viewer_analytics_admin_assets( $hook_suffix ) {
	if ( 'amv_viewer_page_ai-manga-viewer-analytics-report' !== $hook_suffix ) {
		return;
	}
	$base_path = plugin_dir_path( dirname( __DIR__ ) . '/ai-manga-viewer.php' ) . 'assets/';
	$base_url  = plugin_dir_url( dirname( __DIR__ ) . '/ai-manga-viewer.php' ) . 'assets/';
	wp_enqueue_script( 'ai-manga-viewer-analytics-admin', $base_url . 'admin-analytics.js', array(), filemtime( $base_path . 'admin-analytics.js' ), true );
	wp_enqueue_style( 'ai-manga-viewer-analytics-admin', $base_url . 'admin-analytics.css', array(), filemtime( $base_path . 'admin-analytics.css' ) );
}
add_action( 'admin_enqueue_scripts', 'ai_manga_viewer_analytics_admin_assets' );

/** Read an allowlisted report period from the query string. */
function ai_manga_viewer_analytics_report_days( $value ) {
	$value = is_scalar( $value ) ? strtolower( (string) $value ) : '';
	return in_array( $value, array( 'today', 'yesterday', '7', '30', '90', 'all' ), true ) ? $value : '30';
}

/** Resolve local calendar boundaries to the UTC timestamps stored in Analytics tables. */
function ai_manga_viewer_analytics_period_bounds( $period, $now = null ) {
	$period   = ai_manga_viewer_analytics_report_days( $period );
	$timezone = wp_timezone();
	if ( $now instanceof DateTimeInterface ) {
		$now = ( new DateTimeImmutable( '@' . $now->getTimestamp() ) )->setTimezone( $timezone );
	} else {
		$now = new DateTimeImmutable( 'now', $timezone );
	}
	if ( 'all' === $period ) {
		return array( 'start' => '', 'end' => '', 'end_exclusive' => false );
	}
	$today = $now->setTime( 0, 0, 0 );
	if ( 'yesterday' === $period ) {
		$start = $today->modify( '-1 day' );
		$end   = $today;
		$end_exclusive = true;
	} else {
		$days  = 'today' === $period ? 1 : (int) $period;
		$start = $today->modify( '-' . max( 0, $days - 1 ) . ' days' );
		$end   = $now;
		$end_exclusive = false;
	}
	$utc = new DateTimeZone( 'UTC' );
	return array(
		'start'         => $start->setTimezone( $utc )->format( 'Y-m-d H:i:s' ),
		'end'           => $end->setTimezone( $utc )->format( 'Y-m-d H:i:s' ),
		'end_exclusive' => $end_exclusive,
	);
}

/** Build a prepared time condition for a known Analytics timestamp column. */
function ai_manga_viewer_analytics_time_scope( $column, $bounds ) {
	global $wpdb;
	$allowed = array( 'started_at', 's.started_at', 'received_at' );
	if ( ! in_array( $column, $allowed, true ) ) {
		return ' AND 1=0';
	}
	$scope = '';
	if ( ! empty( $bounds['start'] ) ) {
		$scope .= $wpdb->prepare( " AND $column >= %s", $bounds['start'] );
	}
	if ( ! empty( $bounds['end'] ) ) {
		$operator = ! empty( $bounds['end_exclusive'] ) ? '<' : '<=';
		$scope   .= $wpdb->prepare( " AND $column $operator %s", $bounds['end'] );
	}
	return $scope;
}

/** Query aggregate session metrics without exposing anonymous visitor keys. */
function ai_manga_viewer_analytics_report_data( $days, $viewer_keys = null ) {
	global $wpdb;
	$tables = ai_manga_viewer_analytics_tables();
	$days   = ai_manga_viewer_analytics_report_days( $days );
	$bounds = ai_manga_viewer_analytics_period_bounds( $days );
	if ( null === $viewer_keys ) {
		$viewer_keys = array_keys( ai_manga_viewer_analytics_library_labels() );
	}
	$viewer_keys = array_values( array_unique( array_filter( array_map( 'sanitize_key', (array) $viewer_keys ) ) ) );
	$session_scope = ' AND 1=0';
	$reach_scope   = ' AND 1=0';
	$event_scope   = ' AND 1=0';
	if ( $viewer_keys ) {
		$placeholders  = implode( ',', array_fill( 0, count( $viewer_keys ), '%s' ) );
		$session_scope = $wpdb->prepare( " AND viewer_key IN ($placeholders)", ...$viewer_keys );
		$reach_scope   = $wpdb->prepare( " AND s.viewer_key IN ($placeholders)", ...$viewer_keys );
		$event_scope   = $wpdb->prepare( " AND viewer_key IN ($placeholders)", ...$viewer_keys );
	}
	$session_time_scope = ai_manga_viewer_analytics_time_scope( 'started_at', $bounds );
	$reach_time_scope   = ai_manga_viewer_analytics_time_scope( 's.started_at', $bounds );
	$event_time_scope   = ai_manga_viewer_analytics_time_scope( 'received_at', $bounds );
	$timezone = wp_timezone();
	$offset_seconds = $timezone->getOffset( new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) ) );
	$day_expression = 'DATE(DATE_ADD(started_at, INTERVAL ' . (int) $offset_seconds . ' SECOND))';
	$metrics = "COUNT(*) AS sessions, COUNT(DISTINCT NULLIF(visitor_key,'')) AS readers, SUM(CASE WHEN page_count > 0 AND max_page_number >= CEIL(page_count * 0.25) THEN 1 ELSE 0 END) AS reached_25, SUM(CASE WHEN page_count > 0 AND max_page_number >= CEIL(page_count * 0.50) THEN 1 ELSE 0 END) AS reached_50, SUM(CASE WHEN page_count > 0 AND max_page_number >= CEIL(page_count * 0.75) THEN 1 ELSE 0 END) AS reached_75, SUM(CASE WHEN page_count > 0 AND max_page_number >= page_count THEN 1 ELSE 0 END) AS completed, SUM(cta_clicked) AS cta_sessions, SUM(active_seconds) AS active_seconds, AVG(active_seconds) AS active_average, MAX(page_count) AS page_count";
	$total = $wpdb->get_row( "SELECT $metrics FROM {$tables['sessions']} WHERE 1=1$session_time_scope$session_scope", ARRAY_A );
	$rows  = $wpdb->get_results( "SELECT viewer_key, $metrics FROM {$tables['sessions']} WHERE 1=1$session_time_scope$session_scope GROUP BY viewer_key ORDER BY sessions DESC, viewer_key ASC LIMIT 100", ARRAY_A );
	$daily_total_rows = $wpdb->get_results( "SELECT $day_expression AS day, COUNT(*) AS sessions, COUNT(DISTINCT NULLIF(visitor_key,'')) AS readers FROM {$tables['sessions']} WHERE 1=1$session_time_scope$session_scope GROUP BY $day_expression ORDER BY day ASC", ARRAY_A );
	$daily_rows = $wpdb->get_results( "SELECT viewer_key, $day_expression AS day, COUNT(*) AS sessions, COUNT(DISTINCT NULLIF(visitor_key,'')) AS readers FROM {$tables['sessions']} WHERE 1=1$session_time_scope$session_scope GROUP BY viewer_key, $day_expression ORDER BY day ASC, viewer_key ASC", ARRAY_A );
	$reach_rows = $wpdb->get_results( "SELECT r.viewer_key, r.page_number, MAX(r.page_count) AS page_count, COUNT(DISTINCT r.session_id) AS reached FROM {$tables['reaches']} r INNER JOIN {$tables['sessions']} s ON s.session_id = r.session_id WHERE 1=1$reach_time_scope$reach_scope GROUP BY r.viewer_key, r.page_number ORDER BY r.viewer_key ASC, r.page_number ASC", ARRAY_A );
	$direct_total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tables['events']} WHERE name = 'cta_click' AND session_id = ''$event_time_scope$event_scope" );
	$direct_rows  = $wpdb->get_results( "SELECT viewer_key, COUNT(*) AS direct_cta FROM {$tables['events']} WHERE name = 'cta_click' AND session_id = ''$event_time_scope$event_scope GROUP BY viewer_key", OBJECT_K );
	$impression_total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$tables['events']} WHERE name = 'viewer_impression'$event_time_scope$event_scope" );
	$impression_rows  = $wpdb->get_results( "SELECT viewer_key, COUNT(*) AS impressions FROM {$tables['events']} WHERE name = 'viewer_impression'$event_time_scope$event_scope GROUP BY viewer_key", OBJECT_K );
	$daily_total_rows = is_array( $daily_total_rows ) ? $daily_total_rows : array();
	foreach ( $daily_total_rows as &$daily_total_row ) {
		$daily_total_row['viewer_key'] = 'all';
	}
	unset( $daily_total_row );
	return array( 'total' => is_array( $total ) ? $total : array(), 'rows' => is_array( $rows ) ? $rows : array(), 'daily_rows' => array_merge( $daily_total_rows, is_array( $daily_rows ) ? $daily_rows : array() ), 'reach_rows' => is_array( $reach_rows ) ? $reach_rows : array(), 'direct_total' => $direct_total, 'direct_rows' => is_array( $direct_rows ) ? $direct_rows : array(), 'impression_total' => $impression_total, 'impression_rows' => is_array( $impression_rows ) ? $impression_rows : array() );
}

/** Fill missing report dates so quiet days remain visible in the chart. */
function ai_manga_viewer_analytics_daily_series( $rows, $days, $viewer_key = 'all' ) {
	$days   = ai_manga_viewer_analytics_report_days( $days );
	$viewer_key = sanitize_key( $viewer_key );
	$values = array();
	foreach ( (array) $rows as $row ) {
		$row_viewer_key = sanitize_key( $row['viewer_key'] ?? '' );
		if ( ! is_array( $row ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $row['day'] ?? '' ) || $viewer_key !== $row_viewer_key ) {
			continue;
		}
		if ( ! isset( $values[ $row['day'] ] ) ) {
			$values[ $row['day'] ] = array( 'sessions' => 0, 'readers' => 0 );
		}
		$values[ $row['day'] ]['sessions'] += absint( $row['sessions'] ?? 0 );
		$values[ $row['day'] ]['readers']  += absint( $row['readers'] ?? 0 );
	}
	$today  = new DateTimeImmutable( 'today', wp_timezone() );
	$series = array();
	if ( 'all' === $days ) {
		ksort( $values );
		foreach ( $values as $day => $counts ) {
			$series[] = array_merge( array( 'day' => $day, 'sessions' => 0, 'readers' => 0 ), $counts );
		}
		return $series;
	}
	$count = 'today' === $days || 'yesterday' === $days ? 1 : (int) $days;
	$base  = 'yesterday' === $days ? $today->modify( '-1 day' ) : $today;
	for ( $offset = $count - 1; $offset >= 0; $offset-- ) {
		$day = $base->modify( '-' . $offset . ' days' )->format( 'Y-m-d' );
		$series[] = array_merge( array( 'day' => $day, 'sessions' => 0, 'readers' => 0 ), $values[ $day ] ?? array() );
	}
	return $series;
}

/** Group page reach rows by Viewer while accepting only bounded page numbers. */
function ai_manga_viewer_analytics_reach_series( $rows ) {
	$series = array();
	foreach ( (array) $rows as $row ) {
		$viewer_key = sanitize_key( $row['viewer_key'] ?? '' );
		$page_number = absint( $row['page_number'] ?? 0 );
		$page_count  = min( 1000, absint( $row['page_count'] ?? 0 ) );
		if ( '' === $viewer_key || $page_number < 1 || $page_number > $page_count ) {
			continue;
		}
		if ( ! isset( $series[ $viewer_key ] ) ) {
			$series[ $viewer_key ] = array( 'page_count' => $page_count, 'pages' => array() );
		}
		$series[ $viewer_key ]['page_count'] = max( $series[ $viewer_key ]['page_count'], $page_count );
		$series[ $viewer_key ]['pages'][ $page_number ] = absint( $row['reached'] ?? 0 );
	}
	return $series;
}

/** Match stable Viewer keys to Manga Library titles when a registered source exists. */
function ai_manga_viewer_analytics_library_labels() {
	if ( ! function_exists( 'ai_manga_viewer_find_library_block' ) ) {
		return array();
	}
	$labels = array();
	$posts  = get_posts( array( 'post_type' => 'amv_viewer', 'post_status' => array( 'publish', 'private', 'draft', 'pending', 'future' ), 'posts_per_page' => -1, 'orderby' => 'title', 'order' => 'ASC' ) );
	foreach ( $posts as $post ) {
		$block = ai_manga_viewer_find_library_block( parse_blocks( $post->post_content ) );
		$key   = sanitize_key( $block['attrs']['viewerKey'] ?? '' );
		$key   = '' !== $key ? $key : 'library-viewer-' . absint( $post->ID );
		$labels[ $key ] = array(
			'title'   => get_the_title( $post ),
			'url'     => get_edit_post_link( $post->ID ),
			'cover'   => get_the_post_thumbnail_url( $post->ID, 'medium' ) ?: ai_manga_viewer_analytics_block_cover( $block ),
			'post_id' => absint( $post->ID ),
			'source'  => 'library',
		);
	}
	return $labels;
}

/** Cache the current Manga Library Viewer keys used to authorize incoming events. */
function ai_manga_viewer_analytics_library_keys() {
	$cached = get_transient( 'ai_manga_viewer_analytics_library_keys' );
	if ( is_array( $cached ) ) {
		return $cached;
	}
	$keys = array_keys( ai_manga_viewer_analytics_library_labels() );
	set_transient( 'ai_manga_viewer_analytics_library_keys', $keys, 5 * MINUTE_IN_SECONDS );
	return $keys;
}

/** Clear the short Viewer-key cache after Manga Library content changes. */
function ai_manga_viewer_analytics_flush_library_keys() {
	delete_transient( 'ai_manga_viewer_analytics_library_keys' );
}
add_action( 'save_post_amv_viewer', 'ai_manga_viewer_analytics_flush_library_keys', 10, 0 );
add_action( 'deleted_post', 'ai_manga_viewer_analytics_flush_library_keys', 10, 0 );

/** Accept analytics only for a Viewer that currently exists in Manga Library. */
function ai_manga_viewer_analytics_viewer_is_registered( $viewer_key ) {
	return in_array( sanitize_key( $viewer_key ), ai_manga_viewer_analytics_library_keys(), true );
}

/** Find a usable cover from the first valid Viewer page without changing saved content. */
function ai_manga_viewer_analytics_block_cover( $block ) {
	foreach ( (array) ( $block['attrs']['pages'] ?? array() ) as $page ) {
		if ( ! is_array( $page ) ) {
			continue;
		}
		$image_id = absint( $page['id'] ?? 0 );
		if ( $image_id ) {
			$image_url = wp_get_attachment_image_url( $image_id, 'medium' );
			if ( $image_url ) {
				return $image_url;
			}
		}
		$image_url = esc_url_raw( $page['url'] ?? '' );
		if ( '' !== $image_url ) {
			return $image_url;
		}
	}
	return '';
}

/** Build the selector catalog from Manga Library entries only. */
function ai_manga_viewer_analytics_viewer_catalog( $rows ) {
	unset( $rows );
	return ai_manga_viewer_analytics_library_labels();
}

/** Return an administrator-friendly label for a Manga Library Viewer key. */
function ai_manga_viewer_analytics_viewer_label( $viewer_key, $labels ) {
	if ( isset( $labels[ $viewer_key ] ) ) {
		return $labels[ $viewer_key ];
	}
	return array( 'title' => __( '名称未設定のViewer', 'ai-manga-viewer' ), 'url' => '', 'cover' => '', 'post_id' => 0, 'source' => 'unknown' );
}

/** Return a complete, integer-normalized metric set for one report scope. */
function ai_manga_viewer_analytics_metrics( $row ) {
	$metrics = wp_parse_args(
		is_array( $row ) ? $row : array(),
		array(
			'sessions'       => 0,
			'readers'        => 0,
			'reached_25'     => 0,
			'reached_50'     => 0,
			'reached_75'     => 0,
			'completed'      => 0,
			'cta_sessions'   => 0,
			'active_seconds' => 0,
			'active_average' => 0,
			'page_count'     => 0,
		)
	);
	foreach ( array( 'sessions', 'readers', 'reached_25', 'reached_50', 'reached_75', 'completed', 'cta_sessions', 'active_seconds', 'page_count' ) as $key ) {
		$metrics[ $key ] = absint( $metrics[ $key ] );
	}
	$metrics['active_average'] = max( 0, (float) $metrics['active_average'] );
	return $metrics;
}

/** Choose the requested Viewer, then the most-read Viewer, then the first registered Viewer. */
function ai_manga_viewer_analytics_selected_viewer( $requested, $rows, $catalog ) {
	$requested = sanitize_key( $requested );
	if ( 'all' === $requested ) {
		return 'all';
	}
	if ( '' !== $requested && isset( $catalog[ $requested ] ) ) {
		return $requested;
	}
	foreach ( (array) $rows as $row ) {
		$key = sanitize_key( $row['viewer_key'] ?? '' );
		if ( '' !== $key && isset( $catalog[ $key ] ) ) {
			return $key;
		}
	}
	$keys = array_keys( $catalog );
	return $keys ? $keys[0] : 'all';
}

/** Build a report URL while preserving the selected period and Viewer. */
function ai_manga_viewer_analytics_report_url( $days, $viewer_key ) {
	return add_query_arg(
		array(
			'post_type'  => 'amv_viewer',
			'page'       => 'ai-manga-viewer-analytics-report',
			'amv_days'   => ai_manga_viewer_analytics_report_days( $days ),
			'amv_viewer' => 'all' === $viewer_key ? 'all' : sanitize_key( $viewer_key ),
		),
		admin_url( 'edit.php' )
	);
}

/** Render a cover image or a shared accessible placeholder. */
function ai_manga_viewer_analytics_cover( $item, $class = '' ) {
	$class = 'amv-analytics-cover' . ( '' !== $class ? ' ' . sanitize_html_class( $class ) : '' );
	if ( ! empty( $item['cover'] ) ) {
		return '<span class="' . esc_attr( $class ) . '"><img src="' . esc_url( $item['cover'] ) . '" alt="" loading="lazy" decoding="async" /></span>';
	}
	return '<span class="' . esc_attr( $class . ' is-placeholder' ) . '" aria-hidden="true"><span class="dashicons dashicons-book-alt"></span></span>';
}

/** Read a direct-CTA count from the OBJECT_K result without exposing its storage shape. */
function ai_manga_viewer_analytics_direct_count( $direct_rows, $viewer_key ) {
	if ( ! isset( $direct_rows[ $viewer_key ] ) ) {
		return 0;
	}
	$row = $direct_rows[ $viewer_key ];
	return absint( is_object( $row ) ? ( $row->direct_cta ?? 0 ) : ( $row['direct_cta'] ?? 0 ) );
}

/** Read a Viewer-impression count from the OBJECT_K result. */
function ai_manga_viewer_analytics_impression_count( $impression_rows, $viewer_key ) {
	if ( ! isset( $impression_rows[ $viewer_key ] ) ) {
		return 0;
	}
	$row = $impression_rows[ $viewer_key ];
	return absint( is_object( $row ) ? ( $row->impressions ?? 0 ) : ( $row['impressions'] ?? 0 ) );
}

/** Calculate reusable page reach and drop-off facts for reports and consultation output. */
function ai_manga_viewer_analytics_page_analysis( $reach, $sessions ) {
	$page_count = min( 1000, absint( $reach['page_count'] ?? 0 ) );
	$pages = array();
	$largest_drop = 0;
	$largest_drop_page = 0;
	$previous = null;
	for ( $number = 1; $number <= $page_count; $number++ ) {
		$reached = absint( $reach['pages'][ $number ] ?? 0 );
		$drop = null === $previous ? 0 : max( 0, $previous - $reached );
		$drop_rate = null === $previous || 0 === $previous ? 0 : round( $drop * 100 / $previous, 1 );
		$pages[ $number ] = array(
			'number'    => $number,
			'reached'   => $reached,
			'rate'      => $sessions ? min( 100, round( $reached * 100 / $sessions, 1 ) ) : 0,
			'drop'      => $drop,
			'drop_rate' => $drop_rate,
		);
		if ( $drop > $largest_drop ) {
			$largest_drop = $drop;
			$largest_drop_page = $number;
		}
		$previous = $reached;
	}
	return array( 'pages' => $pages, 'largest_drop' => $largest_drop, 'largest_drop_page' => $largest_drop_page );
}

/** Assemble one shared Analytics context without reading values back from rendered HTML. */
function ai_manga_viewer_analytics_context( $period, $requested_viewer = '' ) {
	$period = ai_manga_viewer_analytics_report_days( $period );
	$catalog = ai_manga_viewer_analytics_viewer_catalog( array() );
	$data = ai_manga_viewer_analytics_report_data( $period, array_keys( $catalog ) );
	$viewer_rows = array();
	foreach ( $data['rows'] as $row ) {
		$key = sanitize_key( $row['viewer_key'] ?? '' );
		if ( '' !== $key ) {
			$viewer_rows[ $key ] = $row;
		}
	}
	$selected = ai_manga_viewer_analytics_selected_viewer( $requested_viewer, $data['rows'], $catalog );
	$is_all = 'all' === $selected;
	$metrics = ai_manga_viewer_analytics_metrics( $is_all ? $data['total'] : ( $viewer_rows[ $selected ] ?? array() ) );
	$impressions = $is_all ? absint( $data['impression_total'] ?? 0 ) : ai_manga_viewer_analytics_impression_count( $data['impression_rows'] ?? array(), $selected );
	$metrics['impressions'] = $impressions;
	// Historical sessions may predate Viewer impression collection. Avoid presenting
	// an impossible rate when the selected period straddles that rollout.
	$metrics['start_rate_available'] = $impressions > 0 && $metrics['sessions'] <= $impressions;
	$metrics['start_rate'] = $metrics['start_rate_available'] ? round( $metrics['sessions'] * 100 / $impressions, 1 ) : 0;
	$metrics['completion_rate'] = $metrics['sessions'] ? round( $metrics['completed'] * 100 / $metrics['sessions'], 1 ) : 0;
	$metrics['cta_rate'] = $metrics['sessions'] ? round( $metrics['cta_sessions'] * 100 / $metrics['sessions'], 1 ) : 0;
	$reach_series = ai_manga_viewer_analytics_reach_series( $data['reach_rows'] );
	$selected_reach = ! $is_all && isset( $reach_series[ $selected ] ) ? $reach_series[ $selected ] : array( 'page_count' => $metrics['page_count'], 'pages' => array() );
	return array(
		'period'         => $period,
		'catalog'        => $catalog,
		'data'           => $data,
		'viewer_rows'    => $viewer_rows,
		'selected'       => $selected,
		'is_all'         => $is_all,
		'metrics'        => $metrics,
		'direct_count'   => $is_all ? absint( $data['direct_total'] ) : ai_manga_viewer_analytics_direct_count( $data['direct_rows'], $selected ),
		'daily_series'   => ai_manga_viewer_analytics_daily_series( $data['daily_rows'], $period, $selected ),
		'selected_reach' => $selected_reach,
		'page_analysis'  => ai_manga_viewer_analytics_page_analysis( $selected_reach, $metrics['sessions'] ),
		'selected_item'  => ! $is_all ? ai_manga_viewer_analytics_viewer_label( $selected, $catalog ) : array(),
	);
}

/** Build the dedicated consultation page URL for one selected Manga Library Viewer. */
function ai_manga_viewer_consultation_url( $period, $viewer_key ) {
	return add_query_arg(
		array(
			'post_type'  => 'amv_viewer',
			'page'       => 'ai-manga-viewer-consultation',
			'amv_days'   => ai_manga_viewer_analytics_report_days( $period ),
			'amv_viewer' => sanitize_key( $viewer_key ),
		),
		admin_url( 'edit.php' )
	);
}

/** Render the Viewer-first Manga Analytics report without changing collection or storage. */
function ai_manga_viewer_render_analytics_report_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'この解析を表示する権限がありません。', 'ai-manga-viewer' ) );
	}
	$days = ai_manga_viewer_analytics_report_days( $_GET['amv_days'] ?? 30 ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$period_options = array(
		'today'     => __( '今日', 'ai-manga-viewer' ),
		'yesterday' => __( '昨日', 'ai-manga-viewer' ),
		'7'         => __( '過去7日', 'ai-manga-viewer' ),
		'30'        => __( '過去30日', 'ai-manga-viewer' ),
		'90'        => __( '過去90日', 'ai-manga-viewer' ),
		'all'       => __( '全期間', 'ai-manga-viewer' ),
	);
	$requested = isset( $_GET['amv_viewer'] ) ? wp_unslash( $_GET['amv_viewer'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$context = ai_manga_viewer_analytics_context( $days, $requested );
	$catalog = $context['catalog'];
	$data = $context['data'];
	$viewer_rows = $context['viewer_rows'];
	$selected = $context['selected'];
	$is_all = $context['is_all'];
	$metrics = $context['metrics'];
	$sessions = $metrics['sessions'];
	$completion_rate = $metrics['completion_rate'];
	$cta_rate = $metrics['cta_rate'];
	$direct_count = $context['direct_count'];
	$daily_series = $context['daily_series'];
	$daily_sessions_max = 1;
	$daily_readers_max = 1;
	foreach ( $daily_series as $day ) {
		$daily_sessions_max = max( $daily_sessions_max, $day['sessions'] );
		$daily_readers_max = max( $daily_readers_max, $day['readers'] );
	}
	$daily_count = count( $daily_series );
	$label_interval = $daily_count <= 7 ? 1 : (int) ceil( $daily_count / 6 );
	$selected_reach = $context['selected_reach'];
	$selected_item = $context['selected_item'];
	$page_analysis = $context['page_analysis'];
	?>
	<div class="wrap amv-analytics">
		<h1><?php echo esc_html__( '漫画解析', 'ai-manga-viewer' ); ?></h1>
		<p class="amv-analytics-intro"><?php echo esc_html__( 'Viewerが画面内で確認された回数と、操作して読み始めたセッションを分けて集計します。掲載ページを開いただけではViewer表示に含みません。', 'ai-manga-viewer' ); ?></p>
		<form class="amv-analytics-period" method="get">
			<input type="hidden" name="post_type" value="amv_viewer" /><input type="hidden" name="page" value="ai-manga-viewer-analytics-report" /><input type="hidden" name="amv_viewer" value="<?php echo esc_attr( $selected ); ?>" />
			<label for="amv-report-days"><?php echo esc_html__( '期間', 'ai-manga-viewer' ); ?></label>
			<select id="amv-report-days" name="amv_days"><?php foreach ( $period_options as $option => $label ) : ?><option value="<?php echo esc_attr( $option ); ?>" <?php selected( $days, $option ); ?>><?php echo esc_html( $label ); ?></option><?php endforeach; ?></select>
			<?php submit_button( __( '表示', 'ai-manga-viewer' ), 'secondary', 'submit', false ); ?>
		</form>

		<h2><?php echo esc_html__( '漫画を選ぶ', 'ai-manga-viewer' ); ?></h2>
		<nav class="amv-selector" aria-label="<?php echo esc_attr__( '解析する漫画', 'ai-manga-viewer' ); ?>">
			<a class="amv-selector-card<?php echo $is_all ? ' is-selected' : ''; ?>" href="<?php echo esc_url( ai_manga_viewer_analytics_report_url( $days, 'all' ) ); ?>"<?php echo $is_all ? ' aria-current="page"' : ''; ?>><span class="amv-analytics-cover is-all" aria-hidden="true"><span class="dashicons dashicons-chart-bar"></span></span><strong><?php echo esc_html__( 'すべての漫画', 'ai-manga-viewer' ); ?></strong><small><?php echo esc_html( sprintf( __( '読書開始 %d回', 'ai-manga-viewer' ), absint( $data['total']['sessions'] ?? 0 ) ) ); ?></small></a>
			<?php foreach ( $catalog as $viewer_key => $item ) : $item_metrics = ai_manga_viewer_analytics_metrics( $viewer_rows[ $viewer_key ] ?? array() ); $item_rate = $item_metrics['sessions'] ? round( $item_metrics['completed'] * 100 / $item_metrics['sessions'], 1 ) : 0; $item_selected = $viewer_key === $selected; ?>
				<a class="amv-selector-card<?php echo $item_selected ? ' is-selected' : ''; ?>" href="<?php echo esc_url( ai_manga_viewer_analytics_report_url( $days, $viewer_key ) ); ?>"<?php echo $item_selected ? ' aria-current="page"' : ''; ?>><?php echo ai_manga_viewer_analytics_cover( $item, 'amv-selector-cover' ); ?><strong><?php echo esc_html( $item['title'] ); ?></strong><small><?php echo esc_html( sprintf( __( '読書開始 %1$d回・最終到達 %2$s%%', 'ai-manga-viewer' ), $item_metrics['sessions'], number_format_i18n( $item_rate, 1 ) ) ); ?></small></a>
			<?php endforeach; ?>
		</nav>

		<?php if ( ! $is_all ) : ?>
			<section class="amv-selected-viewer"><?php echo ai_manga_viewer_analytics_cover( $selected_item, 'amv-selected-cover' ); ?><div class="amv-selected-viewer__body"><span><?php echo esc_html__( '選択中の漫画', 'ai-manga-viewer' ); ?></span><h2><?php echo esc_html( $selected_item['title'] ); ?></h2><div class="amv-selected-actions"><?php if ( ! empty( $selected_item['url'] ) ) : ?><a class="button button-secondary" href="<?php echo esc_url( $selected_item['url'] ); ?>"><?php echo esc_html__( '漫画を編集', 'ai-manga-viewer' ); ?></a><?php endif; ?><?php if ( ai_manga_viewer_analytics_enabled() ) : ?><a class="button button-primary" href="<?php echo esc_url( ai_manga_viewer_consultation_url( $days, $selected ) ); ?>"><?php echo esc_html__( 'AI相談資料を作成', 'ai-manga-viewer' ); ?></a><?php endif; ?></div></div></section>
		<?php endif; ?>

		<section class="amv-kpis" aria-label="<?php echo esc_attr__( '主要指標', 'ai-manga-viewer' ); ?>">
			<div class="amv-kpi"><span><?php echo esc_html__( 'Viewer表示', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( number_format_i18n( $metrics['impressions'] ) ); ?></strong><small><?php echo esc_html__( '50%以上が1秒間表示、または読書操作', 'ai-manga-viewer' ); ?></small></div>
			<div class="amv-kpi"><span><?php echo esc_html__( '読書開始', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( number_format_i18n( $sessions ) ); ?></strong><small><?php echo esc_html__( '操作して読み始めた回数', 'ai-manga-viewer' ); ?></small></div>
			<div class="amv-kpi"><span><?php echo esc_html__( '開始率', 'ai-manga-viewer' ); ?></span><strong><?php echo $metrics['start_rate_available'] ? esc_html( number_format_i18n( $metrics['start_rate'], 1 ) . '%' ) : '<span aria-hidden="true">—</span>'; ?></strong><small><?php echo esc_html( $metrics['start_rate_available'] ? __( 'Viewer表示に対する読書開始', 'ai-manga-viewer' ) : __( '表示計測前を含む期間は算出しません', 'ai-manga-viewer' ) ); ?></small></div>
			<div class="amv-kpi"><span><?php echo esc_html__( '読者数', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( number_format_i18n( $metrics['readers'] ) ); ?></strong><small><?php echo esc_html__( '匿名ブラウザーIDを基準とした推定値', 'ai-manga-viewer' ); ?></small></div>
			<div class="amv-kpi"><span><?php echo esc_html__( '最終ページ到達率', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( number_format_i18n( $completion_rate, 1 ) . '%' ); ?></strong><small><?php echo esc_html__( '最終ページへ到達した割合', 'ai-manga-viewer' ); ?></small></div>
			<div class="amv-kpi"><span><?php echo esc_html__( '平均有効閲覧時間', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( number_format_i18n( $metrics['active_average'], 1 ) . '秒' ); ?></strong><small><?php echo esc_html__( '操作・閲覧が有効だった時間', 'ai-manga-viewer' ); ?></small></div>
			<div class="amv-kpi"><span><?php echo esc_html__( 'CTAクリック率', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( number_format_i18n( $cta_rate, 1 ) . '%' ); ?></strong><small><?php echo esc_html__( '読書開始後のクリックセッション', 'ai-manga-viewer' ); ?></small></div>
		</section>

		<?php if ( ! $is_all ) : ?>
			<div class="amv-analysis-grid amv-analysis-grid--overview">
			<div class="amv-analysis-column">
			<h2><?php echo esc_html__( '最終ページ到達率', 'ai-manga-viewer' ); ?></h2>
			<section class="amv-panel amv-completion"><div class="amv-donut" style="--amv-completion:<?php echo esc_attr( (string) $completion_rate ); ?>%" role="img" aria-label="<?php echo esc_attr( sprintf( __( '最終ページ到達率 %s%%', 'ai-manga-viewer' ), number_format_i18n( $completion_rate, 1 ) ) ); ?>"><div><strong class="amv-donut__value"><?php echo esc_html( number_format_i18n( $completion_rate, 1 ) . '%' ); ?></strong><span><?php echo esc_html__( '最終ページ到達', 'ai-manga-viewer' ); ?></span></div></div><div class="amv-completion-legend"><p><span class="is-complete"></span><?php echo esc_html( sprintf( __( '最終ページ到達：%d回', 'ai-manga-viewer' ), $metrics['completed'] ) ); ?></p><p><span class="is-exit"></span><?php echo esc_html( sprintf( __( '途中離脱：%d回', 'ai-manga-viewer' ), max( 0, $sessions - $metrics['completed'] ) ) ); ?></p><small><?php echo esc_html__( '到達はページ表示を示し、内容の理解や精読を断定しません。', 'ai-manga-viewer' ); ?></small></div></section>
			</div><div class="amv-analysis-column">
		<?php endif; ?>

		<h2><?php echo esc_html__( '日別推移', 'ai-manga-viewer' ); ?></h2>
		<section class="amv-panel">
			<div class="amv-chart-toolbar" role="group" aria-label="<?php echo esc_attr__( '日別指標', 'ai-manga-viewer' ); ?>"><button type="button" class="button is-active" data-amv-metric="sessions" aria-pressed="true"><?php echo esc_html__( '読書開始', 'ai-manga-viewer' ); ?></button><button type="button" class="button" data-amv-metric="readers" aria-pressed="false"><?php echo esc_html__( '読者数', 'ai-manga-viewer' ); ?></button></div>
			<div class="amv-chart-selection" aria-live="polite"><strong data-amv-chart-date><?php echo esc_html__( '日付を選択', 'ai-manga-viewer' ); ?></strong><span data-amv-chart-values><?php echo esc_html__( '棒をクリックすると読書開始数を表示します。', 'ai-manga-viewer' ); ?></span></div>
			<div class="amv-chart-scroll"><div class="amv-chart" data-amv-report-chart data-amv-metric="sessions" data-amv-max-sessions="<?php echo esc_attr( (string) $daily_sessions_max ); ?>" data-amv-max-readers="<?php echo esc_attr( (string) $daily_readers_max ); ?>" style="--amv-chart-min-width:<?php echo esc_attr( (string) max( 480, $daily_count * 12 ) ); ?>px"><span class="amv-chart-grid is-top"></span><span class="amv-chart-grid is-middle"></span><span class="amv-chart-axis is-top" data-amv-axis-top><?php echo esc_html( number_format_i18n( $daily_sessions_max ) ); ?></span><span class="amv-chart-axis is-middle" data-amv-axis-middle><?php echo esc_html( number_format_i18n( (int) ceil( $daily_sessions_max / 2 ) ) ); ?></span><span class="amv-chart-axis is-bottom">0</span>
			<?php foreach ( $daily_series as $index => $day ) : $show_label = 0 === $index || $daily_count - 1 === $index || 0 === $index % $label_interval; $bar_height = round( $day['sessions'] * 100 / $daily_sessions_max, 2 ); ?><button type="button" class="amv-chart-day" data-amv-day="<?php echo esc_attr( $day['day'] ); ?>" data-amv-sessions="<?php echo esc_attr( (string) $day['sessions'] ); ?>" data-amv-readers="<?php echo esc_attr( (string) $day['readers'] ); ?>" aria-pressed="false" aria-label="<?php echo esc_attr( sprintf( __( '%1$s、読書開始%2$d回', 'ai-manga-viewer' ), $day['day'], $day['sessions'] ) ); ?>"><span class="amv-chart-bar" style="height:<?php echo esc_attr( (string) $bar_height ); ?>%"></span><?php if ( $show_label ) : ?><span class="amv-chart-day-label"><?php echo esc_html( substr( $day['day'], 5 ) ); ?></span><?php endif; ?></button><?php endforeach; ?>
			</div></div>
		</section>
		<?php if ( ! $is_all ) : ?></div></div><?php endif; ?>

		<?php if ( $is_all ) : ?>
			<h2><?php echo esc_html__( '漫画別比較', 'ai-manga-viewer' ); ?></h2>
			<section class="amv-comparison">
			<?php if ( empty( $catalog ) ) : ?><div class="amv-empty"><?php echo esc_html__( '比較できる漫画がありません。', 'ai-manga-viewer' ); ?></div><?php else : foreach ( $catalog as $key => $item ) : $row_metrics = ai_manga_viewer_analytics_metrics( $viewer_rows[ $key ] ?? array() ); $row_completion = $row_metrics['sessions'] ? round( $row_metrics['completed'] * 100 / $row_metrics['sessions'], 1 ) : 0; $row_cta = $row_metrics['sessions'] ? round( $row_metrics['cta_sessions'] * 100 / $row_metrics['sessions'], 1 ) : 0; ?>
				<a class="amv-comparison-card" href="<?php echo esc_url( ai_manga_viewer_analytics_report_url( $days, $key ) ); ?>"><?php echo ai_manga_viewer_analytics_cover( $item, 'amv-comparison-cover' ); ?><span class="amv-comparison-main"><strong><?php echo esc_html( $item['title'] ); ?></strong><small><?php echo esc_html__( '詳細を見る', 'ai-manga-viewer' ); ?></small></span><span><small><?php echo esc_html__( '読書開始', 'ai-manga-viewer' ); ?></small><strong><?php echo esc_html( number_format_i18n( $row_metrics['sessions'] ) ); ?></strong></span><span><small><?php echo esc_html__( '読者数', 'ai-manga-viewer' ); ?></small><strong><?php echo esc_html( number_format_i18n( $row_metrics['readers'] ) ); ?></strong></span><span><small><?php echo esc_html__( '最終到達', 'ai-manga-viewer' ); ?></small><strong><?php echo esc_html( number_format_i18n( $row_completion, 1 ) . '%' ); ?></strong></span><span><small><?php echo esc_html__( '平均時間', 'ai-manga-viewer' ); ?></small><strong><?php echo esc_html( number_format_i18n( $row_metrics['active_average'], 1 ) . '秒' ); ?></strong></span><span><small><?php echo esc_html__( 'CTA率', 'ai-manga-viewer' ); ?></small><strong><?php echo esc_html( number_format_i18n( $row_cta, 1 ) . '%' ); ?></strong></span></a>
			<?php endforeach; endif; ?>
			</section>
		<?php else : ?>
			<div class="amv-analysis-grid amv-analysis-grid--progress">
			<div class="amv-analysis-column">
			<h2><?php echo esc_html__( '読書進行', 'ai-manga-viewer' ); ?></h2>
			<section class="amv-panel amv-funnel">
			<?php foreach ( array( array( __( '読書開始', 'ai-manga-viewer' ), $sessions ), array( __( '25%到達', 'ai-manga-viewer' ), $metrics['reached_25'] ), array( __( '50%到達', 'ai-manga-viewer' ), $metrics['reached_50'] ), array( __( '75%到達', 'ai-manga-viewer' ), $metrics['reached_75'] ), array( __( '最終ページ到達', 'ai-manga-viewer' ), $metrics['completed'] ) ) as $step ) : $step_rate = $sessions ? min( 100, round( $step[1] * 100 / $sessions, 1 ) ) : 0; ?><div class="amv-funnel-step"><span><?php echo esc_html( $step[0] ); ?></span><span class="amv-funnel-track"><span style="width:<?php echo esc_attr( (string) $step_rate ); ?>%"></span></span><strong><?php echo esc_html( sprintf( __( '%1$d回（%2$s%%）', 'ai-manga-viewer' ), $step[1], number_format_i18n( $step_rate, 1 ) ) ); ?></strong></div><?php endforeach; ?>
				<p class="description"><?php echo esc_html__( '各位置まで一度以上到達した読書セッション数です。内容を読んだことまでは断定しません。', 'ai-manga-viewer' ); ?></p>
			</section>
			</div>
			<?php $largest_drop = $page_analysis['largest_drop']; $largest_drop_page = $page_analysis['largest_drop_page']; ?>
			<div class="amv-analysis-column">
			<h2><?php echo esc_html__( '最大離脱箇所', 'ai-manga-viewer' ); ?></h2>
			<section class="amv-drop-summary<?php echo $largest_drop ? ' has-drop' : ''; ?>"><?php if ( $largest_drop ) : ?><span><?php echo esc_html__( '最も離脱が大きかったページ', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( sprintf( __( '%dページ目', 'ai-manga-viewer' ), $largest_drop_page ) ); ?></strong><em><?php echo esc_html( sprintf( __( '前ページから%d人減少', 'ai-manga-viewer' ), $largest_drop ) ); ?></em><?php else : ?><strong><?php echo esc_html__( 'ページ間で人数の減少はありません', 'ai-manga-viewer' ); ?></strong><span><?php echo esc_html__( '期間内に記録されたページ到達を基準にしています。', 'ai-manga-viewer' ); ?></span><?php endif; ?></section>
			</div></div>

			<h2><?php echo esc_html__( 'ページ別到達', 'ai-manga-viewer' ); ?></h2>
			<section class="amv-panel">
			<?php if ( empty( $page_analysis['pages'] ) ) : ?><div class="amv-empty"><?php echo esc_html__( '選択期間のページ到達データはありません。', 'ai-manga-viewer' ); ?></div><?php else : foreach ( $page_analysis['pages'] as $page_fact ) : ?><div class="amv-reach-row<?php echo $page_fact['drop'] ? ' has-drop' : ''; ?>"><span><?php echo esc_html( sprintf( __( '%dページ', 'ai-manga-viewer' ), $page_fact['number'] ) ); ?></span><span class="amv-reach-track"><span style="width:<?php echo esc_attr( (string) $page_fact['rate'] ); ?>%"></span></span><strong><?php echo esc_html( sprintf( __( '%1$d人・%2$s%%', 'ai-manga-viewer' ), $page_fact['reached'], number_format_i18n( $page_fact['rate'], 1 ) ) ); ?></strong><?php if ( $page_fact['drop'] ) : ?><em><?php echo esc_html( sprintf( __( '前ページから%d人減', 'ai-manga-viewer' ), $page_fact['drop'] ) ); ?></em><?php endif; ?></div><?php endforeach; endif; ?>
				<p class="description"><?php echo esc_html__( '各ページへ一度以上到達した読書セッションの割合です。', 'ai-manga-viewer' ); ?></p>
			</section>

			<h2><?php echo esc_html__( 'CTA詳細', 'ai-manga-viewer' ); ?></h2>
			<section class="amv-panel amv-cta-detail"><div><span><?php echo esc_html__( '読書後CTAクリック', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( sprintf( __( '%dセッション', 'ai-manga-viewer' ), $metrics['cta_sessions'] ) ); ?></strong><small><?php echo esc_html( sprintf( __( '読書開始に対するクリック率 %s%%', 'ai-manga-viewer' ), number_format_i18n( $cta_rate, 1 ) ) ); ?></small></div><div><span><?php echo esc_html__( '通常表示からの直接クリック', 'ai-manga-viewer' ); ?></span><strong><?php echo esc_html( sprintf( __( '%d件', 'ai-manga-viewer' ), $direct_count ) ); ?></strong><small><?php echo esc_html__( '読書開始前のクリック。CTA率には含みません。', 'ai-manga-viewer' ); ?></small></div></section>

			<details class="amv-technical"><summary><?php echo esc_html__( '詳細情報', 'ai-manga-viewer' ); ?></summary><dl><dt>Viewer Key</dt><dd><code><?php echo esc_html( $selected ); ?></code></dd><dt><?php echo esc_html__( '登録形式', 'ai-manga-viewer' ); ?></dt><dd><?php echo esc_html( 'library' === ( $selected_item['source'] ?? '' ) ? __( 'Manga Library', 'ai-manga-viewer' ) : __( '投稿内Viewer', 'ai-manga-viewer' ) ); ?></dd></dl></details>
		<?php endif; ?>
	</div>
	<?php
}
/** Render the disabled-by-default collection and retention controls. */
function ai_manga_viewer_render_analytics_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'この設定を変更する権限がありません。', 'ai-manga-viewer' ) );
	}
	$enabled    = '1' === get_option( 'ai_manga_viewer_analytics_enabled', '0' );
	$retention  = ai_manga_viewer_sanitize_retention_days( get_option( 'ai_manga_viewer_analytics_retention_days', '90' ) );
	$delete_all = '1' === get_option( 'ai_manga_viewer_analytics_delete_on_uninstall', '0' );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( '漫画解析設定', 'ai-manga-viewer' ); ?></h1>
		<?php if ( isset( $_GET['amv-data-deleted'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-success is-dismissible"><p><?php echo esc_html__( '漫画解析データを削除しました。', 'ai-manga-viewer' ); ?></p></div>
		<?php endif; ?>
		<p><?php echo esc_html__( 'Manga Library登録済み漫画について、読者が操作した後の読書開始・ページ到達・CTAクリックを保存します。ページ全体や直接配置Viewerは解析しません。', 'ai-manga-viewer' ); ?></p>
		<p><strong><?php echo esc_html__( '現在は開発中です。基本集計は「漫画解析」で確認できますが、実機検証前のデータとして扱ってください。', 'ai-manga-viewer' ); ?></strong></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'ai_manga_viewer_analytics' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php echo esc_html__( '漫画解析', 'ai-manga-viewer' ); ?></th><td><input type="hidden" name="ai_manga_viewer_analytics_enabled" value="0" /><label><input type="checkbox" name="ai_manga_viewer_analytics_enabled" value="1" <?php checked( $enabled ); ?> /> <?php echo esc_html__( '読者イベントの収集を有効にする', 'ai-manga-viewer' ); ?></label><p class="description"><?php echo esc_html__( 'Viewer表示、読書開始、ページ到達、読了、閲覧時間、CTAクリックなどを匿名で集計します。OFFにすると新しいデータの収集を停止しますが、過去の解析データは削除されません。', 'ai-manga-viewer' ); ?></p><p class="description"><?php echo esc_html__( '初期値はOFFです。ONにするとブラウザーへランダムな匿名IDを保存します。サーバーではHMAC化し、生のIDは保存しません。実機検証が完了するまではOFFを推奨します。', 'ai-manga-viewer' ); ?></p></td></tr>
				<tr><th scope="row"><label for="amv-retention-days"><?php echo esc_html__( '詳細データの保存期間', 'ai-manga-viewer' ); ?></label></th><td><input id="amv-retention-days" class="small-text" type="number" min="30" max="365" step="1" name="ai_manga_viewer_analytics_retention_days" value="<?php echo esc_attr( $retention ); ?>" /> <?php echo esc_html__( '日', 'ai-manga-viewer' ); ?><p class="description"><?php echo esc_html__( '既定は90日です。期限を過ぎたセッション・ページ到達・イベントを日次で削除します。', 'ai-manga-viewer' ); ?></p></td></tr>
				<tr><th scope="row"><?php echo esc_html__( 'アンインストール時', 'ai-manga-viewer' ); ?></th><td><input type="hidden" name="ai_manga_viewer_analytics_delete_on_uninstall" value="0" /><label><input type="checkbox" name="ai_manga_viewer_analytics_delete_on_uninstall" value="1" <?php checked( $delete_all ); ?> /> <?php echo esc_html__( '解析テーブルと設定をすべて削除する', 'ai-manga-viewer' ); ?></label></td></tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<hr />
		<h2><?php echo esc_html__( '解析データの全削除', 'ai-manga-viewer' ); ?></h2>
		<p><?php echo esc_html__( '保存済みのセッション、ページ到達、イベントをすべて削除します。この操作は元に戻せません。設定とテーブルは残ります。', 'ai-manga-viewer' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return window.confirm('<?php echo esc_js( __( '漫画解析データをすべて削除しますか？', 'ai-manga-viewer' ) ); ?>');">
			<input type="hidden" name="action" value="ai_manga_viewer_delete_analytics" />
			<?php wp_nonce_field( 'ai_manga_viewer_delete_analytics' ); ?>
			<?php submit_button( __( '解析データをすべて削除', 'ai-manga-viewer' ), 'delete', 'submit', false ); ?>
		</form>
	</div>
	<?php
}

/** Handle the explicit destructive action from the settings page. */
function ai_manga_viewer_handle_delete_analytics() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'この操作を行う権限がありません。', 'ai-manga-viewer' ) );
	}
	check_admin_referer( 'ai_manga_viewer_delete_analytics' );
	ai_manga_viewer_delete_all_analytics_data();
	wp_safe_redirect( add_query_arg( 'amv-data-deleted', '1', admin_url( 'edit.php?post_type=amv_viewer&page=ai-manga-viewer-analytics' ) ) );
	exit;
}
add_action( 'admin_post_ai_manga_viewer_delete_analytics', 'ai_manga_viewer_handle_delete_analytics' );

/** Validate an opaque client key without accepting arbitrary strings. */
function ai_manga_viewer_analytics_valid_key( $value, $max = 64 ) {
	return is_string( $value ) && strlen( $value ) <= $max && 1 === preg_match( '/^[a-z0-9_-]+$/', $value );
}

/** Convert one public event payload to a fixed allowlisted shape. */
function ai_manga_viewer_normalize_analytics_event( $payload ) {
	if ( ! is_array( $payload ) ) {
		return null;
	}
	$name = isset( $payload['name'] ) && is_string( $payload['name'] ) ? $payload['name'] : '';
	$mode = isset( $payload['mode'] ) && is_string( $payload['mode'] ) ? $payload['mode'] : '';
	if ( ! in_array( $name, array( 'viewer_impression', 'read_start', 'mode_use', 'page_reach', 'cta_click', 'active_time' ), true ) || ! in_array( $mode, array( 'standard', 'fullscreen', 'zoom', 'focus', 'standard_direct' ), true ) ) {
		return null;
	}
	$event_id    = $payload['eventId'] ?? '';
	$session_id  = $payload['sessionId'] ?? '';
	$visitor_id  = $payload['visitorId'] ?? '';
	$viewer_key  = $payload['viewerKey'] ?? '';
	$instance_key = $payload['instanceKey'] ?? '';
	$page_key    = $payload['pageKey'] ?? '';
	$cta_key     = $payload['ctaKey'] ?? '';
	$reading_started = ! empty( $payload['readingStarted'] );
	$active_seconds_delta = filter_var( $payload['activeSecondsDelta'] ?? 0, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 0, 'max_range' => 15 ) ) );
	if ( ! ai_manga_viewer_analytics_valid_key( $event_id, 80 ) || ! ai_manga_viewer_analytics_valid_key( $viewer_key ) || ! ai_manga_viewer_analytics_valid_key( $instance_key ) || ! ai_manga_viewer_analytics_valid_key( $page_key ) ) {
		return null;
	}
	$direct_cta = 'cta_click' === $name && 'standard_direct' === $mode && ! $reading_started;
	$standalone_event = $direct_cta || 'viewer_impression' === $name;
	if ( ( ! $standalone_event && ! ai_manga_viewer_analytics_valid_key( $session_id, 80 ) ) || ( $standalone_event && '' !== $session_id ) ) {
		return null;
	}
	if ( 'viewer_impression' === $name && ( 'standard' !== $mode || $reading_started ) ) {
		return null;
	}
	if ( '' !== $visitor_id && ! ai_manga_viewer_analytics_valid_key( $visitor_id, 80 ) ) {
		return null;
	}
	if ( 'cta_click' === $name ) {
		if ( ! ai_manga_viewer_analytics_valid_key( $cta_key ) ) {
			return null;
		}
	} elseif ( '' !== $cta_key || 'standard_direct' === $mode ) {
		return null;
	}
	if ( 'active_time' === $name ) {
		if ( ! $reading_started || false === $active_seconds_delta || $active_seconds_delta < 1 ) {
			return null;
		}
	} elseif ( false === $active_seconds_delta || 0 !== $active_seconds_delta ) {
		return null;
	}
	$page_number = filter_var( $payload['pageNumber'] ?? null, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1, 'max_range' => 10000 ) ) );
	$page_count  = filter_var( $payload['pageCount'] ?? null, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1, 'max_range' => 10000 ) ) );
	$page_index  = filter_var( $payload['pageIndex'] ?? null, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 0, 'max_range' => 9999 ) ) );
	$occurred_at = filter_var( $payload['occurredAt'] ?? null, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );
	if ( false === $page_number || false === $page_count || false === $page_index || false === $occurred_at || $page_number !== $page_index + 1 || $page_number > $page_count ) {
		return null;
	}
	return array(
		'name'            => $name,
		'event_id'        => $event_id,
		'session_id'      => $session_id,
		'visitor_id'      => $visitor_id,
		'viewer_key'      => $viewer_key,
		'instance_key'    => $instance_key,
		'page_key'        => $page_key,
		'page_number'     => $page_number,
		'page_count'      => $page_count,
		'cta_key'         => $cta_key,
		'mode'            => $mode,
		'reading_started' => $reading_started ? 1 : 0,
		'active_seconds_delta' => $active_seconds_delta,
		'occurred_at'     => $occurred_at,
	);
}

/** Require requests to originate from this WordPress site's public origin. */
function ai_manga_viewer_analytics_same_origin( $request ) {
	$origin = $request->get_header( 'origin' );
	if ( ! is_string( $origin ) || '' === $origin ) {
		return false;
	}
	$expected = wp_parse_url( home_url( '/' ) );
	$actual   = wp_parse_url( $origin );
	foreach ( array( 'scheme', 'host', 'port' ) as $part ) {
		if ( strtolower( (string) ( $expected[ $part ] ?? '' ) ) !== strtolower( (string) ( $actual[ $part ] ?? '' ) ) ) {
			return false;
		}
	}
	return true;
}

/** Apply a short-lived, irreversible per-address rate limit without storing the raw address. */
function ai_manga_viewer_analytics_rate_limited() {
	$address = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '';
	if ( '' === $address ) {
		return false;
	}
	$key   = 'amv_rate_' . substr( hash_hmac( 'sha256', $address, wp_salt( 'nonce' ) ), 0, 32 );
	$count = (int) get_transient( $key );
	if ( $count >= 120 ) {
		return true;
	}
	set_transient( $key, $count + 1, MINUTE_IN_SECONDS );
	return false;
}

/** Persist one validated event atomically and ignore a repeated eventId. */
function ai_manga_viewer_store_analytics_event( $event ) {
	global $wpdb;
	$tables = ai_manga_viewer_analytics_tables();
	$now    = current_time( 'mysql', true );
	$visitor_key = '' === $event['visitor_id'] ? '' : hash_hmac( 'sha256', $event['visitor_id'], wp_salt( 'auth' ) );
	$wpdb->query( 'START TRANSACTION' );
	$inserted = $wpdb->query( $wpdb->prepare(
		"INSERT IGNORE INTO {$tables['events']} (event_id,session_id,visitor_key,name,viewer_key,instance_key,page_key,page_number,page_count,cta_key,mode,reading_started,active_seconds_delta,client_occurred_at,received_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%d,%d,%s,%s,%d,%d,%d,%s)",
		$event['event_id'], $event['session_id'], $visitor_key, $event['name'], $event['viewer_key'], $event['instance_key'], $event['page_key'], $event['page_number'], $event['page_count'], $event['cta_key'], $event['mode'], $event['reading_started'], $event['active_seconds_delta'], $event['occurred_at'], $now
	) );
	if ( false === $inserted ) {
		$wpdb->query( 'ROLLBACK' );
		return false;
	}
	if ( 0 === $inserted ) {
		$wpdb->query( 'COMMIT' );
		return 'duplicate';
	}
	if ( '' !== $event['session_id'] ) {
		$mode_column = array(
			'standard'   => 'used_standard',
			'fullscreen' => 'used_fullscreen',
			'zoom'       => 'used_zoom',
			'focus'      => 'used_focus',
		)[ $event['mode'] ];
		$start_mode = 'read_start' === $event['name'] ? $event['mode'] : '';
		$cta_clicked = 'cta_click' === $event['name'] ? 1 : 0;
		$active_seconds_delta = 'active_time' === $event['name'] ? $event['active_seconds_delta'] : 0;
		$session_sql = $wpdb->prepare(
			"INSERT INTO {$tables['sessions']} (session_id,visitor_key,viewer_key,instance_key,started_at,last_activity_at,start_mode,$mode_column,max_page_number,page_count,cta_clicked,active_seconds) VALUES (%s,%s,%s,%s,%s,%s,%s,1,%d,%d,%d,%d) ON DUPLICATE KEY UPDATE last_activity_at=VALUES(last_activity_at),visitor_key=IF(visitor_key='',VALUES(visitor_key),visitor_key),$mode_column=1,max_page_number=GREATEST(max_page_number,VALUES(max_page_number)),page_count=GREATEST(page_count,VALUES(page_count)),cta_clicked=GREATEST(cta_clicked,VALUES(cta_clicked)),active_seconds=LEAST(1800,active_seconds+VALUES(active_seconds)),start_mode=IF(start_mode='',VALUES(start_mode),start_mode)",
			$event['session_id'], $visitor_key, $event['viewer_key'], $event['instance_key'], $now, $now, $start_mode, $event['page_number'], $event['page_count'], $cta_clicked, $active_seconds_delta
		);
		if ( false === $wpdb->query( $session_sql ) ) {
			$wpdb->query( 'ROLLBACK' );
			return false;
		}
		if ( 'page_reach' === $event['name'] ) {
			$reach_sql = $wpdb->prepare(
				"INSERT IGNORE INTO {$tables['reaches']} (session_id,page_key,viewer_key,instance_key,page_number,page_count,mode,first_reached_at) VALUES (%s,%s,%s,%s,%d,%d,%s,%s)",
				$event['session_id'], $event['page_key'], $event['viewer_key'], $event['instance_key'], $event['page_number'], $event['page_count'], $event['mode'], $now
			);
			if ( false === $wpdb->query( $reach_sql ) ) {
				$wpdb->query( 'ROLLBACK' );
				return false;
			}
		}
	}
	$wpdb->query( 'COMMIT' );
	return true;
}

/** Public same-origin endpoint for allowlisted reader events. */
function ai_manga_viewer_receive_analytics_event( $request ) {
	if ( ! ai_manga_viewer_analytics_enabled() ) {
		return new WP_Error( 'amv_analytics_disabled', __( '漫画解析は無効です。', 'ai-manga-viewer' ), array( 'status' => 503 ) );
	}
	if ( ! ai_manga_viewer_analytics_same_origin( $request ) ) {
		return new WP_Error( 'amv_invalid_origin', __( '送信元を確認できません。', 'ai-manga-viewer' ), array( 'status' => 403 ) );
	}
	if ( ai_manga_viewer_analytics_rate_limited() ) {
		return new WP_Error( 'amv_rate_limited', __( '送信回数が多すぎます。', 'ai-manga-viewer' ), array( 'status' => 429 ) );
	}
	$event = ai_manga_viewer_normalize_analytics_event( $request->get_json_params() );
	if ( ! $event ) {
		return new WP_Error( 'amv_invalid_event', __( 'イベント形式が正しくありません。', 'ai-manga-viewer' ), array( 'status' => 400 ) );
	}
	if ( ! ai_manga_viewer_analytics_viewer_is_registered( $event['viewer_key'] ) ) {
		return new WP_Error( 'amv_viewer_not_registered', __( '漫画ライブラリに登録されていないViewerは解析対象外です。', 'ai-manga-viewer' ), array( 'status' => 403 ) );
	}
	$stored = ai_manga_viewer_store_analytics_event( $event );
	if ( false === $stored ) {
		return new WP_Error( 'amv_store_failed', __( 'イベントを保存できませんでした。', 'ai-manga-viewer' ), array( 'status' => 500 ) );
	}
	return new WP_REST_Response( array( 'accepted' => true, 'duplicate' => 'duplicate' === $stored ), 'duplicate' === $stored ? 200 : 202 );
}

/** Return the current collection switch outside page-cache HTML. */
function ai_manga_viewer_receive_analytics_config() {
	$response = new WP_REST_Response( array( 'enabled' => ai_manga_viewer_analytics_enabled() ), 200 );
	if ( method_exists( $response, 'header' ) ) {
		$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
	}
	return $response;
}

/** Register the anonymous reader-event route. */
function ai_manga_viewer_register_analytics_routes() {
	register_rest_route(
		'ai-manga-viewer/v1',
		'/config',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'ai_manga_viewer_receive_analytics_config',
			'permission_callback' => '__return_true',
		)
	);
	register_rest_route(
		'ai-manga-viewer/v1',
		'/events',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'ai_manga_viewer_receive_analytics_event',
			'permission_callback' => '__return_true',
		)
	);
}
add_action( 'rest_api_init', 'ai_manga_viewer_register_analytics_routes' );
