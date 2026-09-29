<?php
/** Isolated validation and persistence test; this does not use a real WordPress database. */
define( 'ABSPATH', __DIR__ . '/' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'ARRAY_A', 'ARRAY_A' );
define( 'OBJECT_K', 'OBJECT_K' );
class WP_REST_Server { const CREATABLE = 'POST'; const READABLE = 'GET'; }
class WP_Error {
	public $code; public $data;
	public function __construct( $code, $message, $data ) { $this->code = $code; $this->data = $data; }
}
class WP_REST_Response {
	public $data; public $status;
	public function __construct( $data, $status ) { $this->data = $data; $this->status = $status; }
}
class AMV_Test_Request {
	private $origin; private $payload;
	public function __construct( $origin, $payload ) { $this->origin = $origin; $this->payload = $payload; }
	public function get_header( $name ) { return 'origin' === $name ? $this->origin : ''; }
	public function get_json_params() { return $this->payload; }
}
class AMV_Test_Wpdb {
	public $prefix = 'wp_'; public $queries = array(); public $seen_events = array(); public $report_fixture = false; public $report_sessions = 2; public $report_impressions = 4; public $report_completed = 0; public $report_cta = 0; public $report_drop = true;
	public function get_charset_collate() { return 'DEFAULT CHARACTER SET utf8mb4'; }
	public function prepare( $query, ...$args ) {
		foreach ( $args as $arg ) {
			$query = preg_replace_callback( '/%[sd]/', function( $match ) use ( $arg ) { return '%d' === $match[0] ? (string) (int) $arg : "'" . str_replace( "'", "''", (string) $arg ) . "'"; }, $query, 1 );
		}
		return $query;
	}
	public function query( $query ) {
		$this->queries[] = $query;
		if ( false !== strpos( $query, 'INSERT IGNORE INTO wp_amv_reader_events' ) ) {
			preg_match( "/VALUES \\('([^']+)'/", $query, $match );
			$event_id = $match[1] ?? '';
			if ( isset( $this->seen_events[ $event_id ] ) ) { return 0; }
			$this->seen_events[ $event_id ] = true;
			return 1;
		}
		return 1;
	}
	private function metrics() { return array( 'sessions' => (string) $this->report_sessions, 'readers' => '1', 'reached_25' => (string) $this->report_sessions, 'reached_50' => (string) $this->report_sessions, 'reached_75' => (string) min( 1, $this->report_sessions ), 'completed' => (string) $this->report_completed, 'cta_sessions' => (string) $this->report_cta, 'active_seconds' => '20', 'active_average' => '10', 'page_count' => '2' ); }
	public function get_row( $query ) { $this->queries[] = $query; return $this->report_fixture ? $this->metrics() : array( 'sessions' => '0' ); }
	public function get_results( $query ) {
		$this->queries[] = $query;
		if ( ! $this->report_fixture ) return array();
		$today = ( new DateTimeImmutable( 'today', wp_timezone() ) )->format( 'Y-m-d' );
		if ( false !== strpos( $query, "name = 'viewer_impression'" ) && false !== strpos( $query, 'GROUP BY viewer_key' ) ) return array( 'library-viewer-2440' => (object) array( 'viewer_key' => 'library-viewer-2440', 'impressions' => (string) $this->report_impressions ) );
		if ( false !== strpos( $query, 'INNER JOIN wp_amv_reader_sessions' ) ) return array( array( 'viewer_key' => 'library-viewer-2440', 'page_number' => '1', 'page_count' => '2', 'reached' => '2' ), array( 'viewer_key' => 'library-viewer-2440', 'page_number' => '2', 'page_count' => '2', 'reached' => $this->report_drop ? '1' : '2' ) );
		if ( false !== strpos( $query, 'SELECT viewer_key,' ) && false !== strpos( $query, ' AS day,' ) ) return array( array( 'viewer_key' => 'library-viewer-2440', 'day' => $today, 'sessions' => '2', 'readers' => '1' ) );
		if ( false !== strpos( $query, ' AS day,' ) ) return array( array( 'day' => $today, 'sessions' => '2', 'readers' => '1' ) );
		if ( false !== strpos( $query, 'FROM wp_amv_reader_sessions' ) && false !== strpos( $query, 'GROUP BY viewer_key' ) ) return array( array_merge( array( 'viewer_key' => 'library-viewer-2440' ), $this->metrics() ) );
		return array();
	}
	public function get_var( $query ) { $this->queries[] = $query; return $this->report_fixture && false !== strpos( $query, "name = 'viewer_impression'" ) ? (string) $this->report_impressions : '0'; }
}
function add_action() {}
function apply_filters( $hook, $value ) { return $value; }
function absint( $value ) { return abs( (int) $value ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_-]/', '', strtolower( (string) $value ) ); }
function sanitize_html_class( $value ) { return preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $value ); }
function esc_url_raw( $value ) { return preg_match( '~^https?://~', (string) $value ) ? (string) $value : ''; }
function get_option( $name, $default = false ) { return $GLOBALS['options'][ $name ] ?? $default; }
function delete_option( $name ) { $GLOBALS['deleted_options'][] = $name; }
function home_url( $path = '' ) { return 'https://example.test' . $path; }
function wp_parse_url( $url ) { return parse_url( $url ); }
function wp_salt() { return 'test-salt'; }
function get_transient() { return 0; }
function set_transient() { return true; }
function delete_transient() { return true; }
function current_time() { return '2026-09-27 12:00:00'; }
function wp_timezone() { return new DateTimeZone( 'Asia/Tokyo' ); }
function __( $text ) { return $text; }
function esc_html__( $text ) { return htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' ); }
function esc_attr__( $text ) { return htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $text ) { return esc_attr( $text ); }
function number_format_i18n( $number, $decimals = 0 ) { return number_format( (float) $number, $decimals ); }
function wp_parse_args( $args, $defaults ) { return array_merge( $defaults, (array) $args ); }
function current_user_can() { return true; }
function selected( $selected, $current ) { if ( $selected === $current ) echo 'selected="selected"'; }
function submit_button( $text ) { echo '<button>' . esc_html( $text ) . '</button>'; }
function wp_unslash( $value ) { return $value; }
function admin_url( $path = '' ) { return 'https://example.test/wp-admin/' . ltrim( $path, '/' ); }
function add_query_arg( $args, $url ) { return $url . '?' . http_build_query( $args ); }
function get_posts( $args = array() ) { if ( 'amv_viewer' === ( $args['post_type'] ?? '' ) ) return array( (object) array( 'ID' => 2440, 'post_type' => 'amv_viewer', 'post_content' => 'library-content' ), (object) array( 'ID' => 2441, 'post_type' => 'amv_viewer', 'post_content' => 'library-empty-content' ) ); return array(); }
function get_post( $post_id ) { return 2421 === (int) $post_id ? (object) array( 'ID' => 2421, 'post_type' => 'post', 'post_content' => 'direct-content' ) : null; }
function parse_blocks( $content ) { if ( 'library-content' === $content ) return array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'viewerKey' => 'library-viewer-2440', 'pages' => array( array( 'url' => 'https://example.test/library-cover.jpg' ) ) ), 'innerBlocks' => array() ) ); if ( 'library-empty-content' === $content ) return array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'viewerKey' => 'library-viewer-2441', 'pages' => array() ), 'innerBlocks' => array() ) ); if ( 'direct-content' === $content ) return array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'pages' => array( array( 'url' => 'https://example.test/direct-cover.jpg' ) ) ), 'innerBlocks' => array() ) ); return array(); }
function ai_manga_viewer_find_library_block( $blocks ) { foreach ( (array) $blocks as $block ) { if ( 'ai-manga-viewer/viewer' === ( $block['blockName'] ?? '' ) ) return $block; } return null; }
function get_the_post_thumbnail_url( $post_id ) { return 2440 === (int) $post_id ? 'https://example.test/featured-cover.jpg' : false; }
function wp_get_attachment_image_url() { return false; }
function get_the_title( $post_id ) { $id = is_object( $post_id ) ? $post_id->ID : (int) $post_id; if ( 2421 === $id ) return '制作実績サンプル'; if ( 2440 === $id ) return '登録漫画1'; if ( 2441 === $id ) return '登録漫画2・解析なし'; return ''; }
function get_edit_post_link( $post_id ) { return 'https://example.test/wp-admin/post.php?post=' . (int) $post_id . '&action=edit'; }
function register_rest_route() {}
function wp_clear_scheduled_hook( $hook ) { $GLOBALS['cleared_hooks'][] = $hook; }
$GLOBALS['wpdb'] = new AMV_Test_Wpdb();
$GLOBALS['options'] = array( 'ai_manga_viewer_analytics_enabled' => '0', 'ai_manga_viewer_analytics_retention_days' => '90', 'ai_manga_viewer_analytics_delete_on_uninstall' => '0' );
require dirname( __DIR__ ) . '/includes/analytics.php';

