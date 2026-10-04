<?php
/**
 * MangaFocus Analytics internal module.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Delete every analytics row while retaining the schema and settings. */
function ai_manga_viewer_delete_all_analytics_data() {
	global $wpdb;
	foreach ( array_reverse( ai_manga_viewer_analytics_tables() ) as $table ) {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- This intentionally clears plugin-owned Analytics tables; cached reads are not used.
		$wpdb->query( $wpdb->prepare( 'DELETE FROM %i', $table ) );
	}
}

/** Persist one validated event atomically and ignore a repeated eventId. */
function ai_manga_viewer_store_analytics_event( $event ) {
	global $wpdb;
	$tables = ai_manga_viewer_analytics_tables();
	$now    = current_time( 'mysql', true );
	$visitor_key = '' === $event['visitor_id'] ? '' : hash_hmac( 'sha256', $event['visitor_id'], wp_salt( 'auth' ) );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control is required for the plugin-owned Analytics tables.
	$wpdb->query( 'START TRANSACTION' );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Analytics events are written to a plugin-owned table and are not cacheable.
	$inserted = $wpdb->query( $wpdb->prepare(
		'INSERT IGNORE INTO %i (event_id,session_id,visitor_key,name,viewer_key,instance_key,page_key,page_number,page_count,cta_key,mode,reading_started,active_seconds_delta,client_occurred_at,received_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%d,%d,%s,%s,%d,%d,%d,%s)',
		$tables['events'], $event['event_id'], $event['session_id'], $visitor_key, $event['name'], $event['viewer_key'], $event['instance_key'], $event['page_key'], $event['page_number'], $event['page_count'], $event['cta_key'], $event['mode'], $event['reading_started'], $event['active_seconds_delta'], $event['occurred_at'], $now
	) );
	if ( false === $inserted ) {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control does not use the object cache.
		$wpdb->query( 'ROLLBACK' );
		return false;
	}
	if ( 0 === $inserted ) {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control does not use the object cache.
		$wpdb->query( 'COMMIT' );
		return 'duplicate';
	}
	if ( '' !== $event['session_id'] ) {
		$mode_column = array(
			'standard'   => 'used_standard',
			'fullscreen' => 'used_fullscreen',
			'vertical'   => 'used_fullscreen',
			'zoom'       => 'used_zoom',
			'focus'      => 'used_focus',
		)[ $event['mode'] ];
		$start_mode = 'read_start' === $event['name'] ? $event['mode'] : '';
		$cta_clicked = 'cta_click' === $event['name'] ? 1 : 0;
		$active_seconds_delta = 'active_time' === $event['name'] ? $event['active_seconds_delta'] : 0;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Session aggregates are written atomically to a plugin-owned table and are not cacheable.
		if ( false === $wpdb->query( $wpdb->prepare(
			"INSERT INTO %i (session_id,visitor_key,viewer_key,instance_key,started_at,last_activity_at,start_mode,%i,max_page_number,page_count,cta_clicked,active_seconds) VALUES (%s,%s,%s,%s,%s,%s,%s,1,%d,%d,%d,%d) ON DUPLICATE KEY UPDATE last_activity_at=VALUES(last_activity_at),visitor_key=IF(visitor_key='',VALUES(visitor_key),visitor_key),%i=1,max_page_number=GREATEST(max_page_number,VALUES(max_page_number)),page_count=GREATEST(page_count,VALUES(page_count)),cta_clicked=GREATEST(cta_clicked,VALUES(cta_clicked)),active_seconds=LEAST(1800,active_seconds+VALUES(active_seconds)),start_mode=IF(start_mode='',VALUES(start_mode),start_mode)",
			$tables['sessions'], $mode_column, $event['session_id'], $visitor_key, $event['viewer_key'], $event['instance_key'], $now, $now, $start_mode, $event['page_number'], $event['page_count'], $cta_clicked, $active_seconds_delta, $mode_column
		) ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control does not use the object cache.
			$wpdb->query( 'ROLLBACK' );
			return false;
		}
		if ( 'page_reach' === $event['name'] ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Page reach rows are written to a plugin-owned table and are not cacheable.
			if ( false === $wpdb->query( $wpdb->prepare(
				'INSERT IGNORE INTO %i (session_id,page_key,viewer_key,instance_key,page_number,page_count,mode,first_reached_at) VALUES (%s,%s,%s,%s,%d,%d,%s,%s)',
				$tables['reaches'], $event['session_id'], $event['page_key'], $event['viewer_key'], $event['instance_key'], $event['page_number'], $event['page_count'], $event['mode'], $now
			) ) ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control does not use the object cache.
				$wpdb->query( 'ROLLBACK' );
				return false;
			}
		}
	}
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction control does not use the object cache.
	$wpdb->query( 'COMMIT' );
	return true;
}
