<?php
/** Verify the Core-owned Analytics lifecycle/storage boundary in isolation. */

$fixture = sys_get_temp_dir() . '/amv-analytics-lifecycle-' . uniqid( '', true ) . '/';
mkdir( $fixture . 'wp-admin/includes', 0777, true );
file_put_contents( $fixture . 'wp-admin/includes/upgrade.php', "<?php\n" );
define( 'ABSPATH', $fixture );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );

$GLOBALS['amv_options'] = array();
$GLOBALS['amv_actions'] = array();
$GLOBALS['amv_dbdelta'] = array();
$GLOBALS['amv_scheduled'] = false;
$GLOBALS['amv_cleared'] = array();

function add_action( $hook, $callback ) { $GLOBALS['amv_actions'][ $hook ][] = $callback; }
function apply_filters( $hook, $value ) { return $value; }
function absint( $value ) { return abs( (int) $value ); }
function get_option( $name, $default = false ) { return array_key_exists( $name, $GLOBALS['amv_options'] ) ? $GLOBALS['amv_options'][ $name ] : $default; }
function add_option( $name, $value ) { if ( array_key_exists( $name, $GLOBALS['amv_options'] ) ) return false; $GLOBALS['amv_options'][ $name ] = $value; return true; }
function update_option( $name, $value ) { $GLOBALS['amv_options'][ $name ] = $value; return true; }
function delete_option( $name ) { unset( $GLOBALS['amv_options'][ $name ] ); return true; }
function wp_next_scheduled() { return $GLOBALS['amv_scheduled']; }
function wp_schedule_event() { $GLOBALS['amv_scheduled'] = true; return true; }
function wp_clear_scheduled_hook( $hook ) { $GLOBALS['amv_cleared'][] = $hook; $GLOBALS['amv_scheduled'] = false; }
function register_setting() {}
function dbDelta( $sql ) { $GLOBALS['amv_dbdelta'][] = $sql; }
function current_time() { return '2026-09-30 00:00:00'; }
function wp_salt() { return 'test-salt'; }

class AMV_Lifecycle_WPDB {
	public $prefix = 'wp_';
	public $queries = array();
	public function get_charset_collate() { return 'DEFAULT CHARSET=utf8mb4'; }
	public function prepare( $query, ...$values ) {
		foreach ( $values as $value ) {
			if ( preg_match( '/%([ids])/', $query, $match ) && 'i' === $match[1] ) {
				$replacement = '`' . str_replace( '`', '``', (string) $value ) . '`';
			} else {
				$replacement = is_int( $value ) ? (string) $value : "'" . str_replace( "'", "''", (string) $value ) . "'";
			}
			$query = preg_replace( '/%[ids]/', $replacement, $query, 1 );
		}
		return $query;
	}
	public function query( $query ) { $this->queries[] = $query; return 1; }
}
$GLOBALS['wpdb'] = new AMV_Lifecycle_WPDB();

require dirname( __DIR__ ) . '/includes/analytics/lifecycle.php';
require dirname( __DIR__ ) . '/includes/analytics/storage.php';

function amv_expect( $condition, $message ) { if ( ! $condition ) throw new RuntimeException( $message ); }

amv_expect( '3' === ai_manga_viewer_get_analytics_schema_version(), 'Schema version API changed.' );
amv_expect( function_exists( 'ai_manga_viewer_store_analytics_event' ), 'Storage API missing.' );
amv_expect( ! function_exists( 'ai_manga_viewer_analytics_report_data' ), 'Query module leaked into lifecycle boundary.' );
amv_expect( ! function_exists( 'ai_manga_viewer_register_analytics_routes' ), 'REST module leaked into lifecycle boundary.' );
amv_expect( ! function_exists( 'ai_manga_viewer_render_analytics_report_page' ), 'Admin module leaked into lifecycle boundary.' );

$GLOBALS['wpdb']->queries = array();
$stored = ai_manga_viewer_store_analytics_event( array(
	'event_id'             => 'event-1',
	'session_id'           => 'session-1',
	'visitor_id'           => 'visitor-1',
	'name'                 => 'page_reach',
	'viewer_key'           => 'viewer-1',
	'instance_key'         => 'instance-1',
	'page_key'             => 'page-1',
	'page_number'          => 1,
	'page_count'           => 3,
	'cta_key'              => '',
	'mode'                 => 'standard',
	'reading_started'      => 1,
	'active_seconds_delta' => 0,
	'occurred_at'          => 1,
) );
amv_expect( true === $stored, 'Analytics event storage failed.' );
amv_expect( 5 === count( $GLOBALS['wpdb']->queries ), 'Analytics event transaction query count changed.' );
amv_expect( 0 === preg_match( '/%[ids]/', implode( "\n", $GLOBALS['wpdb']->queries ) ), 'Prepared Analytics SQL retained placeholders.' );
amv_expect( false !== strpos( implode( "\n", $GLOBALS['wpdb']->queries ), '`wp_amv_reader_events`' ), 'Analytics table identifier was not prepared.' );

ai_manga_viewer_install_analytics_tables();
amv_expect( 3 === count( $GLOBALS['amv_dbdelta'] ), 'Expected three Analytics tables.' );
amv_expect( '0' === get_option( 'ai_manga_viewer_analytics_enabled' ), 'Analytics must remain disabled by default.' );
amv_expect( '90' === get_option( 'ai_manga_viewer_analytics_retention_days' ), 'Retention default changed.' );
amv_expect( true === $GLOBALS['amv_scheduled'], 'Cleanup schedule was not registered.' );

$GLOBALS['wpdb']->queries = array();
ai_manga_viewer_cleanup_analytics_data();
amv_expect( 3 === count( $GLOBALS['wpdb']->queries ), 'Cleanup must run independently of collection state.' );

$GLOBALS['wpdb']->queries = array();
ai_manga_viewer_delete_all_analytics_data();
amv_expect( 3 === count( $GLOBALS['wpdb']->queries ), 'Manual deletion must clear all Analytics tables.' );

$GLOBALS['wpdb']->queries = array();
ai_manga_viewer_uninstall_analytics();
amv_expect( 0 === count( $GLOBALS['wpdb']->queries ), 'Uninstall must preserve data without opt-in.' );
$GLOBALS['amv_options']['ai_manga_viewer_analytics_delete_on_uninstall'] = '1';
ai_manga_viewer_uninstall_analytics();
amv_expect( 3 === count( $GLOBALS['wpdb']->queries ), 'Opt-in uninstall must drop all Analytics tables.' );
amv_expect( false === get_option( 'ai_manga_viewer_analytics_db_version', false ), 'Schema option was not deleted.' );

unlink( $fixture . 'wp-admin/includes/upgrade.php' );
rmdir( $fixture . 'wp-admin/includes' );
rmdir( $fixture . 'wp-admin' );
rmdir( $fixture );
echo "Analytics lifecycle smoke passed.\n";