if ( '30' !== ai_manga_viewer_sanitize_retention_days( 1 ) || '365' !== ai_manga_viewer_sanitize_retention_days( 999 ) || '90' !== ai_manga_viewer_sanitize_retention_days( 'invalid' ) || '1' !== ai_manga_viewer_sanitize_checkbox( true ) || '0' !== ai_manga_viewer_sanitize_checkbox( false ) ) { throw new Exception( 'Analytics setting sanitization failed' ); }
if ( '30' !== ai_manga_viewer_analytics_report_days( 1 ) || 'today' !== ai_manga_viewer_analytics_report_days( 'today' ) || 'yesterday' !== ai_manga_viewer_analytics_report_days( 'yesterday' ) || '7' !== ai_manga_viewer_analytics_report_days( 7 ) || '90' !== ai_manga_viewer_analytics_report_days( 90 ) || 'all' !== ai_manga_viewer_analytics_report_days( 'all' ) ) { throw new Exception( 'Analytics report period sanitization failed' ); }
$fixed_now = new DateTimeImmutable( '2026-09-28 12:34:56', wp_timezone() );
$today_bounds = ai_manga_viewer_analytics_period_bounds( 'today', $fixed_now );
$yesterday_bounds = ai_manga_viewer_analytics_period_bounds( 'yesterday', $fixed_now );
$week_bounds = ai_manga_viewer_analytics_period_bounds( 7, $fixed_now );
$all_bounds = ai_manga_viewer_analytics_period_bounds( 'all', $fixed_now );
if ( '2026-09-27 15:00:00' !== $today_bounds['start'] || '2026-09-28 03:34:56' !== $today_bounds['end'] || $today_bounds['end_exclusive'] || '2026-09-26 15:00:00' !== $yesterday_bounds['start'] || '2026-09-27 15:00:00' !== $yesterday_bounds['end'] || ! $yesterday_bounds['end_exclusive'] || '2026-09-21 15:00:00' !== $week_bounds['start'] || '' !== $all_bounds['start'] || '' !== $all_bounds['end'] ) { throw new Exception( 'WordPress-timezone Analytics period bounds failed' ); }
$report = ai_manga_viewer_analytics_report_data( 7 );
if ( ! isset( $report['total'], $report['rows'], $report['daily_rows'], $report['reach_rows'], $report['direct_total'], $report['direct_rows'], $report['impression_total'], $report['impression_rows'] ) ) { throw new Exception( 'Analytics report query shape failed' ); }
if ( false === strpos( implode( "\n", $GLOBALS['wpdb']->queries ), "viewer_key IN ('library-viewer-2440','library-viewer-2441')" ) ) { throw new Exception( 'Analytics report was not scoped to Manga Library Viewer keys' ); }
$daily_series = ai_manga_viewer_analytics_daily_series( array( array( 'viewer_key' => 'all', 'day' => ( new DateTimeImmutable( 'today', wp_timezone() ) )->format( 'Y-m-d' ), 'sessions' => '3', 'readers' => '2' ), array( 'viewer_key' => 'viewer-a', 'day' => ( new DateTimeImmutable( 'today', wp_timezone() ) )->format( 'Y-m-d' ), 'sessions' => '99', 'readers' => '99' ) ), 7 );
if ( 7 !== count( $daily_series ) || 3 !== $daily_series[6]['sessions'] || 2 !== $daily_series[6]['readers'] ) { throw new Exception( 'Analytics daily chart series failed' ); }
$today_series = ai_manga_viewer_analytics_daily_series( array(), 'today' );
$yesterday_series = ai_manga_viewer_analytics_daily_series( array(), 'yesterday' );
$all_series = ai_manga_viewer_analytics_daily_series( array( array( 'viewer_key' => 'all', 'day' => '2026-08-01', 'sessions' => '1', 'readers' => '1' ), array( 'viewer_key' => 'all', 'day' => '2026-09-01', 'sessions' => '2', 'readers' => '2' ) ), 'all' );
if ( 1 !== count( $today_series ) || ( new DateTimeImmutable( 'today', wp_timezone() ) )->format( 'Y-m-d' ) !== $today_series[0]['day'] || 1 !== count( $yesterday_series ) || ( new DateTimeImmutable( 'yesterday', wp_timezone() ) )->format( 'Y-m-d' ) !== $yesterday_series[0]['day'] || 2 !== count( $all_series ) || '2026-08-01' !== $all_series[0]['day'] || '2026-09-01' !== $all_series[1]['day'] ) { throw new Exception( 'Single-day or all-time Analytics chart series failed' ); }
$query_count = count( $GLOBALS['wpdb']->queries );
ai_manga_viewer_analytics_report_data( 'all' );
$all_period_sql = implode( "\n", array_slice( $GLOBALS['wpdb']->queries, $query_count ) );
if ( false !== strpos( $all_period_sql, 'started_at >=' ) || false !== strpos( $all_period_sql, 'received_at >=' ) ) { throw new Exception( 'All-time Analytics query was unexpectedly date-bounded' ); }
$reach_series = ai_manga_viewer_analytics_reach_series( array( array( 'viewer_key' => 'Viewer-ABC!!', 'page_number' => '2', 'page_count' => '5', 'reached' => '3' ), array( 'viewer_key' => '', 'page_number' => '1', 'page_count' => '5', 'reached' => '9' ) ) );
if ( 5 !== ( $reach_series['viewer-abc']['page_count'] ?? 0 ) || 3 !== ( $reach_series['viewer-abc']['pages'][2] ?? 0 ) || 1 !== count( $reach_series ) ) { throw new Exception( 'Analytics page reach series failed' ); }
if ( false === strpos( ai_manga_viewer_analytics_cover( array( 'cover' => '' ) ), 'is-placeholder' ) ) { throw new Exception( 'Missing-cover placeholder failed' ); }
$selection_catalog = array( 'library-viewer-2440' => array(), 'library-viewer-2441' => array() );
$selection_rows = array( array( 'viewer_key' => 'legacy-post-2421-viewer-1', 'sessions' => 2 ) );
if ( 'library-viewer-2440' !== ai_manga_viewer_analytics_selected_viewer( 'library-viewer-2440', $selection_rows, $selection_catalog ) || 'library-viewer-2440' !== ai_manga_viewer_analytics_selected_viewer( '', $selection_rows, $selection_catalog ) || 'library-viewer-2440' !== ai_manga_viewer_analytics_selected_viewer( '', array(), $selection_catalog ) || 'all' !== ai_manga_viewer_analytics_selected_viewer( 'all', $selection_rows, $selection_catalog ) ) { throw new Exception( 'Viewer selection priority failed' ); }
$catalog = ai_manga_viewer_analytics_viewer_catalog( array( array( 'viewer_key' => 'legacy-post-2421-viewer-1' ) ) );
if ( isset( $catalog['legacy-post-2421-viewer-1'] ) || ! isset( $catalog['library-viewer-2440'], $catalog['library-viewer-2441'] ) ) { throw new Exception( 'Direct Viewer leaked into the Manga Library analytics catalog' ); }
$GLOBALS['wpdb']->report_fixture = true;
unset( $_GET['amv_viewer'] );
ob_start(); ai_manga_viewer_render_analytics_report_page(); $report_html = ob_get_clean();
foreach ( array( '今日', '昨日', '過去7日', '過去30日', '過去90日', '全期間', '漫画を選ぶ', 'すべての漫画', '選択中の漫画', '登録漫画1', '登録漫画2・解析なし', 'Viewer表示', '開始率', '50.0%', '読者数', '匿名ブラウザーIDを基準とした推定値', '最終ページ到達率', '0.0%', '日別推移', '読書進行', '25%到達', '最大離脱箇所', '2ページ目', 'ページ別到達', '1人・50.0%', 'CTA詳細', '0セッション', '0件', '詳細情報', 'featured-cover.jpg', 'amv-analysis-grid' ) as $expected ) {
	if ( false === strpos( $report_html, $expected ) ) { throw new Exception( 'Analytics report visualization missing: ' . $expected ); }
}
if ( false !== strpos( $report_html, '投稿内Viewer' ) || false !== strpos( $report_html, 'legacy-post-2421-viewer-1' ) || false !== strpos( $report_html, '<style>' ) || false === strpos( $report_html, 'name="amv_viewer" value="library-viewer-2440"' ) || false !== strpos( $report_html, 'AI相談資料を作成' ) ) { throw new Exception( 'Direct Viewer leaked, AI consultation action appeared while Analytics was disabled, CSS was not separated, or period selection was not preserved' ); }
$GLOBALS['options']['ai_manga_viewer_analytics_enabled'] = '1';
ob_start(); ai_manga_viewer_render_analytics_report_page(); $enabled_report_html = ob_get_clean();
if ( false === strpos( $enabled_report_html, 'AI相談資料を作成' ) || false === strpos( $enabled_report_html, 'amv-selected-viewer__body' ) || false === strpos( $enabled_report_html, 'button button-secondary' ) ) { throw new Exception( 'Enabled Analytics consultation action or selected Viewer layout failed' ); }
$GLOBALS['options']['ai_manga_viewer_analytics_enabled'] = '0';
$_GET['amv_viewer'] = 'all';
ob_start(); ai_manga_viewer_render_analytics_report_page(); $all_report_html = ob_get_clean();
if ( false === strpos( $all_report_html, '漫画別比較' ) || false === strpos( $all_report_html, '登録漫画1' ) || false === strpos( $all_report_html, '登録漫画2・解析なし' ) || false !== strpos( $all_report_html, '投稿内Viewer' ) || false !== strpos( $all_report_html, '<h2>読書進行</h2>' ) || false !== strpos( $all_report_html, '<h2>ページ別到達</h2>' ) ) { throw new Exception( 'All-Viewer report hierarchy failed' ); }
$_GET['amv_viewer'] = 'library-viewer-2441';
ob_start(); ai_manga_viewer_render_analytics_report_page(); $library_report_html = ob_get_clean();
if ( false === strpos( $library_report_html, '登録漫画2・解析なし' ) || false === strpos( $library_report_html, 'is-placeholder' ) || false === strpos( $library_report_html, '>0</strong>' ) ) { throw new Exception( 'Zero-data Manga Library report failed' ); }
$GLOBALS['wpdb']->report_completed = 2;
$GLOBALS['wpdb']->report_cta = 1;
$_GET['amv_viewer'] = 'library-viewer-2440';
ob_start(); ai_manga_viewer_render_analytics_report_page(); $complete_report_html = ob_get_clean();
if ( false === strpos( $complete_report_html, '100.0%' ) || false === strpos( $complete_report_html, '50.0%' ) || false === strpos( $complete_report_html, '1セッション' ) ) { throw new Exception( '100-percent completion or CTA report failed' ); }
$GLOBALS['wpdb']->report_sessions = 1;
$GLOBALS['wpdb']->report_completed = 0;
$GLOBALS['wpdb']->report_cta = 0;
ob_start(); ai_manga_viewer_render_analytics_report_page(); $one_session_report_html = ob_get_clean();
if ( false === strpos( $one_session_report_html, '<span>読書開始</span><strong>1</strong>' ) || false === strpos( $one_session_report_html, '0.0%' ) ) { throw new Exception( 'Single-session report failed' ); }
$GLOBALS['wpdb']->report_sessions = 2;
$GLOBALS['wpdb']->report_drop = false;
ob_start(); ai_manga_viewer_render_analytics_report_page(); $no_drop_report_html = ob_get_clean();
if ( false === strpos( $no_drop_report_html, 'ページ間で人数の減少はありません' ) || false !== strpos( $no_drop_report_html, 'amv-drop-summary has-drop' ) ) { throw new Exception( 'No-drop report state failed' ); }
$GLOBALS['wpdb']->report_drop = true;
if ( preg_match( '/DELETE\s+FROM\s+wp_amv_/i', implode( "\n", $GLOBALS['wpdb']->queries ) ) ) { throw new Exception( 'Report changes deleted existing analytics data' ); }
unset( $_GET['amv_viewer'] );
$GLOBALS['wpdb']->report_fixture = false;

