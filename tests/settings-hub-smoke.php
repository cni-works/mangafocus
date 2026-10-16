<?php
/** Isolated smoke test for the Core-owned general settings hub. */
define( 'ABSPATH', __DIR__ );
define( 'AI_MANGA_VIEWER_VERSION', '0.3.0' );
define( 'AI_MANGA_VIEWER_PLUGIN_FILE', dirname( __DIR__ ) . '/mangafocus.php' );

$GLOBALS['amv_settings_hooks'] = array();
$GLOBALS['amv_settings_pro'] = null;
$GLOBALS['amv_settings_features'] = array( 'panel_reader' => true, 'cta' => false, 'analytics' => false, 'ai_consultation' => false, 'manga_creation' => false );
$GLOBALS['amv_settings_capabilities'] = array( 'panel_reader' => array( 'runtime' => true, 'editor' => true ), 'cta' => array( 'runtime' => false, 'editor' => false ), 'analytics' => array( 'collection' => false, 'report' => false ), 'ai_consultation' => array( 'admin' => false ), 'manga_creation' => array( 'admin' => false ) );
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
function wp_kses_post( $html ) { return $html; }
function sanitize_text_field( $text ) { return trim( strip_tags( (string) $text ) ); }
function admin_url( $path = '' ) { return 'https://example.test/wp-admin/' . ltrim( $path, '/' ); }
function add_query_arg( $args, $url ) { return $url . '?' . http_build_query( $args ); }
function plugin_basename() { return 'mangafocus/mangafocus.php'; }
function plugin_dir_path( $file ) { return rtrim( dirname( $file ), '/\\' ) . DIRECTORY_SEPARATOR; }
function plugins_url( $path ) { return 'https://example.test/plugins/ai-manga-viewer/' . ltrim( $path, '/' ); }
function wp_enqueue_style( ...$args ) { $GLOBALS['amv_settings_styles'][] = $args; }
function current_user_can() { return $GLOBALS['amv_settings_can_manage']; }
function get_option( $name, $default = false ) { return 'ai_manga_viewer_analytics_retention_days' === $name ? '90' : $default; }
function ai_manga_viewer_sanitize_retention_days( $days ) { return (int) $days; }
function ai_manga_viewer_get_feature_map() { return $GLOBALS['amv_settings_features']; }
function ai_manga_viewer_get_capability_map() { return $GLOBALS['amv_settings_capabilities']; }
function add_submenu_page( ...$args ) { $GLOBALS['amv_settings_menu'] = $args; }
function wp_die( $message ) { throw new RuntimeException( $message ); }
function amv_expect( $condition, $message ) { if ( ! $condition ) throw new RuntimeException( $message ); }

require dirname( __DIR__ ) . '/includes/settings.php';

ai_manga_viewer_add_settings_page();
amv_expect( 'ai-manga-viewer-settings' === $GLOBALS['amv_settings_menu'][4], 'General settings menu slug changed.' );
amv_expect( 'manage_options' === $GLOBALS['amv_settings_menu'][3], 'General settings capability changed.' );
amv_expect( false !== strpos( ai_manga_viewer_settings_url(), 'page=ai-manga-viewer-settings' ), 'General settings URL is invalid.' );
amv_expect( false !== strpos( ai_manga_viewer_plugin_action_links( array( '<a>Deactivate</a>' ) )[0], '>Settings<' ), 'Core settings action link missing.' );

ob_start(); ai_manga_viewer_render_settings_page(); $core_html = ob_get_clean();
foreach ( array( '0.3.0', 'Not installed or inactive', 'Open Manga Library', 'Register a new comic', 'Open Analytics Settings', 'Free Viewer', 'Panel-by-Panel', 'CTA', 'Manga Analytics', 'AI consultation', 'AI manga production support' ) as $needle ) {
	amv_expect( false !== strpos( $core_html, $needle ), 'Core-only settings output missing: ' . $needle );
}
amv_expect( false === strpos( $core_html, '0.1.0-alpha' ), 'Core-only screen leaked a Pro version.' );
amv_expect( false !== strpos( $core_html, 'Panel-by-Panel' ) && 5 === substr_count( $core_html, 'is-unavailable">Unavailable' ), 'Core-only feature statuses are invalid.' );

