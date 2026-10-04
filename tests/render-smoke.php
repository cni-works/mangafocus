<?php
/** Isolated WordPress API doubles; this is not a WordPress integration test. */
define( 'ABSPATH', __DIR__ );
define( 'MINUTE_IN_SECONDS', 60 );
class WP_REST_Server { const CREATABLE = 'POST'; const READABLE = 'GET'; }
class WP_REST_Request { private $params; public function __construct( $params = array() ) { $this->params = $params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } }
class WP_Error { public $code; public $message; public $data; public function __construct( $code, $message, $data = array() ) { $this->code = $code; $this->message = $message; $this->data = $data; } }
error_reporting( E_ALL );
set_error_handler( function( $severity, $message, $file, $line ) {
	throw new ErrorException( $message, 0, $severity, $file, $line );
} );
function absint( $v ) { return abs( (int) $v ); }
function esc_url_raw( $v ) { return preg_match( '~^https?://~', $v ) ? $v : ''; }
function esc_url( $v ) { return esc_attr( esc_url_raw( $v ) ); }
function sanitize_key( $v ) { return preg_replace( '/[^a-z0-9_-]/', '', strtolower( $v ) ); }
function sanitize_html_class( $v ) { return preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $v ); }
function sanitize_text_field( $v ) { return strip_tags( $v ); }
function sanitize_textarea_field( $v ) { return trim( strip_tags( (string) $v ) ); }
function sanitize_hex_color( $v ) { return is_string( $v ) && preg_match( '/^#[0-9a-f]{6}$/i', $v ) ? strtolower( $v ) : null; }
function esc_attr( $v ) { return htmlspecialchars( (string) $v, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $v ) { return esc_attr( $v ); }
function esc_textarea( $v ) { return esc_attr( $v ); }
function __( $v, $domain = '' ) { return $v; }
function esc_attr__( $v, $domain ) { return esc_attr( $v ); }
function esc_html__( $v, $domain ) { return esc_html( $v ); }
function _n( $single, $plural, $number, $domain = '' ) { return 1 === (int) $number ? $single : $plural; }
function number_format_i18n( $v, $decimals = 0 ) { return number_format( $v, $decimals ); }
function wp_json_encode( $v ) { return json_encode( $v ); }
function wp_parse_url( $v ) { return parse_url( $v ); }
function wp_unique_id( $prefix ) { static $id = 0; return $prefix . ++$id; }
function wp_get_attachment_image( $id, $size, $icon, $attrs ) { return ''; }
function wp_get_attachment_image_url( $id, $size ) { return 'attachment' === get_post_type( $id ) ? 'https://example.test/media/' . absint( $id ) . '-' . $size . '.jpg' : false; }
function wp_get_attachment_metadata( $id ) { return 901 === (int) $id ? array( 'width' => 1200, 'height' => 600 ) : false; }
function get_post_thumbnail_id( $id ) { return absint( $GLOBALS['test_thumbnail'][ $id ] ?? 0 ); }
function get_the_post_thumbnail_url( $id, $size ) { $thumbnail_id = get_post_thumbnail_id( $id ); if ( $thumbnail_id ) return wp_get_attachment_image_url( $thumbnail_id, $size ); return 123 === $id ? 'https://example.test/cover.jpg' : false; }
function get_the_post_thumbnail( $id, $size, $attrs ) { $url = get_the_post_thumbnail_url( $id, $size ); return $url ? '<img class="amv-library-cover-image" src="' . esc_url( $url ) . '" alt="" />' : ''; }
function get_edit_post_link( $id, $context = 'display' ) { return 123 === $id ? 'https://example.test/wp-admin/post.php?post=123&action=edit' : ''; }
function wp_kses_post( $html ) { return $html; }
function get_block_wrapper_attributes( $attrs ) {
	$attrs['class'] = $GLOBALS['test_block_class'] . ' ' . $attrs['class'];
	return implode( ' ', array_map( function( $key ) use ( $attrs ) { return $key . '="' . esc_attr( $attrs[$key] ) . '"'; }, array_keys( $attrs ) ) );
}
function plugin_dir_path( $file ) { return dirname( $file ) . '/'; }
function plugin_dir_url( $file ) { return 'https://example.test/plugin/'; }
function home_url( $path = '' ) { return 'https://example.test' . $path; }
function admin_url( $path = '' ) { return 'https://example.test/wp-admin/' . ltrim( $path, '/' ); }
function add_query_arg( $args, $url ) { return $url . ( false === strpos( $url, '?' ) ? '?' : '&' ) . http_build_query( $args ); }
function rest_url( $path = '' ) { return 'https://example.test/wp-json/' . ltrim( $path, '/' ); }
function add_action( $hook, $fn, $priority = 10, $accepted_args = 1 ) { $GLOBALS['actions'][$hook][] = $fn; }
function add_filter( $hook, $fn, $priority = 10, $accepted_args = 1 ) { $GLOBALS['filters'][$hook][$priority][] = array( 'callback' => $fn, 'accepted_args' => $accepted_args ); return true; }
function remove_filter( $hook, $fn, $priority = 10 ) { if ( empty( $GLOBALS['filters'][$hook][$priority] ) ) return false; foreach ( $GLOBALS['filters'][$hook][$priority] as $index => $entry ) { if ( $entry['callback'] === $fn ) { unset( $GLOBALS['filters'][$hook][$priority][$index] ); return true; } } return false; }
function apply_filters( $hook, $value ) { $args = func_get_args(); array_shift( $args ); if ( empty( $GLOBALS['filters'][$hook] ) ) return $value; ksort( $GLOBALS['filters'][$hook] ); foreach ( $GLOBALS['filters'][$hook] as $entries ) foreach ( $entries as $entry ) { $call_args = array_slice( $args, 0, max( 1, (int) $entry['accepted_args'] ) ); $args[0] = call_user_func_array( $entry['callback'], $call_args ); } return $args[0]; }
function add_shortcode( $tag, $fn ) { $GLOBALS['shortcodes'][$tag] = $fn; }
function register_activation_hook( $file, $fn ) { $GLOBALS['activation_hook'] = $fn; }
function plugin_basename( $file ) { return 'mangafocus/' . basename( $file ); }
function load_plugin_textdomain( $domain, $deprecated = false, $path = false ) { $GLOBALS['loaded_textdomain'] = array( $domain, $path ); return true; }
function register_deactivation_hook( $file, $fn ) { $GLOBALS['deactivation_hook'] = $fn; }
function register_uninstall_hook( $file, $fn ) { $GLOBALS['uninstall_hook'] = $fn; }
function register_rest_route( $namespace, $route, $args ) { $GLOBALS['rest_routes'][ $namespace . $route ] = $args; }
function register_rest_field( $type, $name, $args ) { $GLOBALS['rest_fields'][ $type ][ $name ] = $args; }
function register_setting( $group, $name, $args ) { $GLOBALS['registered_settings'][ $name ] = compact( 'group', 'args' ); }
function add_submenu_page( $parent, $page_title, $menu_title, $capability, $slug, $callback ) { $GLOBALS['submenu_pages'][ $slug ] = compact( 'parent', 'capability', 'callback' ); }
function checked( $checked, $current = true, $display = true ) { $result = $checked == $current ? 'checked="checked"' : ''; if ( $display ) echo $result; return $result; }
function wp_nonce_field( $action ) { echo '<input type="hidden" name="_wpnonce" value="valid" />'; }
function check_admin_referer( $action ) { return true; }
function submit_button( $text, $type = 'primary', $name = 'submit', $wrap = true ) { echo '<button type="submit" name="' . esc_attr( $name ) . '">' . esc_html( $text ) . '</button>'; }
function wp_unslash( $value ) { return $value; }
function wp_die( $message ) { throw new RuntimeException( (string) $message ); }
function shortcode_atts( $pairs, $atts, $shortcode = '' ) { return array_merge( $pairs, array_intersect_key( (array) $atts, $pairs ) ); }
function wp_register_script( $handle, $url, $deps, $version, $footer = false ) { $GLOBALS['scripts'][$handle] = $deps; }
function wp_add_inline_script( $handle, $data, $position = 'after' ) { $GLOBALS['inline_scripts'][ $handle ] = compact( 'data', 'position' ); }
function wp_enqueue_script( $handle, $url = '', $deps = array(), $version = false, $footer = false ) { $GLOBALS['enqueued_scripts'][$handle] = compact( 'url', 'deps', 'version', 'footer' ); }
function wp_register_style( $handle, $url, $deps, $version ) {}
function wp_enqueue_style( $handle, $url = '', $deps = array(), $version = false ) { $GLOBALS['enqueued_styles'][$handle] = compact( 'url', 'deps', 'version' ); }
function wp_set_script_translations( $handle, $domain, $path = '' ) { $GLOBALS['script_translations'][ $handle ] = array( 'domain' => $domain, 'path' => $path ); }
function get_current_screen() { return $GLOBALS['test_screen'] ?? null; }
function register_block_type( $path, $settings ) {
	$metadata = json_decode( file_get_contents( $path . 'block.json' ), true );
	if ( ! in_array( $metadata['name'], array( 'ai-manga-viewer/viewer', 'ai-manga-viewer/library-viewer' ), true ) || ! is_callable( $settings['render_callback'] ) ) { throw new Exception( 'Registration failed' ); }
	$GLOBALS['registered_blocks'][ $metadata['name'] ] = $settings;
}
function register_post_type( $post_type, $args ) { $GLOBALS['post_types'][$post_type] = $args; }
function get_post( $post_id ) { return $GLOBALS['test_posts'][ $post_id ] ?? null; }
function get_post_status( $post ) { return is_object( $post ) ? $post->post_status : ( $GLOBALS['test_posts'][ $post ]->post_status ?? false ); }
function get_post_status_object( $status ) { return (object) array( 'label' => 'publish' === $status ? 'Published' : 'Draft' ); }
function get_post_field( $field, $post_id ) { return $GLOBALS['test_posts'][ $post_id ]->$field ?? ''; }
function get_post_type( $post_id ) { return $GLOBALS['test_posts'][ $post_id ]->post_type ?? ( 901 === (int) $post_id ? 'attachment' : false ); }
function get_the_title( $post_id ) { return $GLOBALS['test_posts'][ $post_id ]->post_title ?? ''; }
function get_option( $name, $default = false ) { if ( 'date_format' === $name ) return 'Y-m-d'; if ( 'time_format' === $name ) return 'H:i'; return $GLOBALS['test_options'][ $name ] ?? $default; }
function get_transient() { return false; }
function set_transient() { return true; }
function delete_transient() { return true; }
function get_the_ID() { return 456; }
function get_post_modified_time( $format, $gmt, $post_id, $translate ) { return 123 === $post_id ? '2026-09-27 18:30' : false; }
function current_user_can( $capability, $post_id = 0 ) { if ( 'manage_options' === $capability && array_key_exists( 'test_can_manage', $GLOBALS ) ) return ! empty( $GLOBALS['test_can_manage'] ); if ( 'publish_posts' === $capability && array_key_exists( 'test_can_publish', $GLOBALS ) ) return ! empty( $GLOBALS['test_can_publish'] ); return ! empty( $GLOBALS['test_can_edit'] ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function rest_ensure_response( $value ) { return $value; }
function serialize_block( $block ) { $GLOBALS['serialized_library_block'] = $block; $content = '<!-- wp:ai-manga-viewer/viewer ' . json_encode( $block['attrs'] ) . ' /-->'; $GLOBALS['test_parsed_blocks'][ $content ] = array( $block ); return $content; }
function wp_insert_post( $post, $wp_error = false ) { $id = 2444; $GLOBALS['test_posts'][ $id ] = (object) array_merge( array( 'ID' => $id ), $post ); return $id; }
function wp_update_post( $post, $wp_error = false ) { foreach ( $post as $key => $value ) if ( 'ID' !== $key ) $GLOBALS['test_posts'][ $post['ID'] ]->$key = $value; return $post['ID']; }
function wp_delete_post( $post_id, $force = false ) { unset( $GLOBALS['test_posts'][ $post_id ] ); return true; }
function update_post_meta( $post_id, $key, $value ) { $GLOBALS['test_meta'][ $post_id ][ $key ] = $value; return true; }
function get_post_meta( $post_id, $key, $single = false ) { return $GLOBALS['test_meta'][ $post_id ][ $key ] ?? ''; }
function set_post_thumbnail( $post_id, $attachment_id ) { $GLOBALS['test_thumbnail'][ $post_id ] = $attachment_id; return true; }
function delete_post_thumbnail( $post_id ) { unset( $GLOBALS['test_thumbnail'][ $post_id ] ); return true; }
function wp_attachment_is_image( $post_id ) { return 'attachment' === get_post_type( $post_id ); }
function wp_is_post_revision( $post_id ) { return false; }
function wp_is_post_autosave( $post_id ) { return false; }
function get_posts( $args = array() ) { return $GLOBALS['test_get_posts'] ?? array(); }
function parse_blocks( $content ) { return $GLOBALS['test_parsed_blocks'][ $content ] ?? array(); }
function render_block( $block ) { $GLOBALS['test_rendered_blocks'][] = $block; $previous_class = $GLOBALS['test_block_class']; $GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer'; $rendered = ai_manga_viewer_render_viewer( $block['attrs'] ?? array() ); $GLOBALS['test_block_class'] = $previous_class; return $rendered; }
require dirname( __DIR__ ) . '/mangafocus.php';
$with_pro_cta = in_array( '--pro-cta-fixture', $argv, true );
$with_pro_panel = true;
if ( $with_pro_cta ) {
	add_filter( 'ai_manga_viewer_has_feature', function( $available, $feature_id ) { return 'cta' === $feature_id ? true : $available; }, 30, 2 );
	add_filter( 'ai_manga_viewer_capability_map', function( $map ) { $map['cta']['runtime'] = true; $map['cta']['editor'] = true; return $map; }, 10 );
	require dirname( __DIR__, 2 ) . '/AI Manga Viewer Pro/includes/modules/cta/renderer.php';
}
foreach ( $GLOBALS['actions']['init'] as $callback ) { call_user_func( $callback ); }
foreach ( $GLOBALS['actions']['rest_api_init'] as $callback ) { call_user_func( $callback ); }
foreach ( $GLOBALS['actions']['admin_init'] as $callback ) { call_user_func( $callback ); }
foreach ( $GLOBALS['actions']['admin_menu'] as $callback ) { call_user_func( $callback ); }
if ( count( ai_manga_viewer_block_categories( ai_manga_viewer_block_categories( array() ) ) ) !== 1 ) { throw new Exception( 'Duplicate category' ); }
if ( ( $GLOBALS['shortcodes']['ai_manga_viewer'] ?? null ) !== 'ai_manga_viewer_library_shortcode' ) { throw new Exception( 'Library shortcode registration failed' ); }
if ( ! isset( $GLOBALS['registered_blocks']['ai-manga-viewer/viewer'], $GLOBALS['registered_blocks']['ai-manga-viewer/library-viewer'] ) ) { throw new Exception( 'Both viewer blocks must be registered' ); }
if ( ( $GLOBALS['activation_hook'] ?? null ) !== 'ai_manga_viewer_install_analytics_tables' || ( $GLOBALS['deactivation_hook'] ?? null ) !== 'ai_manga_viewer_deactivate_analytics' || ( $GLOBALS['uninstall_hook'] ?? null ) !== 'ai_manga_viewer_uninstall_analytics' || isset( $GLOBALS['rest_routes']['ai-manga-viewer/v1/events'], $GLOBALS['rest_routes']['ai-manga-viewer/v1/config'] ) || ! isset( $GLOBALS['rest_routes']['ai-manga-viewer/v1/library'], $GLOBALS['rest_fields']['amv_viewer']['amv_cover_url'] ) ) { throw new Exception( 'Core lifecycle, Pro route absence, Library route or cover REST field registration failed' ); }
$GLOBALS['test_can_edit'] = false;
if ( call_user_func( $GLOBALS['rest_routes']['ai-manga-viewer/v1/library']['permission_callback'] ) ) { throw new Exception( 'Library registration route allowed an unauthorized request' ); }
$GLOBALS['test_can_edit'] = true;
if ( ! call_user_func( $GLOBALS['rest_routes']['ai-manga-viewer/v1/library']['permission_callback'] ) ) { throw new Exception( 'Library registration route rejected an authorized editor' ); }
$library_route_args = $GLOBALS['rest_routes']['ai-manga-viewer/v1/library']['args'] ?? array();
if ( array( 'title', 'sourcePostId', 'sourceInstanceKey', 'existingViewerId', 'attributes' ) !== array_keys( $library_route_args ) || empty( $library_route_args['title']['required'] ) || empty( $library_route_args['attributes']['required'] ) ) { throw new Exception( 'Library registration REST argument schema is incomplete' ); }
foreach ( $library_route_args as $argument ) {
	if ( empty( $argument['type'] ) || ! is_callable( $argument['validate_callback'] ?? null ) || ! is_callable( $argument['sanitize_callback'] ?? null ) ) { throw new Exception( 'Library registration REST argument validation or sanitization is missing' ); }
}
if ( call_user_func( $library_route_args['title']['validate_callback'], '   ' ) || call_user_func( $library_route_args['sourcePostId']['validate_callback'], -1 ) || call_user_func( $library_route_args['sourcePostId']['validate_callback'], '1.5' ) || call_user_func( $library_route_args['attributes']['validate_callback'], 'invalid' ) ) { throw new Exception( 'Malformed Library registration REST arguments were accepted' ); }
if ( ! call_user_func( $library_route_args['title']['validate_callback'], '登録Manga' ) || ! call_user_func( $library_route_args['sourcePostId']['validate_callback'], 456 ) || ! call_user_func( $library_route_args['attributes']['validate_callback'], array( 'pages' => array() ) ) ) { throw new Exception( 'Valid Library registration REST arguments were rejected' ); }
if ( 'unsafe-title' !== call_user_func( $library_route_args['title']['sanitize_callback'], '<b>unsafe-title</b>' ) || 456 !== call_user_func( $library_route_args['sourcePostId']['sanitize_callback'], '456' ) || 'placement-one' !== call_user_func( $library_route_args['sourceInstanceKey']['sanitize_callback'], 'Placement-One!!' ) ) { throw new Exception( 'Library registration REST argument sanitization failed' ); }
$sanitized_route_attributes = call_user_func(
	$library_route_args['attributes']['sanitize_callback'],
	array(
		'pages' => array(
			array(
				'url' => 'https://example.test/page.jpg',
				'alt' => '<b>page</b>',
			),
		),
	)
);
if ( 'page' !== ( $sanitized_route_attributes['pages'][0]['alt'] ?? '' ) ) { throw new Exception( 'Library registration attributes were not sanitized by the REST argument schema' ); }
if ( 3 !== count( $GLOBALS['registered_settings'] ?? array() ) || 'manage_options' !== ( $GLOBALS['submenu_pages']['ai-manga-viewer-analytics']['capability'] ?? '' ) || isset( $GLOBALS['submenu_pages']['ai-manga-viewer-analytics-report'], $GLOBALS['submenu_pages']['ai-manga-viewer-consultation'] ) || 'edit.php?post_type=amv_viewer' !== ( $GLOBALS['submenu_pages']['ai-manga-viewer-analytics']['parent'] ?? '' ) || ( $GLOBALS['actions']['admin_post_ai_manga_viewer_delete_analytics'][0] ?? '' ) !== 'ai_manga_viewer_handle_delete_analytics' ) { throw new Exception( 'Core Analytics lifecycle settings boundary failed' ); }
$feature_bootstrap = 'window.aiMangaViewerFeatures={"panel_reader":true,"cta":' . ( $with_pro_cta ? 'true' : 'false' ) . ',"analytics":false,"ai_consultation":false,"manga_creation":false};';
$capability_bootstrap = 'window.aiMangaViewerCapabilities={"panel_reader":{"runtime":true,"editor":true},"cta":{"runtime":' . ( $with_pro_cta ? 'true' : 'false' ) . ',"editor":' . ( $with_pro_cta ? 'true' : 'false' ) . '},"analytics":{"collection":false,"report":false},"ai_consultation":{"admin":false},"manga_creation":{"admin":false}};';
$client_bootstrap = $feature_bootstrap . $capability_bootstrap;
if ( 'before' !== ( $GLOBALS['inline_scripts']['ai-manga-viewer-editor']['position'] ?? '' ) || $client_bootstrap !== ( $GLOBALS['inline_scripts']['ai-manga-viewer-editor']['data'] ?? '' ) || 'before' !== ( $GLOBALS['inline_scripts']['ai-manga-viewer-library-editor']['position'] ?? '' ) || $client_bootstrap !== ( $GLOBALS['inline_scripts']['ai-manga-viewer-library-editor']['data'] ?? '' ) ) { throw new Exception( 'Editor feature/capability configuration failed' ); }
if ( 'before' !== ( $GLOBALS['inline_scripts']['ai-manga-viewer-view']['position'] ?? '' ) || false === strpos( $GLOBALS['inline_scripts']['ai-manga-viewer-view']['data'] ?? '', $feature_bootstrap ) ) { throw new Exception( 'Frontend feature bootstrap failed' ); }
if ( isset( $GLOBALS['inline_scripts']['ai-manga-viewer-analytics-transport'] ) || in_array( 'ai-manga-viewer-analytics-transport', $GLOBALS['scripts']['ai-manga-viewer-view'] ?? array(), true ) ) { throw new Exception( 'Pro Analytics transport leaked into Core.' ); }
$cover_callback = $GLOBALS['rest_fields']['amv_viewer']['amv_cover_url']['get_callback'];
if ( 'https://example.test/cover.jpg' !== $cover_callback( array( 'id' => 123 ) ) || '' !== $cover_callback( array( 'id' => 0 ) ) ) { throw new Exception( 'Manga Library cover REST field failed' ); }
if ( in_array( 'wp-server-side-render', $GLOBALS['scripts']['ai-manga-viewer-library-editor'] ?? array(), true ) ) { throw new Exception( 'Registered Viewer editor must not load the full server-side preview dependency' ); }
if ( ! in_array( 'wp-data', $GLOBALS['scripts']['ai-manga-viewer-editor'] ?? array(), true ) || ! in_array( 'wp-api-fetch', $GLOBALS['scripts']['ai-manga-viewer-editor'] ?? array(), true ) || ! in_array( 'wp-hooks', $GLOBALS['scripts']['ai-manga-viewer-editor'] ?? array(), true ) || ! in_array( 'wp-data', $GLOBALS['scripts']['ai-manga-viewer-library-editor'] ?? array(), true ) || ! in_array( 'wp-i18n', $GLOBALS['scripts']['ai-manga-viewer-view'] ?? array(), true ) || 'mangafocus' !== ( $GLOBALS['script_translations']['ai-manga-viewer-view']['domain'] ?? '' ) || false === strpos( $GLOBALS['script_translations']['ai-manga-viewer-view']['path'] ?? '', 'languages' ) ) { throw new Exception( 'Editor migration, hook, instance-key or frontend i18n dependency is missing' ); }
if ( 1 !== AI_MANGA_VIEWER_EXTENSION_API_VERSION || 1 !== ai_manga_viewer_get_extension_api_version() ) { throw new Exception( 'Extension API version contract failed' ); }
if ( function_exists( 'ai_manga_viewer_normalize_analytics_event' ) || function_exists( 'ai_manga_viewer_register_analytics_routes' ) || function_exists( 'ai_manga_viewer_render_analytics_report_page' ) ) { throw new Exception( 'Pro Analytics implementation leaked into Core.' ); }
$library = $GLOBALS['post_types']['amv_viewer'] ?? null;
if ( ! is_array( $library ) || empty( $library['show_ui'] ) || empty( $library['show_in_rest'] ) || ! empty( $library['publicly_queryable'] ) ) { throw new Exception( 'Manga Library registration failed' ); }
if ( array( array( 'ai-manga-viewer/viewer' ) ) !== $library['template'] || 'all' !== $library['template_lock'] ) { throw new Exception( 'Manga Library editor template failed' ); }
if ( ! in_array( 'thumbnail', $library['supports'], true ) || false !== $library['rewrite'] || false !== $library['query_var'] ) { throw new Exception( 'Manga Library cover or public routing failed' ); }
$columns = ai_manga_viewer_library_columns( array( 'cb' => 'Select', 'title' => 'Title', 'date' => 'Date' ) );
if ( array( 'cb', 'amv_cover', 'title', 'amv_details', 'amv_modified' ) !== array_keys( $columns ) || 'Updated' !== $columns['amv_modified'] ) { throw new Exception( 'Manga Library columns failed' ); }
$sortable_columns = ai_manga_viewer_library_sortable_columns( array() );
if ( array( 'amv_details' => 'ID', 'amv_modified' => 'modified' ) !== $sortable_columns ) { throw new Exception( 'Manga Library sortable columns failed' ); }
$GLOBALS['test_screen'] = (object) array( 'id' => 'edit-post' );
ai_manga_viewer_library_admin_assets( 'edit.php' );
if ( ! empty( $GLOBALS['enqueued_scripts'] ) ) { throw new Exception( 'Library admin asset leaked to another list screen' ); }
$GLOBALS['test_screen'] = (object) array( 'id' => 'edit-amv_viewer' );
ai_manga_viewer_library_admin_assets( 'edit.php' );
if ( empty( $GLOBALS['enqueued_scripts']['ai-manga-viewer-library-admin'] ) || empty( $GLOBALS['enqueued_styles']['ai-manga-viewer-library-admin'] ) ) { throw new Exception( 'Library admin card assets were not enqueued' ); }
if ( isset( $GLOBALS['enqueued_scripts']['ai-manga-viewer-analytics-admin'], $GLOBALS['enqueued_styles']['ai-manga-viewer-analytics-admin'] ) ) { throw new Exception( 'Pro Analytics admin assets leaked into Core.' ); }
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
if ( '' !== ai_manga_viewer_render_viewer( array() ) ) { throw new Exception( 'Empty output' ); }
$area = array( 'id' => 'focus-existing', 'x' => 25, 'y' => 30, 'width' => 25, 'height' => 30, 'zoom' => 90, 'view' => 'focus' );
$attrs = array( 'focusReader' => true, 'mobileFocusReader' => true, 'enableAnimation' => false, 'pages' => array(
	array( 'id' => 0, 'url' => 'https://example.test/page1.svg', 'alt' => 'Page "1" <script>alert(1)</script>', 'focusAreas' => array( $area, array_merge( $area, array( 'x' => 75 ) ) ), 'mobileFocusAreas' => array( $area ) ),
	array( 'url' => 'https://example.test/page2.svg', 'alt' => 'Page 2', 'focusAreas' => array(), 'mobileFocusAreas' => array() ),
) );
$GLOBALS['test_can_edit'] = true;
$registration_pages = $attrs['pages'];
$registration_pages[0]['id'] = 901;
$registration_pages[0]['cta'] = array( 'enabled' => true, 'label' => 'Contact <b>now</b>', 'url' => 'https://example.test/contact', 'backgroundColor' => '#123456' );
$registration = ai_manga_viewer_register_direct_viewer( new WP_REST_Request( array( 'title' => '登録テスト<script>', 'sourcePostId' => 456, 'sourceInstanceKey' => 'instance-source', 'attributes' => array_merge( $attrs, array( 'pages' => $registration_pages, 'binding' => 'ltr', 'pageLayout' => 'spread', 'singleFirstPage' => false, 'spreadReadingMode' => 'pageFocus', 'maxWidth' => 900, 'enableFullscreen' => true, 'fullscreenStartAtCurrent' => true, 'inlineDisplayMode' => 'coverLauncher', 'fullscreenReadingMode' => 'vertical', 'enableZoom' => true, 'zoomControlsPosition' => 'right', 'libraryViewerId' => 999 ) ) ) ) );
$registered_attrs = $GLOBALS['serialized_library_block']['attrs'] ?? array();
if ( 2444 !== ( $registration['id'] ?? 0 ) || empty( $registration['canSwitch'] ) || 'publish' !== ( $registration['status'] ?? '' ) || 'library-viewer-2444' !== ( $registered_attrs['viewerKey'] ?? '' ) || 'library-source-2444' !== ( $registered_attrs['instanceKey'] ?? '' ) || 0 !== ( $registered_attrs['libraryViewerId'] ?? -1 ) || 'spread' !== ( $registered_attrs['pageLayout'] ?? '' ) || false !== ( $registered_attrs['singleFirstPage'] ?? null ) || 'pageFocus' !== ( $registered_attrs['spreadReadingMode'] ?? '' ) || empty( $registered_attrs['fullscreenStartAtCurrent'] ) || 'coverLauncher' !== ( $registered_attrs['inlineDisplayMode'] ?? '' ) || 'vertical' !== ( $registered_attrs['fullscreenReadingMode'] ?? '' ) || 2 !== count( $registered_attrs['pages'] ?? array() ) || 2 !== count( $registered_attrs['pages'][0]['focusAreas'] ?? array() ) || 1 !== count( $registered_attrs['pages'][0]['mobileFocusAreas'] ?? array() ) || 'Contact now' !== ( $registered_attrs['pages'][0]['cta']['label'] ?? '' ) || 901 !== ( $GLOBALS['test_thumbnail'][2444] ?? 0 ) || 'auto:901' !== ( $GLOBALS['test_meta'][2444]['_amv_auto_featured_image'] ?? '' ) || '456:instance-source' !== ( $GLOBALS['test_meta'][2444]['_amv_source_reference'] ?? '' ) ) { throw new Exception( 'Direct Viewer Library registration did not preserve and sanitize the Viewer configuration' ); }
$duplicate = ai_manga_viewer_register_direct_viewer( new WP_REST_Request( array( 'title' => '再登録', 'sourcePostId' => 456, 'sourceInstanceKey' => 'instance-source', 'existingViewerId' => 2444, 'attributes' => $attrs ) ) );
if ( 2444 !== ( $duplicate['id'] ?? 0 ) || empty( $duplicate['duplicate'] ) ) { throw new Exception( 'Direct Viewer duplicate registration prevention failed' ); }
$GLOBALS['test_can_publish'] = false;
$draft_registration = ai_manga_viewer_register_direct_viewer( new WP_REST_Request( array( 'title' => 'Draft登録', 'sourcePostId' => 456, 'sourceInstanceKey' => 'instance-draft', 'attributes' => $attrs ) ) );
if ( 'draft' !== ( $draft_registration['status'] ?? '' ) || ! empty( $draft_registration['canSwitch'] ) ) { throw new Exception( 'Library registration must not offer a public block switch for a draft Viewer' ); }
unset( $GLOBALS['test_can_publish'] );
$invalid_registration = ai_manga_viewer_register_direct_viewer( new WP_REST_Request( array( 'title' => '', 'attributes' => $attrs ) ) );
if ( ! is_wp_error( $invalid_registration ) || 'amv_title_required' !== $invalid_registration->code ) { throw new Exception( 'Direct Viewer registration validation failed' ); }
$new = ai_manga_viewer_render_viewer( $attrs );
if ( false !== strpos( $new, '<script>' ) || false !== strpos( $new, 'cni-' ) ) { throw new Exception( 'Escaping or namespace failure' ); }
if ( false === strpos( $new, 'data-page-layout="single"' ) || false === strpos( $new, 'data-inline-display-mode="reader"' ) || false !== strpos( $new, 'amv-reader__cover-launcher-button' ) || false === strpos( $new, 'data-single-first-page="on"' ) || false === strpos( $new, 'data-spread-reading-mode="overview"' ) || false === strpos( $new, 'data-fullscreen-start="first"' ) || false === strpos( $new, 'class="amv-reader__focus-layer"' ) || false === strpos( $new, 'class="amv-reader__surface"' ) || false === strpos( $new, '--amv-reader-spread-max-width:1312px' ) ) { throw new Exception( 'Default single-page compatibility or spread surface output failed' ); }
$fullscreen_current_output = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'fullscreenStartAtCurrent' => true ) ) );
if ( false === strpos( $fullscreen_current_output, 'data-fullscreen-start="current"' ) ) { throw new Exception( 'Current-page fullscreen start setting was not rendered' ); }
$spread_output = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pageLayout' => 'spread', 'singleFirstPage' => false ) ) );
if ( false === strpos( $spread_output, 'data-page-layout="spread"' ) || false === strpos( $spread_output, 'data-single-first-page="off"' ) ) { throw new Exception( 'Spread layout attributes were not rendered' ); }
$page_focus_output = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pageLayout' => 'spread', 'spreadReadingMode' => 'pageFocus', 'enableFullscreen' => true ) ) );
if ( false === strpos( $page_focus_output, 'data-spread-reading-mode="pageFocus"' ) || false === strpos( $page_focus_output, 'class="amv-reader__spread-overview"' ) || false === strpos( $page_focus_output, '>View entire spread</button>' ) ) { throw new Exception( 'Saved pageFocus must render as a fullscreen-only reading mode' ); }
$invalid_reading_mode = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pageLayout' => 'spread', 'spreadReadingMode' => 'unknown' ) ) );
if ( false === strpos( $invalid_reading_mode, 'data-spread-reading-mode="overview"' ) || false !== strpos( $invalid_reading_mode, 'amv-reader__spread-overview' ) ) { throw new Exception( 'Invalid spread reading mode was not normalized' ); }
$attachment_dimension_pages = $attrs['pages'];
$attachment_dimension_pages[0]['id'] = 901;
$attachment_dimensions = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pages' => $attachment_dimension_pages, 'pageLayout' => 'spread' ) ) );
if ( false === strpos( $attachment_dimensions, 'data-image-width="1200" data-image-height="600"' ) ) { throw new Exception( 'Attachment dimensions were not exposed for landscape grouping' ); }
$invalid_layout = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pageLayout' => 'invalid' ) ) );
if ( false === strpos( $invalid_layout, 'data-page-layout="single"' ) ) { throw new Exception( 'Invalid page layout was not normalized' ); }
$viewer_block = array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => $attrs, 'innerBlocks' => array(), 'innerHTML' => '', 'innerContent' => array() );
$GLOBALS['test_posts'][123] = (object) array( 'post_type' => 'amv_viewer', 'post_status' => 'publish', 'post_title' => 'MangaTitle', 'post_content' => 'viewer-123' );
$column_buffer_level = ob_get_level(); ob_start(); ai_manga_viewer_library_column( 'amv_modified', 123 ); $modified_column = ob_get_clean();
if ( ob_get_level() !== $column_buffer_level || false === strpos( $modified_column, 'screen-reader-text' ) || false === strpos( $modified_column, '2026-09-27 18:30' ) ) { throw new Exception( 'Manga Library modified column failed' ); }
$column_buffer_level = ob_get_level(); ob_start(); ai_manga_viewer_library_column( 'amv_cover', 123 ); $cover_column = ob_get_clean();
if ( ob_get_level() !== $column_buffer_level || false === strpos( $cover_column, 'class="amv-library-cover-link"' ) || false === strpos( $cover_column, 'href="https://example.test/wp-admin/post.php?post=123&amp;action=edit"' ) || false === strpos( $cover_column, 'amv-library-cover-image' ) ) { throw new Exception( 'Manga Library cover edit link failed' ); }
$GLOBALS['test_parsed_blocks']['viewer-123'] = array( array( 'blockName' => 'core/group', 'attrs' => array(), 'innerBlocks' => array( $viewer_block ) ) );
$GLOBALS['test_posts'][901] = (object) array( 'post_type' => 'attachment' );
$GLOBALS['test_posts'][902] = (object) array( 'post_type' => 'attachment' );
$GLOBALS['test_posts'][903] = (object) array( 'post_type' => 'attachment' );
$GLOBALS['test_posts'][130] = (object) array( 'post_type' => 'amv_viewer', 'post_content' => 'cover-auto-1' );
$GLOBALS['test_parsed_blocks']['cover-auto-1'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'pages' => array( array( 'id' => 901, 'url' => 'https://example.test/page-one.jpg' ) ) ), 'innerBlocks' => array() ) );
ai_manga_viewer_sync_library_featured_image( 130 );
if ( 901 !== ( $GLOBALS['test_thumbnail'][130] ?? 0 ) || 'auto:901' !== ( $GLOBALS['test_meta'][130]['_amv_auto_featured_image'] ?? '' ) ) { throw new Exception( 'First Library page was not installed as an automatic featured image' ); }
$GLOBALS['test_posts'][130]->post_content = 'cover-auto-2';
$GLOBALS['test_parsed_blocks']['cover-auto-2'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'pages' => array( array( 'id' => 902, 'url' => 'https://example.test/page-two.jpg' ) ) ), 'innerBlocks' => array() ) );
ai_manga_viewer_sync_library_featured_image( 130 );
if ( 902 !== ( $GLOBALS['test_thumbnail'][130] ?? 0 ) || 'auto:902' !== ( $GLOBALS['test_meta'][130]['_amv_auto_featured_image'] ?? '' ) ) { throw new Exception( 'Automatic Library featured image did not follow a changed first page' ); }
$GLOBALS['test_thumbnail'][130] = 903;
ai_manga_viewer_sync_library_featured_image( 130 );
if ( 903 !== ( $GLOBALS['test_thumbnail'][130] ?? 0 ) || 'manual' !== ( $GLOBALS['test_meta'][130]['_amv_auto_featured_image'] ?? '' ) ) { throw new Exception( 'Manual Library featured image was overwritten' ); }
unset( $GLOBALS['test_thumbnail'][130] );
ai_manga_viewer_sync_library_featured_image( 130 );
if ( isset( $GLOBALS['test_thumbnail'][130] ) || 'manual' !== ( $GLOBALS['test_meta'][130]['_amv_auto_featured_image'] ?? '' ) ) { throw new Exception( 'A manually removed Library featured image was recreated' ); }
$GLOBALS['test_posts'][131] = (object) array( 'post_type' => 'amv_viewer', 'post_content' => 'cover-external' );
$GLOBALS['test_parsed_blocks']['cover-external'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'pages' => array( array( 'id' => 0, 'url' => 'https://cdn.example.test/external-cover.jpg', 'thumbnailUrl' => '' ) ) ), 'innerBlocks' => array() ) );
ai_manga_viewer_sync_library_featured_image( 131 );
if ( isset( $GLOBALS['test_thumbnail'][131] ) || 'auto:0' !== ( $GLOBALS['test_meta'][131]['_amv_auto_featured_image'] ?? '' ) || 'https://cdn.example.test/external-cover.jpg' !== ai_manga_viewer_library_cover_url( 131 ) ) { throw new Exception( 'External first page cover fallback or no-sideload policy failed' ); }
$GLOBALS['test_posts'][132] = (object) array( 'post_type' => 'amv_viewer', 'post_content' => 'cover-empty' );
$GLOBALS['test_parsed_blocks']['cover-empty'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'pages' => array() ), 'innerBlocks' => array() ) );
ai_manga_viewer_sync_library_featured_image( 132 );
if ( '' !== ai_manga_viewer_library_cover_url( 132 ) || 'auto:0' !== ( $GLOBALS['test_meta'][132]['_amv_auto_featured_image'] ?? '' ) ) { throw new Exception( 'Empty Library Viewer must keep the cover placeholder' ); }
$GLOBALS['test_posts'][133] = (object) array( 'post_type' => 'amv_viewer', 'post_content' => 'cover-existing-manual' );
$GLOBALS['test_parsed_blocks']['cover-existing-manual'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => array( 'pages' => array( array( 'id' => 901, 'url' => 'https://example.test/page-one.jpg' ) ) ), 'innerBlocks' => array() ) );
$GLOBALS['test_thumbnail'][133] = 903;
ai_manga_viewer_sync_library_featured_image( 133 );
if ( 903 !== ( $GLOBALS['test_thumbnail'][133] ?? 0 ) || 'manual' !== ( $GLOBALS['test_meta'][133]['_amv_auto_featured_image'] ?? '' ) ) { throw new Exception( 'Pre-existing manual Library featured image was overwritten' ); }
$GLOBALS['test_options']['ai_manga_viewer_analytics_enabled'] = '1';
$GLOBALS['test_can_manage'] = true;
$column_buffer_level = ob_get_level(); ob_start(); ai_manga_viewer_library_column( 'amv_details', 123 ); $details_column = ob_get_clean();
if ( ob_get_level() !== $column_buffer_level || false === strpos( $details_column, 'amv-library-meta' ) || false === strpos( $details_column, 'is-publish' ) || false === strpos( $details_column, '2 pages' ) || false === strpos( $details_column, 'Viewer ID:' ) || false === strpos( $details_column, '2026-09-27 18:30' ) || false === strpos( $details_column, '>Edit<' ) || false === strpos( $details_column, 'Manga Analytics is currently unavailable' ) || false !== strpos( $details_column, '>View analytics<' ) || false !== strpos( $details_column, 'Create AI consultation material' ) || false === strpos( $details_column, 'data-shortcode="[ai_manga_viewer id=&quot;123&quot;]"' ) || false === strpos( $details_column, '<code class="amv-library-shortcode__code">[ai_manga_viewer id=&quot;123&quot;]</code>' ) || false === strpos( $details_column, 'amv-library-shortcode__feedback' ) ) { throw new Exception( 'Compact Core-only Manga Library metadata or actions failed' ); }
$GLOBALS['test_options']['ai_manga_viewer_analytics_enabled'] = '0';
ob_start(); ai_manga_viewer_library_column( 'amv_details', 123 ); $disabled_details = ob_get_clean();
if ( false === strpos( $disabled_details, 'Manga Analytics is currently unavailable' ) || false !== strpos( $disabled_details, 'Enable analytics' ) || false !== strpos( $disabled_details, 'ai-manga-viewer-analytics-report' ) || false !== strpos( $disabled_details, 'Create AI consultation material' ) ) { throw new Exception( 'Core-only Analytics Library action failed' ); }
$GLOBALS['test_can_manage'] = false;
ob_start(); ai_manga_viewer_library_column( 'amv_details', 123 ); $unauthorized_details = ob_get_clean();
if ( false === strpos( $unauthorized_details, 'Manga Analytics is currently unavailable' ) || false !== strpos( $unauthorized_details, 'Enable analytics' ) ) { throw new Exception( 'Analytics settings action leaked to an unauthorized editor' ); }
$GLOBALS['test_can_manage'] = true;
$shortcode_output = ai_manga_viewer_library_shortcode( array( 'id' => '123', 'ignored' => 'value' ) );
$shortcode_block = end( $GLOBALS['test_rendered_blocks'] );
if ( false === strpos( $shortcode_output, 'class="amv-library-embed" data-viewer-id="123" data-instance-key="shortcode-456-123"' ) || false === strpos( $shortcode_output, 'data-analytics-source="library"' ) || 'library-viewer-123' !== ( $shortcode_block['attrs']['viewerKey'] ?? '' ) || 'shortcode-456-123' !== ( $shortcode_block['attrs']['instanceKey'] ?? '' ) || 'https://example.test/cover.jpg' !== ( $shortcode_block['attrs']['_libraryCoverUrl'] ?? '' ) || 2 !== substr_count( $shortcode_output, 'data-instance-key="shortcode-456-123"' ) ) { throw new Exception( 'Published Library shortcode render, cover resolution or analytics key override failed' ); }
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-library-viewer';
$library_block_output = ai_manga_viewer_render_library_block( array( 'viewerId' => 123, 'instanceKey' => 'Placement-One!!' ) );
$library_rendered_block = end( $GLOBALS['test_rendered_blocks'] );
if ( false === strpos( $library_block_output, 'wp-block-ai-manga-viewer-library-viewer amv-library-embed' ) || false === strpos( $library_block_output, 'data-viewer-id="123"' ) || false === strpos( $library_block_output, 'data-analytics-source="library"' ) || 1 !== substr_count( $library_block_output, 'data-viewer-id="123"' ) || 2 !== substr_count( $library_block_output, 'data-instance-key="placement-one"' ) || 'library-viewer-123' !== ( $library_rendered_block['attrs']['viewerKey'] ?? '' ) || ( $shortcode_block['attrs']['viewerKey'] ?? '' ) !== ( $library_rendered_block['attrs']['viewerKey'] ?? '' ) || ( $shortcode_block['attrs']['instanceKey'] ?? '' ) === ( $library_rendered_block['attrs']['instanceKey'] ?? '' ) || 'placement-one' !== ( $library_rendered_block['attrs']['instanceKey'] ?? '' ) ) { throw new Exception( 'Registered Viewer block render or instance override failed' ); }
if ( '' !== ai_manga_viewer_render_library_block( array( 'viewerId' => 0 ) ) ) { throw new Exception( 'Empty Registered Viewer block must not render' ); }
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
foreach ( array( array(), array( 'id' => '0' ), array( 'id' => '123invalid' ), array( 'id' => '999' ) ) as $invalid_shortcode_attributes ) {
	if ( '' !== ai_manga_viewer_library_shortcode( $invalid_shortcode_attributes ) ) { throw new Exception( 'Invalid Library shortcode ID was rendered' ); }
}
$GLOBALS['test_posts'][124] = (object) array( 'post_type' => 'amv_viewer', 'post_status' => 'draft', 'post_content' => 'viewer-123' );
$GLOBALS['test_can_edit'] = false;
if ( '' !== ai_manga_viewer_library_shortcode( array( 'id' => '124' ) ) ) { throw new Exception( 'Draft Library item leaked to an anonymous visitor' ); }
$GLOBALS['test_can_edit'] = true;
if ( '' === ai_manga_viewer_library_shortcode( array( 'id' => '124' ) ) ) { throw new Exception( 'Draft Library item was hidden from its editor' ); }
$GLOBALS['test_posts'][125] = (object) array( 'post_type' => 'post', 'post_status' => 'publish', 'post_content' => 'viewer-123' );
$GLOBALS['test_posts'][126] = (object) array( 'post_type' => 'amv_viewer', 'post_status' => 'trash', 'post_content' => 'viewer-123' );
$GLOBALS['test_posts'][127] = (object) array( 'post_type' => 'amv_viewer', 'post_status' => 'publish', 'post_content' => 'viewer-empty' );
$GLOBALS['test_parsed_blocks']['viewer-empty'] = array( array( 'blockName' => 'core/paragraph', 'attrs' => array(), 'innerBlocks' => array() ) );
foreach ( array( 125, 126, 127 ) as $invalid_viewer_id ) {
	if ( '' !== ai_manga_viewer_library_shortcode( array( 'id' => (string) $invalid_viewer_id ) ) ) { throw new Exception( 'Invalid Library content was rendered' ); }
}
$GLOBALS['test_can_edit'] = false;
if ( $with_pro_panel && false === strpos( $new, 'data-amv-panel-start="first"' ) ) { throw new Exception( 'Pro default panel start is not first' ); }
if ( ! $with_pro_panel && ( false !== strpos( $new, 'data-amv-panel-reader=' ) || false !== strpos( $new, 'amv-modal' ) || false !== strpos( $new, 'amv-reader__focus-open' ) ) ) { throw new Exception( 'Core-only Renderer exposed Pro panel reader markup' ); }
if ( false === strpos( $new, 'data-zoom="off"' ) || false === strpos( $new, 'data-zoom-position="bottom"' ) || false !== strpos( $new, 'amv-reader__zoom-controls' ) ) { throw new Exception( 'Zoom must be disabled by default' ); }
$current_start = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'focusReaderStartAtCurrent' => true ) ) );
if ( $with_pro_panel && false === strpos( $current_start, 'data-amv-panel-start="current"' ) ) { throw new Exception( 'Current-page panel start is not rendered' ); }
$cta_pages = $attrs['pages'];
$cta_pages[0]['pageKey'] = 'page-one';
$cta_pages[1]['pageKey'] = 'page-two';
$cta_pages[0]['cta'] = array( 'enabled' => true, 'ctaKey' => 'cta-main', 'type' => 'text', 'label' => '詳しく "見る" &', 'url' => 'https://example.test/contact?from=manga', 'position' => 'center', 'newTab' => true );
$fullscreen_new = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'viewerKey' => 'viewer-main', 'instanceKey' => 'instance-main', 'pages' => $cta_pages, 'enableFullscreen' => true, 'enableZoom' => true ) ) );
$extension_root = function( $attributes, $context ) { $GLOBALS['extension_context'] = $context; $attributes['data-amv-test'] = $context['instance_key'] . ' "escaped"'; $attributes['class'] = 'must-not-render'; return $attributes; };
$extension_overlay = function( $markup, $page, $page_index, $context ) { return '<span class="extension-overlay" data-index="' . esc_attr( $page_index ) . '"></span>'; };
$extension_after = function( $markup, $context ) { return '<aside class="extension-after"></aside>'; };
add_filter( 'ai_manga_viewer_renderer_root_attributes', $extension_root, 10, 2 );
add_filter( 'ai_manga_viewer_renderer_page_overlay', $extension_overlay, 10, 4 );
add_filter( 'ai_manga_viewer_renderer_after_content', $extension_after, 10, 2 );
$extension_output = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'viewerKey' => 'extension-viewer', 'instanceKey' => 'extension-instance', 'pages' => $cta_pages ) ) );
if ( false === strpos( $extension_output, 'data-amv-test="extension-instance &quot;escaped&quot;"' ) || false !== strpos( $extension_output, 'must-not-render' ) || 2 !== substr_count( $extension_output, 'class="extension-overlay"' ) || false === strpos( $extension_output, 'data-index="0"' ) || false === strpos( $extension_output, 'data-index="1"' ) || false === strpos( $extension_output, 'class="extension-after"' ) || 'extension-instance' !== ( $GLOBALS['extension_context']['instance_key'] ?? '' ) || 1 !== ( $GLOBALS['extension_context']['api_version'] ?? 0 ) ) { throw new Exception( 'Renderer extension contract failed' ); }
$extension_output_two = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'viewerKey' => 'extension-viewer', 'instanceKey' => 'extension-instance-two', 'pages' => $cta_pages ) ) );
if ( false === strpos( $extension_output_two, 'data-amv-test="extension-instance-two &quot;escaped&quot;"' ) ) { throw new Exception( 'Renderer extension did not keep multiple instances distinct' ); }
remove_filter( 'ai_manga_viewer_renderer_root_attributes', $extension_root, 10 );
remove_filter( 'ai_manga_viewer_renderer_page_overlay', $extension_overlay, 10 );
remove_filter( 'ai_manga_viewer_renderer_after_content', $extension_after, 10 );
$extension_removed = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'viewerKey' => 'extension-viewer', 'instanceKey' => 'extension-instance', 'pages' => $cta_pages ) ) );
if ( false !== strpos( $extension_removed, 'data-amv-test' ) || false !== strpos( $extension_removed, 'extension-overlay' ) || false !== strpos( $extension_removed, 'extension-after' ) ) { throw new Exception( 'Renderer extensions were not removable' ); }
$invalid_extension = function() { return new stdClass(); };
add_filter( 'ai_manga_viewer_renderer_root_attributes', $invalid_extension, 10, 2 );
add_filter( 'ai_manga_viewer_renderer_page_overlay', $invalid_extension, 10, 4 );
add_filter( 'ai_manga_viewer_renderer_after_content', $invalid_extension, 10, 2 );
$invalid_extension_output = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'viewerKey' => 'invalid-extension', 'instanceKey' => 'invalid-extension-instance', 'pages' => $cta_pages ) ) );
if ( false !== strpos( $invalid_extension_output, 'stdClass' ) ) { throw new Exception( 'Invalid extension return value leaked into Renderer output' ); }
remove_filter( 'ai_manga_viewer_renderer_root_attributes', $invalid_extension, 10 );
remove_filter( 'ai_manga_viewer_renderer_page_overlay', $invalid_extension, 10 );
remove_filter( 'ai_manga_viewer_renderer_after_content', $invalid_extension, 10 );
if ( false !== strpos( $fullscreen_new, 'data-analytics-source=' ) ) { throw new Exception( 'Direct Viewer was marked for analytics' ); }
$library_analytics_block = $viewer_block;
$library_analytics_block['attrs'] = array_merge( $attrs, array( 'viewerKey' => 'viewer-main', 'instanceKey' => 'library-source', 'pages' => $cta_pages, 'enableFullscreen' => true, 'enableZoom' => true ) );
$GLOBALS['test_parsed_blocks']['viewer-123'] = array( array( 'blockName' => 'core/group', 'attrs' => array(), 'innerBlocks' => array( $library_analytics_block ) ) );
$library_fullscreen = ai_manga_viewer_render_library_viewer( 123, 'instance-main' );
if ( false === strpos( $library_fullscreen, 'data-analytics-source="library"' ) || false === strpos( $library_fullscreen, 'data-viewer-key="viewer-main"' ) || false === strpos( $library_fullscreen, 'data-instance-key="instance-main"' ) ) { throw new Exception( 'Library Viewer analytics marker or identity failed' ); }
$library_shortcode_cta = ai_manga_viewer_library_shortcode( array( 'id' => '123' ) );
if ( $with_pro_cta && ( false === strpos( $library_fullscreen, 'amv-reader__cta' ) || false === strpos( $library_shortcode_cta, 'amv-reader__cta' ) ) ) { throw new Exception( 'Pro CTA did not render through Registered Viewer and shortcode paths' ); }
if ( ! $with_pro_cta && ( false !== strpos( $library_fullscreen, 'amv-reader__cta' ) || false !== strpos( $library_shortcode_cta, 'amv-reader__cta' ) ) ) { throw new Exception( 'Core-only Registered Viewer or shortcode exposed CTA markup' ); }
if ( $with_pro_panel && ( false === strpos( $library_fullscreen, 'data-amv-panel-reader="on"' ) || false === strpos( $library_shortcode_cta, 'data-amv-panel-reader="on"' ) ) ) { throw new Exception( 'Pro panel reader did not render through Registered Viewer and shortcode paths' ); }
if ( ! $with_pro_panel && ( false !== strpos( $library_fullscreen, 'data-amv-panel-reader=' ) || false !== strpos( $library_shortcode_cta, 'data-amv-panel-reader=' ) ) ) { throw new Exception( 'Core-only Registered Viewer or shortcode exposed panel reader markup' ); }
$library_cover_block = $library_analytics_block;
$library_cover_block['attrs']['inlineDisplayMode'] = 'coverLauncher';
$GLOBALS['test_parsed_blocks']['viewer-123'] = array( $library_cover_block );
$library_cover_output = ai_manga_viewer_render_library_viewer( 123, 'library-cover-instance' );
if ( false === strpos( $library_cover_output, 'amv-reader--cover-launcher' ) || false === strpos( $library_cover_output, 'src="https://example.test/cover.jpg"' ) || false === strpos( $library_cover_output, 'aria-label="Read MangaTitle in fullscreen"' ) ) { throw new Exception( 'Manga Library cover launcher did not use its featured image or title' ); }
if ( false === strpos( $fullscreen_new, 'class="amv-reader__fullscreen"' ) || false === strpos( $fullscreen_new, 'aria-pressed="false"' ) ) { throw new Exception( 'Fullscreen control is not rendered' ); }
if ( false === strpos( $fullscreen_new, 'data-zoom="on"' ) || false === strpos( $fullscreen_new, 'amv-reader__zoom-controls--bottom' ) || false === strpos( $fullscreen_new, 'class="amv-reader__zoom-level"' ) || false === strpos( $fullscreen_new, 'amv-reader__zoom-page--previous' ) || false === strpos( $fullscreen_new, 'amv-reader__zoom-page--next' ) ) { throw new Exception( 'Zoom controls are not rendered' ); }
if ( $with_pro_panel && false === strpos( $fullscreen_new, '<div class="amv-modal__extension-layer" hidden></div>' ) ) { throw new Exception( 'Pro panel modal extension layer is missing' ); }
if ( ! $with_pro_panel && ( false !== strpos( $fullscreen_new, 'data-amv-panel-page=' ) || false !== strpos( $fullscreen_new, 'amv-modal__extension-layer' ) ) ) { throw new Exception( 'Core-only output contains panel runtime data' ); }
if ( false === strpos( $fullscreen_new, 'data-viewer-key="viewer-main"' ) || false === strpos( $fullscreen_new, 'data-instance-key="instance-main"' ) || false === strpos( $fullscreen_new, 'data-page-key="page-one"' ) || false === strpos( $fullscreen_new, 'data-page-key="page-two"' ) ) { throw new Exception( 'Persistent Viewer keys are missing' ); }
$normalized_cta = ai_manga_viewer_pages( $cta_pages );
if ( 'cta-main' !== ( $normalized_cta[0]['cta']['ctaKey'] ?? '' ) || '詳しく "見る" &' !== ( $normalized_cta[0]['cta']['label'] ?? '' ) ) { throw new Exception( 'Core CTA compatibility normalization lost saved data' ); }
if ( ! $with_pro_cta && ( false !== strpos( $fullscreen_new, 'amv-reader__cta' ) || false !== strpos( $fullscreen_new, 'data-cta-key=' ) ) ) { throw new Exception( 'Core-only Renderer exposed Pro CTA markup' ); }
if ( $with_pro_cta && ( false === strpos( $fullscreen_new, 'amv-reader__cta--text amv-reader__cta--center' ) || false === strpos( $fullscreen_new, 'href="https://example.test/contact?from=manga"' ) || false === strpos( $fullscreen_new, 'target="_blank" rel="noopener noreferrer"' ) || false === strpos( $fullscreen_new, '詳しく &quot;見る&quot; &amp;' ) || false === strpos( $fullscreen_new, 'data-cta-key="cta-main"' ) || false === strpos( $fullscreen_new, 'data-amv-modal-overlay="true"' ) ) ) { throw new Exception( 'Pro text CTA sanitizing or output failed' ); }
$free_cta_pages = $attrs['pages'];
$free_cta_pages[0]['cta'] = array( 'enabled' => true, 'type' => 'text', 'label' => '資料を見る', 'url' => 'https://example.test/details', 'freePosition' => true, 'x' => 125, 'y' => -4, 'width' => 46, 'fontSize' => 21, 'textColor' => '#123ABC', 'backgroundColor' => 'invalid', 'borderColor' => '#fedcba', 'borderRadius' => 11, 'attentionEffect' => 'glow', 'hoverEffect' => 'lift' );
$free_cta = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pages' => $free_cta_pages ) ) );
if ( $with_pro_cta && ( false === strpos( $free_cta, 'amv-reader__cta--text amv-reader__cta--free amv-reader__cta--attention-glow amv-reader__cta--hover-lift' ) || false === strpos( $free_cta, '--amv-cta-x:100%;--amv-cta-y:0%;--amv-cta-width:46%;--amv-cta-font-size:21px' ) || false === strpos( $free_cta, '--amv-cta-text:#123abc;--amv-cta-background:#1f2937;--amv-cta-border:#fedcba;--amv-cta-radius:11px' ) ) ) { throw new Exception( 'Pro free-position CTA sanitizing or output failed' ); }
$invalid_effect_pages = $attrs['pages'];
$invalid_effect_pages[0]['cta'] = array( 'enabled' => true, 'type' => 'text', 'label' => 'Effects', 'url' => 'https://example.test/effects', 'attentionEffect' => 'spin', 'hoverEffect' => 'hide' );
$invalid_effect_cta = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pages' => $invalid_effect_pages ) ) );
if ( false !== strpos( $invalid_effect_cta, 'amv-reader__cta--attention-' ) || false !== strpos( $invalid_effect_cta, 'amv-reader__cta--hover-' ) ) { throw new Exception( 'Invalid CTA effects were rendered' ); }
$image_cta_pages = $attrs['pages'];
$image_cta_pages[1]['cta'] = array( 'enabled' => true, 'type' => 'image', 'url' => 'https://example.test/download', 'imageUrl' => 'https://example.test/cta.png', 'imageAlt' => '資料を見る', 'position' => 'right' );
$image_cta = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pages' => $image_cta_pages ) ) );
if ( $with_pro_cta && ( false === strpos( $image_cta, 'amv-reader__cta--image amv-reader__cta--right' ) || false === strpos( $image_cta, 'src="https://example.test/cta.png"' ) || false === strpos( $image_cta, 'alt="資料を見る"' ) ) ) { throw new Exception( 'Pro image CTA output failed' ); }
$invalid_cta_pages = $attrs['pages'];
$invalid_cta_pages[0]['cta'] = array( 'enabled' => true, 'type' => 'text', 'label' => 'Unsafe', 'url' => 'javascript:alert(1)', 'position' => 'invalid' );
if ( false !== strpos( ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'pages' => $invalid_cta_pages ) ) ), 'amv-reader__cta' ) ) { throw new Exception( 'Unsafe CTA URL was rendered' ); }
$keyed_pages = $attrs['pages'];
$keyed_pages[0]['pageKey'] = 'PAGE-One!!';
$keyed_pages[0]['cta'] = array( 'enabled' => true, 'ctaKey' => 'CTA-Primary!!', 'type' => 'text', 'label' => 'Keyed', 'url' => 'https://example.test/keyed' );
$keyed = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'viewerKey' => 'Viewer-ABC_123!!', 'instanceKey' => 'Placement-ABC!!', 'pages' => $keyed_pages ) ) );
if ( false === strpos( $keyed, 'data-viewer-key="viewer-abc_123"' ) || false === strpos( $keyed, 'data-instance-key="placement-abc"' ) || false === strpos( $keyed, 'data-page-key="page-one"' ) || ( $with_pro_cta && false === strpos( $keyed, 'data-cta-key="cta-primary"' ) ) || false !== strpos( $keyed, '!!' ) ) { throw new Exception( 'Persistent Viewer or CTA keys were not sanitized' ); }
$unkeyed = ai_manga_viewer_render_viewer( $attrs );
if ( ! preg_match( '/data-viewer-key="legacy-post-456-viewer-[0-9]+"/', $unkeyed ) || ! preg_match( '/data-instance-key="legacy-post-456-placement-[0-9]+"/', $unkeyed ) || ! preg_match( '/data-page-key="legacy-post-456-viewer-[0-9]+-page-1"/', $unkeyed ) ) { throw new Exception( 'Legacy unkeyed viewer did not receive compatible analytics keys' ); }
$side_zoom = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'enableZoom' => true, 'zoomControlsPosition' => 'right' ) ) );
if ( false === strpos( $side_zoom, 'data-zoom-position="right"' ) || false === strpos( $side_zoom, 'amv-reader__zoom-controls--side' ) ) { throw new Exception( 'Side zoom controls are not rendered' ); }
$invalid_zoom = ai_manga_viewer_render_viewer( array_merge( $attrs, array( 'enableZoom' => true, 'zoomControlsPosition' => 'invalid' ) ) );
if ( false === strpos( $invalid_zoom, 'data-zoom-position="bottom"' ) || false === strpos( $invalid_zoom, 'amv-reader__zoom-controls--bottom' ) ) { throw new Exception( 'Invalid zoom position is not normalized' ); }
$spread_pages = array();
for ( $spread_index = 1; $spread_index <= 6; $spread_index++ ) {
	$spread_pages[] = array( 'url' => 'https://example.test/portrait-' . $spread_index . '.svg', 'alt' => 'Page' . $spread_index, 'pageKey' => 'spread-page-' . $spread_index, 'focusAreas' => 2 === $spread_index ? array( $area ) : array(), 'mobileFocusAreas' => array() );
}
$spread_pages[1]['cta'] = array( 'enabled' => true, 'ctaKey' => 'spread-cta-2', 'type' => 'text', 'label' => '詳細', 'url' => 'https://example.test/details' );
$spread_pages[2]['cta'] = array( 'enabled' => true, 'ctaKey' => 'spread-cta-3', 'type' => 'text', 'label' => 'お問い合わせ', 'url' => 'https://example.test/contact' );
$spread_fixture_attrs = array_merge( $attrs, array( 'pages' => $spread_pages, 'viewerKey' => 'spread-viewer', 'instanceKey' => 'spread-instance', 'pageLayout' => 'spread', 'singleFirstPage' => true, 'enableZoom' => true, 'enableFullscreen' => true ) );
$spread_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $spread_fixture_attrs ), 1 );
$page_focus_fixture_attrs = array_merge( $spread_fixture_attrs, array( 'viewerKey' => 'page-focus-viewer', 'instanceKey' => 'page-focus-instance', 'spreadReadingMode' => 'pageFocus', 'fullscreenStartAtCurrent' => true, 'focusReaderStartAtCurrent' => true ) );
$page_focus_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $page_focus_fixture_attrs ), 1 );
$page_focus_auto_attrs = array_merge( $page_focus_fixture_attrs, array( 'viewerKey' => 'page-focus-auto-viewer', 'instanceKey' => 'page-focus-auto-instance', 'pageLayout' => 'auto', 'singleFirstPage' => false, 'binding' => 'ltr' ) );
$page_focus_auto_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $page_focus_auto_attrs ), 1 );
$auto_fixture_attrs = array_merge( $spread_fixture_attrs, array( 'viewerKey' => 'auto-viewer', 'instanceKey' => 'auto-instance', 'pageLayout' => 'auto', 'singleFirstPage' => false, 'binding' => 'ltr', 'fullscreenStartAtCurrent' => true ) );
$auto_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $auto_fixture_attrs ), 1 );
$vertical_fixture_attrs = array_merge( $spread_fixture_attrs, array( 'viewerKey' => 'vertical-viewer', 'instanceKey' => 'vertical-instance', 'fullscreenReadingMode' => 'vertical' ) );
$vertical_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $vertical_fixture_attrs ), 1 );
$vertical_current_fixture_attrs = array_merge( $vertical_fixture_attrs, array( 'viewerKey' => 'vertical-current-viewer', 'instanceKey' => 'vertical-current-instance', 'fullscreenStartAtCurrent' => true ) );
$vertical_current_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $vertical_current_fixture_attrs ), 1 );
$wide_pages = $spread_pages;
$wide_pages[1]['url'] = 'https://example.test/wide-2.svg';
$wide_fixture_attrs = array_merge( $spread_fixture_attrs, array( 'pages' => $wide_pages, 'viewerKey' => 'wide-viewer', 'instanceKey' => 'wide-instance' ) );
$wide_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $wide_fixture_attrs ), 1 );
$cover_fixture_attrs = array_merge( $spread_fixture_attrs, array( 'viewerKey' => 'cover-viewer', 'instanceKey' => 'cover-instance', 'inlineDisplayMode' => 'coverLauncher', 'enableFullscreen' => false ) );
$cover_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $cover_fixture_attrs ), 1 );
$cover_vertical_fixture_attrs = array_merge( $cover_fixture_attrs, array( 'viewerKey' => 'cover-vertical-viewer', 'instanceKey' => 'cover-vertical-instance', 'fullscreenReadingMode' => 'vertical', 'zoomControlsPosition' => 'right' ) );
$cover_vertical_fixture = preg_replace( '/<div\b/', '<div data-analytics-source="library"', ai_manga_viewer_render_viewer( $cover_vertical_fixture_attrs ), 1 );
if ( false === strpos( $cover_fixture, 'amv-reader--cover-launcher' ) || false === strpos( $cover_fixture, 'data-inline-display-mode="coverLauncher"' ) || false === strpos( $cover_fixture, 'class="amv-reader__cover-launcher-button"' ) || false === strpos( $cover_fixture, '>Read manga<' ) || false === strpos( $cover_fixture, 'class="amv-reader__fullscreen"' ) ) { throw new Exception( 'Core cover launcher or forced fullscreen machinery failed' ); }
if ( $with_pro_panel && ( false === strpos( $cover_fixture, 'class="amv-reader__cover-focus-open"' ) || false === strpos( $cover_fixture, '>Read by panel<' ) ) ) { throw new Exception( 'Pro panel action is missing beside the cover launcher' ); }
if ( ! $with_pro_panel && false !== strpos( $cover_fixture, 'amv-reader__cover-focus-open' ) ) { throw new Exception( 'Core-only cover launcher exposed the Pro panel action' ); }
$count_fixture_html = '';
foreach ( array( 1, 2, 3, 4, 5, 10 ) as $fixture_count ) {
	$count_pages = array();
	for ( $count_index = 1; $count_index <= $fixture_count; $count_index++ ) {
		$count_pages[] = array( 'url' => 'https://example.test/portrait-count-' . $fixture_count . '-' . $count_index . '.svg', 'alt' => 'Page' . $count_index, 'pageKey' => 'count-' . $fixture_count . '-page-' . $count_index );
	}
	$count_fixture_html .= '<section id="count-fixture-' . $fixture_count . '">' . ai_manga_viewer_render_viewer( array_merge( $spread_fixture_attrs, array( 'pages' => $count_pages, 'viewerKey' => 'count-viewer-' . $fixture_count, 'instanceKey' => 'count-instance-' . $fixture_count, 'enableZoom' => false, 'enableFullscreen' => false ) ) ) . '</section>';
}
require dirname( __DIR__, 2 ) . '/cni_blocks/blocks/page-flip/render.php';
$GLOBALS['test_block_class'] = 'wp-block-cni-blocks-page-flip';
$old = cni_blocks_render_page_flip( $attrs );
$normalized = str_replace( array( 'wp-block-cni-blocks-page-flip', 'cni-page-flip', 'cni-manga-viewer' ), array( 'wp-block-ai-manga-viewer-viewer', 'amv-reader', 'amv-modal' ), $old );
$new_for_parity = str_replace( array( ' data-amv-panel-reader="on"', ' data-amv-panel-start="first"', ' data-amv-panel-mobile="on"', ' data-zoom="off"', ' data-zoom-position="bottom"', ' data-page-layout="single"', ' data-inline-display-mode="reader"', ' data-single-first-page="on"', ' data-spread-reading-mode="overview"', ' data-fullscreen-reading-mode="paged"', ' data-fullscreen-start="first"', '<div class="amv-reader__focus-layer"><div class="amv-reader__surface">', '<div class="amv-modal__extension-layer" hidden></div>', '</div></div></div><button type="button" class="amv-reader__edge amv-reader__edge--next"' ), array( '', '', '', '', '', '', '', '', '', '', '', '', '', '</div><button type="button" class="amv-reader__edge amv-reader__edge--next"' ), $new );
$new_for_parity = preg_replace( '/;--amv-reader-spread-max-width:[0-9.]+px;--amv-reader-spread-gap:[0-9.]+px/', '', $new_for_parity );
$new_for_parity = preg_replace( '/ role="group" aria-label="Page [0-9]+"/', '', $new_for_parity );
$new_for_parity = preg_replace( '/ data-(?:viewer|instance|page)-key="legacy-post-456-(?:viewer|placement)-[0-9]+(?:-page-[0-9]+)?"/', '', $new_for_parity );
$new_for_parity = preg_replace( '~<div class="amv-reader__mode-controls">(<button type="button" class="amv-reader__focus-open"[^>]*>.*?</button>)</div>~', '$1', $new_for_parity );
$new_for_parity = preg_replace( '~<div class="amv-reader__canvas">(.*?)</div></figure>~s', '$1</figure>', $new_for_parity );
if ( $with_pro_panel && ( 2 !== substr_count( $new, 'data-amv-panel-page=' ) || false === strpos( $new, 'class="amv-reader__focus-open"' ) || false === strpos( $new, 'class="amv-modal"' ) || false === strpos( $new, 'class="amv-modal__overview"' ) ) ) { throw new Exception( 'Pro panel reader functional render contract failed' ); }
if ( in_array( '--side-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $side_zoom . '</body></html>';
} elseif ( in_array( '--spread-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body><section id="spread-fixture">' . $spread_fixture . '</section><section id="page-focus-fixture">' . $page_focus_fixture . '</section><section id="page-focus-auto-fixture">' . $page_focus_auto_fixture . '</section><section id="auto-fixture">' . $auto_fixture . '</section><section id="vertical-fixture">' . $vertical_fixture . '</section><section id="vertical-current-fixture">' . $vertical_current_fixture . '</section><section id="wide-fixture">' . $wide_fixture . '</section><section id="cover-fixture">' . $cover_fixture . '</section><section id="cover-vertical-fixture">' . $cover_vertical_fixture . '</section>' . $count_fixture_html . '</body></html>';
} elseif ( in_array( '--direct-fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $fullscreen_new . '</body></html>';
} elseif ( in_array( '--fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $old . $library_fullscreen . '</body></html>';
} else {
	echo "PASS: block/library/shortcode registration, access filtering, CTA compatibility retention, fullscreen/zoom output, old/new PHP coexistence and render parity\n";
}
