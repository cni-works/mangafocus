<?php
/** Isolated smoke test for the Core-owned general settings hub. */
define( 'ABSPATH', __DIR__ );
define( 'AI_MANGA_VIEWER_VERSION', '0.3.0-alpha' );
define( 'AI_MANGA_VIEWER_PLUGIN_FILE', dirname( __DIR__ ) . '/ai-manga-viewer.php' );

$GLOBALS['amv_settings_hooks'] = array();
$GLOBALS['amv_settings_pro'] = null;
$GLOBALS['amv_settings_features'] = array( 'panel_reader' => false, 'cta' => false, 'analytics' => false, 'ai_consultation' => false );
$GLOBALS['amv_settings_styles'] = array();
$GLOBALS['amv_settings_can_manage'] = true;

function add_action( $hook, $callback, $priority = 10 ) { $GLOBALS['amv_settings_hooks'][ $hook ][ $priority ][] = $callback; }
function add_filter( $hook, $callback ) { $GLOBALS['amv_settings_hooks'][ $hook ][10][] = $callback; }
function apply_filters( $hook, $value ) { return 'ai_manga_viewer_pro_status' === $hook && is_array( $GLOBALS['amv_settings_pro'] ) ? $GLOBALS['amv_settings_pro'] : $value; }
function do_action() {}
function __( $text ) { return $text; }
function esc_html__( $text ) { return $text; }
function esc_html( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_attr( $text ) { return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $url ) { return $url; }
function sanitize_text_field( $text ) { return trim( strip_tags( (string) $text ) ); }
function admin_url( $path = '' ) { return 'https://example.test/wp-admin/' . ltrim( $path, '/' ); }
function add_query_arg( $args, $url ) { return $url . '?' . http_build_query( $args ); }
function plugin_basename() { return 'ai-manga-viewer/ai-manga-viewer.php'; }
function plugin_dir_path( $file ) { return rtrim( dirname( $file ), '/\\' ) . DIRECTORY_SEPARATOR; }
function plugins_url( $path ) { return 'https://example.test/plugins/ai-manga-viewer/' . ltrim( $path, '/' ); }
function wp_enqueue_style( ...$args ) { $GLOBALS['amv_settings_styles'][] = $args; }
function current_user_can() { return $GLOBALS['amv_settings_can_manage']; }
function get_option( $name, $default = false ) { return 'ai_manga_viewer_analytics_retention_days' === $name ? '90' : $default; }
function ai_manga_viewer_sanitize_retention_days( $days ) { return (int) $days; }
function ai_manga_viewer_get_feature_map() { return $GLOBALS['amv_settings_features']; }
function add_submenu_page( ...$args ) { $GLOBALS['amv_settings_menu'] = $args; }
function wp_die( $message ) { throw new RuntimeException( $message ); }
function amv_expect( $condition, $message ) { if ( ! $condition ) throw new RuntimeException( $message ); }

require dirname( __DIR__ ) . '/includes/settings.php';

ai_manga_viewer_add_settings_page();
amv_expect( 'ai-manga-viewer-settings' === $GLOBALS['amv_settings_menu'][4], 'General settings menu slug changed.' );
amv_expect( 'manage_options' === $GLOBALS['amv_settings_menu'][3], 'General settings capability changed.' );
amv_expect( false !== strpos( ai_manga_viewer_settings_url(), 'page=ai-manga-viewer-settings' ), 'General settings URL is invalid.' );
amv_expect( false !== strpos( ai_manga_viewer_plugin_action_links( array( '<a>Deactivate</a>' ) )[0], '>設定<' ), 'Core settings action link missing.' );

ob_start(); ai_manga_viewer_render_settings_page(); $core_html = ob_get_clean();
foreach ( array( '0.3.0-alpha', '未導入または無効', '漫画ライブラリを開く', '新しい漫画を登録', '解析設定を開く', 'Free Viewer', 'コマ読み', 'CTA', '漫画解析', 'AI相談' ) as $needle ) {
	amv_expect( false !== strpos( $core_html, $needle ), 'Core-only settings output missing: ' . $needle );
}
amv_expect( false === strpos( $core_html, '0.1.0-alpha' ), 'Core-only screen leaked a Pro version.' );

$GLOBALS['amv_settings_pro'] = array( 'installed' => true, 'active' => true, 'version' => '0.1.0-alpha' );
$GLOBALS['amv_settings_features'] = array( 'panel_reader' => true, 'cta' => true, 'analytics' => true, 'ai_consultation' => true );
ob_start(); ai_manga_viewer_render_settings_page(); $pro_html = ob_get_clean();
amv_expect( false !== strpos( $pro_html, '0.1.0-alpha' ) && false !== strpos( $pro_html, '>有効<' ), 'Core + Pro status output is invalid.' );
amv_expect( 0 === substr_count( $pro_html, '利用不可' ), 'Available Pro features were shown as unavailable.' );

$GLOBALS['amv_settings_pro'] = array( 'installed' => true, 'active' => false, 'version' => '0.1.0-alpha' );
ob_start(); ai_manga_viewer_render_settings_page(); $inactive_html = ob_get_clean();
amv_expect( false !== strpos( $inactive_html, '>利用不可<' ), 'Installed but unavailable Pro status is invalid.' );

$GLOBALS['amv_settings_can_manage'] = false;
$denied = false;
try { ai_manga_viewer_render_settings_page(); } catch ( RuntimeException $exception ) { $denied = true; }
amv_expect( $denied, 'General settings page did not enforce manage_options.' );
$GLOBALS['amv_settings_can_manage'] = true;

ai_manga_viewer_enqueue_settings_assets( 'dashboard_page_other' );
amv_expect( 0 === count( $GLOBALS['amv_settings_styles'] ), 'Settings CSS leaked to another admin screen.' );
ai_manga_viewer_enqueue_settings_assets( 'amv_viewer_page_ai-manga-viewer-settings' );
amv_expect( 1 === count( $GLOBALS['amv_settings_styles'] ), 'Settings CSS was not loaded on its screen.' );

echo "General settings hub smoke passed.\n";
