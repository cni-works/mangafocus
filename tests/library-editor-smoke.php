<?php
/** php tests/library-editor-smoke.php <official-reference-directory> [--without-classic|--no-core-api]
 * Real WP filter/selection code and Classic Editor, mocked storage/screens; no WP/DB/site boot.
 * References: official WordPress trunk post.php/plugin.php and Classic Editor classic-editor.php.
 */
$root = dirname( __DIR__ );
$reference = $argv[1] ?? '';
if ( ! is_file( $reference . '/wp-plugin.php' ) || ! is_file( $reference . '/wp-post.php' ) || ! is_file( $reference . '/classic-editor.php' ) ) {
	fwrite( STDERR, "Supply the reviewed official source reference directory; no automatic downloads.\n" ); exit( 2 );
}
define( 'ABSPATH', __DIR__ );
define( 'WP_PLUGIN_DIR', dirname( $root ) ); define( 'WPMU_PLUGIN_DIR', __DIR__ );
require $reference . '/wp-plugin.php';
$GLOBALS['checks'] = 0; $GLOBALS['wp_plugin_paths'] = array();
function library_check( $ok, $message ) { ++$GLOBALS['checks']; if ( ! $ok ) { throw new RuntimeException( $message ); } }
function library_function( $source, $wanted ) {
	$tokens = token_get_all( $source );
	foreach ( $tokens as $i => $token ) {
		if ( ! is_array( $token ) || T_FUNCTION !== $token[0] ) { continue; }
		$j = $i + 1; while ( is_array( $tokens[$j] ) && T_WHITESPACE === $tokens[$j][0] ) { ++$j; }
		if ( ! is_array( $tokens[$j] ) || $wanted !== $tokens[$j][1] ) { continue; }
		$text = ''; $depth = 0; $started = false;
		for ( $k = $i; $k < count( $tokens ); ++$k ) {
			$t = $tokens[$k]; $text .= is_array( $t ) ? $t[1] : $t;
			if ( '{' === $t ) { ++$depth; $started = true; }
			if ( '}' === $t && 0 === --$depth && $started ) { return $text; }
		}
	}
	throw new RuntimeException( 'Official/source function missing: ' . $wanted );
}
function __( $s, $domain = '' ) { return $s; }
function __return_true() { return true; } function __return_false() { return false; }
function is_admin() { return $GLOBALS['library_admin']; }
function is_multisite() { return false; }
function wp_normalize_path( $path ) { return str_replace( '\\', '/', $path ); }
function register_post_type( $name, $args ) { $GLOBALS['library_types'][$name] = (object) $args; }
function post_type_exists( $name ) { return isset( $GLOBALS['library_types'][$name] ); }
function post_type_supports( $name, $feature ) { return in_array( $feature, $GLOBALS['library_types'][$name]->supports ?? array(), true ); }
function get_post_type_object( $name ) { return $GLOBALS['library_types'][$name] ?? null; }
function get_post( $value ) { return is_object( $value ) ? $value : ( $GLOBALS['library_posts'][$value] ?? null ); }
function get_post_type( $value ) { return get_post( $value )->post_type ?? false; }
function get_option( $name, $default = false ) { return $GLOBALS['library_options'][$name] ?? $default; }
function get_user_option( $name, $user = 0 ) { return $GLOBALS['library_user_editor']; }
function get_post_meta( $id, $name, $single = false ) { return 'classic-editor'; }
function update_option() { throw new RuntimeException( 'Options must not be written.' ); }
function update_post_meta() { throw new RuntimeException( 'Editor memory/data must not be written.' ); }
function update_user_option() { throw new RuntimeException( 'User settings must not be written.' ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_-]/', '', strtolower( $value ) ); }
function wp_unslash( $value ) { return is_string( $value ) ? stripslashes( $value ) : $value; }
function absint( $value ) { return abs( (int) $value ); }
function check_admin_referer() { $GLOBALS['library_metabox_nonce'] = ( $GLOBALS['library_metabox_nonce'] ?? 0 ) + 1; }
$source = file_get_contents( $root . '/mangafocus.php' );
eval( library_function( $source, 'ai_manga_viewer_register_library' ) );
$start = strpos( $source, '/** Keep Classic Editor\'s preferences intact' );
$end = strpos( $source, '/** Expose one prepared cover URL', $start );
library_check( false !== $start && false !== $end, 'Library editor integration block missing.' );
$integration = substr( $source, $start, $end - $start );
if ( ! in_array( '--no-core-api', $argv, true ) ) {
	$core = file_get_contents( $reference . '/wp-post.php' );
	eval( library_function( $core, 'use_block_editor_for_post_type' ) );
	eval( library_function( $core, 'use_block_editor_for_post' ) );
}
eval( $integration );
$GLOBALS['library_admin'] = true; $_SERVER['REQUEST_METHOD'] = 'GET';
$GLOBALS['pagenow'] = 'post-new.php'; $_GET = array( 'post_type' => 'amv_viewer' );
if ( in_array( '--no-core-api', $argv, true ) ) {
	library_check( false === ai_manga_viewer_library_classic_editor_settings( false ), 'Missing Core API changed editor choice.' );
	echo "PASS: missing block-editor API remains untouched without fatal error.\n"; exit;
}
$with_classic = ! in_array( '--without-classic', $argv, true );
if ( $with_classic ) { require $reference . '/classic-editor.php'; }
function library_case( $editor, $allow, $page, $query, $id, $expected, $extra = '', $classic = true ) {
	$GLOBALS['wp_filter'] = array(); $GLOBALS['wp_actions'] = array(); $GLOBALS['wp_filters'] = array(); $GLOBALS['wp_current_filter'] = array();
	$GLOBALS['library_admin'] = true; $GLOBALS['wp_version'] = '7.1.3'; $GLOBALS['pagenow'] = $page;
	$_GET = $query; $_SERVER['REQUEST_METHOD'] = 'GET';
	$GLOBALS['library_options'] = array( 'classic-editor-replace' => $editor, 'classic-editor-allow-users' => $allow ? 'allow' : 'disallow' );
	$GLOBALS['library_user_editor'] = 'classic';
	$GLOBALS['library_types'] = array(); $GLOBALS['library_posts'] = array();
	foreach ( array( 11 => 'amv_viewer', 12 => 'post', 13 => 'page', 14 => 'other_book', 15 => 'amy_viewer' ) as $post_id => $type ) {
		$GLOBALS['library_posts'][$post_id] = (object) array( 'ID' => $post_id, 'post_type' => $type, 'post_status' => 'draft' );
		if ( 'amv_viewer' !== $type ) { register_post_type( $type, array( 'show_in_rest' => true, 'supports' => array( 'editor' ) ) ); }
	}
	add_filter( 'classic_editor_plugin_settings', 'ai_manga_viewer_library_classic_editor_settings' );
	add_filter( 'use_block_editor_for_post_type', 'ai_manga_viewer_library_editor_restrictions', 10, 2 );
	add_filter( 'use_block_editor_for_post', 'ai_manga_viewer_library_editor_restrictions', 10, 2 );
	if ( 'core-type-veto' === $extra ) { add_filter( 'use_block_editor_for_post_type', '__return_false', 5 ); }
	if ( 'core-post-veto' === $extra ) { add_filter( 'use_block_editor_for_post', '__return_false', 5 ); }
	if ( 'late-core-veto' === $extra ) { add_filter( 'use_block_editor_for_post', '__return_false', 1000 ); }
	if ( 'ce-type-veto' === $extra ) { add_filter( 'classic_editor_enabled_editors_for_post_type', function( $editors ) { $editors['block_editor'] = false; return $editors; } ); }
	if ( 'ce-post-veto' === $extra ) { add_filter( 'classic_editor_enabled_editors_for_post', function( $editors ) { $editors['block_editor'] = false; return $editors; } ); }
	if ( 'ce-type-delegates' === $extra ) { add_filter( 'classic_editor_enabled_editors_for_post_type', function( $editors, $type ) { $editors['block_editor'] = use_block_editor_for_post_type( $type ); return $editors; }, 10, 2 ); }
	if ( 'ce-post-delegates' === $extra ) { add_filter( 'classic_editor_enabled_editors_for_post', function( $editors, $post ) { $editors['block_editor'] = use_block_editor_for_post( $post ); return $editors; }, 10, 2 ); }
	if ( 'site-settings-veto' === $extra ) { add_filter( 'classic_editor_plugin_settings', function() { return array( 'editor' => 'classic', 'allow-users' => false ); }, 5 ); }
	if ( 'post-request' === $extra ) { $_SERVER['REQUEST_METHOD'] = 'POST'; }
	if ( 'frontend' === $extra ) { $GLOBALS['library_admin'] = false; }
	if ( $classic ) {
		foreach ( array( 'settings' => null, 'supported_post_types' => array() ) as $name => $value ) {
			$p = new ReflectionProperty( 'Classic_Editor', $name ); $p->setAccessible( true ); $p->setValue( null, $value );
		}
		add_action( 'enqueue_block_assets', '__return_true' );
		add_action( 'plugins_loaded', array( 'Classic_Editor', 'init_actions' ) );
	}
	$before = $GLOBALS['library_options'];
	do_action( 'plugins_loaded' ); // Classic Editor decides its hooks before the CPT init action.
	ai_manga_viewer_register_library();
	library_check( true === $GLOBALS['library_types']['amv_viewer']->show_in_rest && post_type_supports( 'amv_viewer', 'editor' ), 'CPT prerequisites changed.' );
	if ( 'no-rest' === $extra ) { $GLOBALS['library_types']['amv_viewer']->show_in_rest = false; }
	if ( 'no-editor-support' === $extra ) { $GLOBALS['library_types']['amv_viewer']->supports = array( 'title' ); }
	if ( 'new' === $extra ) { $GLOBALS['library_posts'][$id]->post_status = 'auto-draft'; }
	if ( 'metabox' === $extra ) { $_GET['meta-box-loader'] = '1'; }
	library_check( $expected === use_block_editor_for_post( $id ), 'Wrong editor: ' . json_encode( array( $editor, $allow, $page, $query, $id, $extra ) ) );
	library_check( $before === $GLOBALS['library_options'] && 'classic' === $GLOBALS['library_user_editor'], 'Stored preferences changed.' );
}
foreach ( array( 'classic', 'block' ) as $editor ) {
	foreach ( array( false, true ) as $allow ) {
		library_case( $editor, $allow, 'post-new.php', array( 'post_type' => 'amv_viewer' ), 11, true, 'new', $with_classic );
		library_case( $editor, $allow, 'post.php', array( 'post' => '11', 'action' => 'edit', 'classic-editor' => '' ), 11, true, '', $with_classic );
		foreach ( array( 12 => 'post', 13 => 'page', 14 => 'other_book', 15 => 'amy_viewer' ) as $id => $type ) {
			$expected = ! $with_classic || ( 'block' === $editor && ! $allow );
			library_case( $editor, $allow, 'post-new.php', array( 'post_type' => $type ), $id, $expected, '', $with_classic );
			library_case( $editor, $allow, 'post.php', array( 'post' => (string) $id, 'action' => 'edit' ), $id, $expected, '', $with_classic );
		}
	}
}
foreach ( array( 'core-type-veto', 'core-post-veto', 'late-core-veto', 'no-rest', 'no-editor-support', 'metabox' ) as $extra ) {
	library_case( 'classic', false, 'post-new.php', array( 'post_type' => 'amv_viewer' ), 11, false, $extra, $with_classic );
}
if ( $with_classic ) {
	foreach ( array( 'ce-type-delegates', 'ce-post-delegates' ) as $extra ) {
		library_case( 'classic', false, 'post-new.php', array( 'post_type' => 'amv_viewer' ), 11, true, $extra );
	}
	foreach ( array( 'ce-type-veto', 'ce-post-veto', 'site-settings-veto', 'post-request', 'frontend' ) as $extra ) {
		library_case( 'classic', false, 'post-new.php', array( 'post_type' => 'amv_viewer' ), 11, false, $extra );
	}
	foreach ( array( 'options-writing.php', 'admin-ajax.php', 'edit.php' ) as $page ) {
		library_case( 'classic', false, $page, array( 'post_type' => 'amv_viewer' ), 11, false );
	}
	library_case( 'classic', false, 'post.php', array( 'post' => '12', 'action' => 'edit', 'post_type' => 'amv_viewer' ), 12, false );
	library_case( 'classic', false, 'post.php', array( 'post' => '11', 'action' => 'trash' ), 11, false );
}
echo 'PASS: ' . $GLOBALS['checks'] . ' assertions; actual Core filters/editor functions and ' . ( $with_classic ? 'Classic Editor ' . CLASSIC_EDITOR_VERSION : 'no Classic Editor' ) . "; mocked screens/storage, no WP/DB/site boot.\n";