$GLOBALS['amv_settings_pro'] = array( 'installed' => true, 'active' => true, 'version' => '0.1.0-alpha' );
$GLOBALS['amv_settings_features'] = array( 'panel_reader' => true, 'cta' => true, 'analytics' => true, 'ai_consultation' => true, 'manga_creation' => true );
$GLOBALS['amv_settings_capabilities'] = array( 'panel_reader' => array( 'runtime' => true, 'editor' => true ), 'cta' => array( 'runtime' => true, 'editor' => true ), 'analytics' => array( 'collection' => true, 'report' => true ), 'ai_consultation' => array( 'admin' => true ), 'manga_creation' => array( 'admin' => true ) );
ob_start(); ai_manga_viewer_render_settings_page(); $pro_html = ob_get_clean();
amv_expect( false !== strpos( $pro_html, '0.1.0-alpha' ) && false !== strpos( $pro_html, '>Active<' ), 'Core + Pro status output is invalid.' );
amv_expect( 0 === substr_count( $pro_html, 'Unavailable' ), 'Available Pro features were shown as unavailable.' );

$GLOBALS['amv_settings_capabilities'] = array( 'panel_reader' => array( 'runtime' => true, 'editor' => true ), 'cta' => array( 'runtime' => true, 'editor' => false ), 'analytics' => array( 'collection' => true, 'report' => false ), 'ai_consultation' => array( 'admin' => false ), 'manga_creation' => array( 'admin' => false ) );
ob_start(); ai_manga_viewer_render_settings_page(); $expired_html = ob_get_clean();
amv_expect( 1 === substr_count( $expired_html, 'Display active; editing unavailable' ), 'Expired CTA status output is invalid.' );
amv_expect( 2 === substr_count( $expired_html, 'Collection active; reports unavailable' ), 'Expired Analytics status output is invalid.' );
amv_expect( false !== strpos( $expired_html, '<strong>AI consultation</strong>' ) && false !== strpos( $expired_html, 'is-unavailable">Unavailable' ), 'Expired AI Consultation status output is invalid.' );
amv_expect( false !== strpos( $expired_html, '<dt>Pro status</dt><dd><span class="amv-settings__status is-available">Active</span>' ), 'Expired license changed the plugin status display.' );

$GLOBALS['amv_settings_capabilities'] = array( 'panel_reader' => array( 'runtime' => true, 'editor' => true ), 'cta' => array( 'runtime' => false, 'editor' => false ), 'analytics' => array( 'collection' => false, 'report' => false ), 'ai_consultation' => array( 'admin' => false ), 'manga_creation' => array( 'admin' => false ) );
ob_start(); ai_manga_viewer_render_settings_page(); $unlicensed_html = ob_get_clean();
amv_expect( false === strpos( $unlicensed_html, 'is-limited' ) && 0 === substr_count( $unlicensed_html, 'Display active; editing unavailable' ), 'Unlicensed Pro features were shown as partially available.' );
amv_expect( 5 === substr_count( $unlicensed_html, 'is-unavailable">Unavailable' ), 'Unlicensed Pro feature statuses are invalid.' );
amv_expect( false !== strpos( $unlicensed_html, '<dt>Pro status</dt><dd><span class="amv-settings__status is-available">Active</span>' ), 'Unlicensed state changed the plugin status display.' );

$GLOBALS['amv_settings_pro'] = array( 'installed' => true, 'active' => false, 'version' => '0.1.0-alpha' );
ob_start(); ai_manga_viewer_render_settings_page(); $inactive_html = ob_get_clean();
amv_expect( false !== strpos( $inactive_html, '>Unavailable<' ), 'Installed but unavailable Pro status is invalid.' );

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