$event = array(
	'name' => 'page_reach', 'eventId' => 'event-abc', 'sessionId' => 'session-abc',
	'visitorId' => 'visitor-abc',
	'viewerKey' => 'viewer-abc', 'instanceKey' => 'instance-abc', 'pageKey' => 'page-abc',
	'pageIndex' => 1, 'pageNumber' => 2, 'pageCount' => 5, 'mode' => 'zoom', 'occurredAt' => 123456789,
);
$normalized = ai_manga_viewer_normalize_analytics_event( $event );
if ( ! $normalized ) { throw new Exception( 'Valid analytics event was rejected' ); }
$impression_event = array_merge( $event, array( 'name' => 'viewer_impression', 'eventId' => 'event-impression', 'sessionId' => '', 'mode' => 'standard', 'readingStarted' => false ) );
$normalized_impression = ai_manga_viewer_normalize_analytics_event( $impression_event );
if ( ! $normalized_impression || '' !== $normalized_impression['session_id'] || true !== ai_manga_viewer_store_analytics_event( $normalized_impression ) ) { throw new Exception( 'Viewer impression event failed' ); }
foreach ( array( array_merge( $impression_event, array( 'sessionId' => 'invented-session' ) ), array_merge( $impression_event, array( 'mode' => 'fullscreen' ) ), array_merge( $impression_event, array( 'readingStarted' => true ) ) ) as $invalid_impression ) {
	if ( null !== ai_manga_viewer_normalize_analytics_event( $invalid_impression ) ) { throw new Exception( 'Invalid Viewer impression event was accepted' ); }
}
if ( true !== ai_manga_viewer_store_analytics_event( $normalized ) ) { throw new Exception( 'First analytics event was not stored' ); }
if ( 'duplicate' !== ai_manga_viewer_store_analytics_event( $normalized ) ) { throw new Exception( 'Duplicate event id was not ignored' ); }
$vertical_event = array_merge( $event, array( 'eventId' => 'event-vertical', 'sessionId' => 'session-vertical', 'mode' => 'vertical' ) );
$normalized_vertical = ai_manga_viewer_normalize_analytics_event( $vertical_event );
if ( ! $normalized_vertical || 'vertical' !== $normalized_vertical['mode'] || true !== ai_manga_viewer_store_analytics_event( $normalized_vertical ) ) { throw new Exception( 'Vertical reading analytics mode failed' ); }
$active_event = $event;
$active_event['name'] = 'active_time'; $active_event['eventId'] = 'event-active'; $active_event['readingStarted'] = true; $active_event['activeSecondsDelta'] = 15;
$normalized_active = ai_manga_viewer_normalize_analytics_event( $active_event );
if ( ! $normalized_active || 15 !== $normalized_active['active_seconds_delta'] || true !== ai_manga_viewer_store_analytics_event( $normalized_active ) ) { throw new Exception( 'Valid active reading time was not accepted' ); }
$invalid_active = $active_event; $invalid_active['activeSecondsDelta'] = 16;
if ( null !== ai_manga_viewer_normalize_analytics_event( $invalid_active ) ) { throw new Exception( 'Oversized active reading delta was accepted' ); }
$invalid_active = $active_event; $invalid_active['readingStarted'] = false;
if ( null !== ai_manga_viewer_normalize_analytics_event( $invalid_active ) ) { throw new Exception( 'Active reading time without a reading session was accepted' ); }
$sql = implode( "\n", $GLOBALS['wpdb']->queries );
foreach ( array( 'START TRANSACTION', 'wp_amv_reader_events', 'active_seconds_delta', 'wp_amv_reader_sessions', 'used_fullscreen', 'active_seconds=LEAST(1800,active_seconds+VALUES(active_seconds))', 'wp_amv_page_reaches', 'COMMIT' ) as $expected ) {
	if ( false === strpos( $sql, $expected ) ) { throw new Exception( 'Persistence query missing: ' . $expected ); }
}
if ( false !== strpos( $sql, 'visitor-abc' ) || false === strpos( $sql, hash_hmac( 'sha256', 'visitor-abc', 'test-salt' ) ) ) { throw new Exception( 'Raw visitor id was stored instead of its HMAC' ); }

