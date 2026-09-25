<?php
/** Isolated WordPress API doubles; this is not a WordPress integration test. */
define( 'ABSPATH', __DIR__ );
error_reporting( E_ALL );
set_error_handler( function( $severity, $message, $file, $line ) {
	throw new ErrorException( $message, 0, $severity, $file, $line );
} );
function absint( $v ) { return abs( (int) $v ); }
function esc_url_raw( $v ) { return preg_match( '~^https?://~', $v ) ? $v : ''; }
function esc_url( $v ) { return esc_attr( esc_url_raw( $v ) ); }
function sanitize_key( $v ) { return preg_replace( '/[^a-z0-9_-]/', '', strtolower( $v ) ); }
function sanitize_text_field( $v ) { return strip_tags( $v ); }
function esc_attr( $v ) { return htmlspecialchars( (string) $v, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $v ) { return esc_attr( $v ); }
function __( $v, $domain = '' ) { return $v; }
function esc_attr__( $v, $domain ) { return esc_attr( $v ); }
function esc_html__( $v, $domain ) { return esc_html( $v ); }
function wp_json_encode( $v ) { return json_encode( $v ); }
function wp_unique_id( $prefix ) { static $id = 0; return $prefix . ++$id; }
function wp_get_attachment_image( $id, $size, $icon, $attrs ) { return ''; }
function wp_get_attachment_image_url( $id, $size ) { return false; }
function get_block_wrapper_attributes( $attrs ) {
	$attrs['class'] = $GLOBALS['test_block_class'] . ' ' . $attrs['class'];
	return implode( ' ', array_map( function( $key ) use ( $attrs ) { return $key . '="' . esc_attr( $attrs[$key] ) . '"'; }, array_keys( $attrs ) ) );
}
function plugin_dir_path( $file ) { return dirname( $file ) . '/'; }
function plugin_dir_url( $file ) { return 'https://example.test/plugin/'; }
function add_action( $hook, $fn ) { $GLOBALS['actions'][$hook] = $fn; }
function add_filter( $hook, $fn ) { $GLOBALS['filters'][$hook] = $fn; }
function wp_register_script( $handle, $url, $deps, $version, $footer = false ) { $GLOBALS['scripts'][$handle] = $deps; }
function wp_register_style( $handle, $url, $deps, $version ) {}
function wp_set_script_translations( $handle, $domain ) {}
function register_block_type( $path, $settings ) {
	$metadata = json_decode( file_get_contents( $path . 'block.json' ), true );
	if ( 'ai-manga-viewer/viewer' !== $metadata['name'] || ! is_callable( $settings['render_callback'] ) ) { throw new Exception( 'Registration failed' ); }
}
require dirname( __DIR__ ) . '/ai-manga-viewer.php';
call_user_func( $GLOBALS['actions']['init'] );
if ( count( ai_manga_viewer_block_categories( ai_manga_viewer_block_categories( array() ) ) ) !== 1 ) { throw new Exception( 'Duplicate category' ); }
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
if ( '' !== ai_manga_viewer_render_viewer( array() ) ) { throw new Exception( 'Empty output' ); }
$area = array( 'id' => 'focus-existing', 'x' => 25, 'y' => 30, 'width' => 25, 'height' => 30, 'zoom' => 90, 'view' => 'focus' );
$attrs = array( 'focusReader' => true, 'mobileFocusReader' => true, 'enableAnimation' => false, 'pages' => array(
	array( 'id' => 0, 'url' => 'https://example.test/page1.svg', 'alt' => 'Page "1" <script>alert(1)</script>', 'focusAreas' => array( $area, array_merge( $area, array( 'x' => 75 ) ) ), 'mobileFocusAreas' => array( $area ) ),
	array( 'url' => 'https://example.test/page2.svg', 'alt' => 'Page 2', 'focusAreas' => array(), 'mobileFocusAreas' => array() ),
) );
$new = ai_manga_viewer_render_viewer( $attrs );
if ( false !== strpos( $new, '<script>' ) || false !== strpos( $new, 'cni-' ) ) { throw new Exception( 'Escaping or namespace failure' ); }
require dirname( __DIR__, 2 ) . '/cni_blocks/blocks/page-flip/render.php';
$GLOBALS['test_block_class'] = 'wp-block-cni-blocks-page-flip';
$old = cni_blocks_render_page_flip( $attrs );
$normalized = str_replace( array( 'wp-block-cni-blocks-page-flip', 'cni-page-flip', 'cni-manga-viewer' ), array( 'wp-block-ai-manga-viewer-viewer', 'amv-reader', 'amv-modal' ), $old );
if ( preg_replace( '/pages-\d+/', 'pages-ID', $new ) !== preg_replace( '/pages-\d+/', 'pages-ID', $normalized ) ) { throw new Exception( 'Render parity failed' ); }
if ( in_array( '--fixture', $argv, true ) ) {
	echo '<!doctype html><html><meta charset="utf-8"><body>' . $old . $new . '</body></html>';
} else {
	echo "PASS: registration, category, empty content, escaping, old/new PHP coexistence and render parity\n";
}
