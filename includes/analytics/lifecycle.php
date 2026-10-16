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

/** Return the current Analytics storage schema version. */
function ai_manga_viewer_get_analytics_schema_version() {
	return AI_MANGA_VIEWER_ANALYTICS_DB_VERSION;
}

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
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Retention cleanup targets plugin-owned event rows; cached reads are not used.
	$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE received_at < %s', $tables['events'], $cutoff ) );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Retention cleanup targets plugin-owned reach rows; cached reads are not used.
	$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE first_reached_at < %s', $tables['reaches'], $cutoff ) );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Retention cleanup targets plugin-owned session rows; cached reads are not used.
	$wpdb->query( $wpdb->prepare( 'DELETE FROM %i WHERE last_activity_at < %s', $tables['sessions'], $cutoff ) );
}
add_action( 'ai_manga_viewer_analytics_daily_cleanup', 'ai_manga_viewer_cleanup_analytics_data' );

/** Drop analytics storage only when the administrator opted into uninstall deletion. */
function ai_manga_viewer_uninstall_analytics() {
	wp_clear_scheduled_hook( 'ai_manga_viewer_analytics_daily_cleanup' );
	if ( '1' !== get_option( 'ai_manga_viewer_analytics_delete_on_uninstall', '0' ) ) {
		return;
	}
	global $wpdb;
	foreach ( array_reverse( ai_manga_viewer_analytics_tables() ) as $table ) {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.DirectDatabaseQuery.SchemaChange -- Explicit uninstall opt-in requires dropping the plugin-owned Analytics tables.
		$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $table ) );
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