$library_event = array_merge( $event, array( 'viewerKey' => 'library-viewer-2440' ) );
$request = new AMV_Test_Request( 'https://example.test', $library_event );
$disabled = ai_manga_viewer_receive_analytics_event( $request );
if ( ! $disabled instanceof WP_Error || 'amv_analytics_disabled' !== $disabled->code || 503 !== $disabled->data['status'] ) { throw new Exception( 'Disabled analytics endpoint accepted an event' ); }
$GLOBALS['options']['ai_manga_viewer_analytics_enabled'] = '1';
$config = ai_manga_viewer_receive_analytics_config();
if ( ! $config instanceof WP_REST_Response || true !== ( $config->data['enabled'] ?? false ) ) { throw new Exception( 'Dynamic analytics config did not reflect the enabled option' ); }
$foreign = ai_manga_viewer_receive_analytics_event( new AMV_Test_Request( 'https://attacker.test', $library_event ) );
if ( ! $foreign instanceof WP_Error || 'amv_invalid_origin' !== $foreign->code ) { throw new Exception( 'Foreign origin was accepted' ); }
$direct_rejected = ai_manga_viewer_receive_analytics_event( new AMV_Test_Request( 'https://example.test', array_merge( $event, array( 'eventId' => 'direct-event', 'viewerKey' => 'viewer-abc' ) ) ) );
if ( ! $direct_rejected instanceof WP_Error || 'amv_viewer_not_registered' !== $direct_rejected->code || 403 !== $direct_rejected->data['status'] ) { throw new Exception( 'Direct Viewer analytics event was accepted' ); }
$accepted = ai_manga_viewer_receive_analytics_event( $request );
if ( ! $accepted instanceof WP_REST_Response || 200 !== $accepted->status || empty( $accepted->data['duplicate'] ) ) { throw new Exception( 'Valid same-origin duplicate response failed' ); }

$before_cleanup = count( $GLOBALS['wpdb']->queries );
ai_manga_viewer_cleanup_analytics_data();
$cleanup_sql = implode( "\n", array_slice( $GLOBALS['wpdb']->queries, $before_cleanup ) );
foreach ( array( 'DELETE FROM wp_amv_reader_events WHERE received_at <', 'DELETE FROM wp_amv_page_reaches WHERE first_reached_at <', 'DELETE FROM wp_amv_reader_sessions WHERE last_activity_at <' ) as $expected ) {
	if ( false === strpos( $cleanup_sql, $expected ) ) { throw new Exception( 'Retention cleanup query missing: ' . $expected ); }
}
$before_delete = count( $GLOBALS['wpdb']->queries );
ai_manga_viewer_delete_all_analytics_data();
$delete_sql = implode( "\n", array_slice( $GLOBALS['wpdb']->queries, $before_delete ) );
foreach ( array( 'DELETE FROM wp_amv_reader_events', 'DELETE FROM wp_amv_page_reaches', 'DELETE FROM wp_amv_reader_sessions' ) as $expected ) {
	if ( false === strpos( $delete_sql, $expected ) ) { throw new Exception( 'Manual deletion query missing: ' . $expected ); }
}
$GLOBALS['options']['ai_manga_viewer_analytics_delete_on_uninstall'] = '1';
ai_manga_viewer_uninstall_analytics();
$uninstall_sql = implode( "\n", $GLOBALS['wpdb']->queries );
if ( substr_count( $uninstall_sql, 'DROP TABLE IF EXISTS wp_amv_' ) !== 3 || count( $GLOBALS['deleted_options'] ?? array() ) !== 4 || ! in_array( 'ai_manga_viewer_analytics_daily_cleanup', $GLOBALS['cleared_hooks'] ?? array(), true ) ) { throw new Exception( 'Opt-in uninstall cleanup failed' ); }

if ( in_array( '--all-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $all_report_html . '</body></html>';
} elseif ( in_array( '--library-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $library_report_html . '</body></html>';
} elseif ( in_array( '--complete-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $complete_report_html . '</body></html>';
} elseif ( in_array( '--enabled-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $enabled_report_html . '</body></html>';
} elseif ( in_array( '--fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $report_html . '</body></html>';
} else {
	echo "PASS: analytics settings/report, retention, deletion, allowlist, active-time bounds, anonymous visitor HMAC, disabled default, same-origin guard, transactional storage and event-id deduplication\n";
}
