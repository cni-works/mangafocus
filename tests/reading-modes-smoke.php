<?php
/** CLI doubles and a byte-normalized 0.3.0 render oracle; not a WordPress integration test. */
$bootstrap = getenv( 'MANGAFOCUS_RENDER_TEST_BOOTSTRAP' ) ?: __DIR__ . '/render-smoke.php';
ob_start();
require $bootstrap;
ob_end_clean();
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
function mode_expect( $condition, $message ) { if ( ! $condition ) { throw new Exception( $message ); } }
function mode_normalize( $html ) { return preg_replace( '/amv-reader-pages-[0-9]+/', 'amv-reader-pages-ID', $html ); }
$baseline_file = getenv( 'MANGAFOCUS_BASELINE_RENDERER' );
mode_expect( $baseline_file && is_file( $baseline_file ), 'Supply the trusted 0.3.0 renderer path for the regression oracle.' );
$baseline = file_get_contents( $baseline_file );
preg_match_all( '/function\s+(ai_manga_viewer_[a-z_]+)\s*\(/', $baseline, $definitions );
foreach ( $definitions[1] as $name ) { $baseline = preg_replace( '/\b' . preg_quote( $name, '/' ) . '\b/', $name . '_030', $baseline ); }
eval( preg_replace( '/^<\?php\s*/', '', $baseline ) );
$mode_pages = array(
 array( 'id' => 0, 'url' => 'https://example.test/mode-1.svg', 'alt' => 'One', 'width' => 600, 'height' => 900, 'pageKey' => 'stable-page-1', 'focusAreas' => array( array( 'id' => 'panel-1', 'x' => 50, 'y' => 50, 'width' => 80, 'height' => 60, 'zoom' => 100, 'view' => 'auto' ) ), 'mobileFocusAreas' => array(), 'cta' => array( 'enabled' => true, 'ctaKey' => 'stable-cta', 'type' => 'text', 'label' => 'CTA', 'url' => 'https://example.test/cta' ) ),
 array( 'id' => 0, 'url' => 'https://example.test/mode-2.svg', 'alt' => 'Two', 'width' => 600, 'height' => 900, 'pageKey' => 'stable-page-2', 'focusAreas' => array(), 'mobileFocusAreas' => array() ),
);
$common = array( 'pages' => $mode_pages, 'viewerKey' => 'stable-viewer', 'instanceKey' => 'stable-instance', 'pageLayout' => 'single', 'binding' => 'rtl', 'enableAnimation' => false, 'enableZoom' => true, 'showPageNumbers' => true, 'inlineDisplayMode' => 'reader' );
$legacy_count = 0;
foreach ( array( 'reader', 'coverLauncher' ) as $display ) {
 foreach ( array( false, true ) as $full ) {
  foreach ( array( false, true ) as $panel ) {
   $a = array_merge( $common, array( 'inlineDisplayMode' => $display, 'enableFullscreen' => $full, 'focusReader' => $panel ) );
   $copy = $a;
   mode_expect( mode_normalize( ai_manga_viewer_render_viewer( $a ) ) === mode_normalize( ai_manga_viewer_render_viewer_030( $a ) ), 'Legacy render changed: ' . $display . '/' . (int) $full . '/' . (int) $panel );
   mode_expect( $copy === $a, 'Renderer mutated legacy data' );
   mode_expect( ! array_key_exists( 'enableInline', ai_manga_viewer_sanitize_library_attributes( $a ) ), 'Legacy library data migrated' );
   $legacy_count++;
  }
 }
}
$fixtures = array();
foreach ( array( false, true ) as $inline ) {
 foreach ( array( false, true ) as $full ) {
  foreach ( array( false, true ) as $panel ) {
   if ( ! $inline && ! $full && ! $panel ) { continue; }
   $code = (int) $inline . (int) $full . (int) $panel;
   $a = array_merge( $common, array( 'enableInline' => $inline, 'enableFullscreen' => $full, 'focusReader' => $panel, 'instanceKey' => 'mode-' . $code, 'inlineDisplayMode' => 'coverLauncher' ) );
   $copy = $a; $html = ai_manga_viewer_render_viewer( $a );
   mode_expect( $copy === $a, 'Modern renderer mutated source data' );
   mode_expect( ( strpos( $html, 'class="amv-reader__cover-launcher"' ) !== false ) === ! $inline, 'Cover condition ' . $code );
   mode_expect( ( strpos( $html, 'class="amv-reader__cover-launcher-button"' ) !== false ) === ( ! $inline && $full ), 'Cover fullscreen condition ' . $code );
   mode_expect( ( strpos( $html, 'class="amv-reader__fullscreen"' ) !== false ) === $full, 'Fullscreen condition ' . $code );
   mode_expect( ( strpos( $html, 'class="amv-reader__focus-open"' ) !== false ) === $panel, 'Panel condition ' . $code );
   mode_expect( ( strpos( $html, 'class="amv-reader__cover-focus-open"' ) !== false ) === ( ! $inline && $panel ), 'Cover panel condition ' . $code );
   mode_expect( substr_count( $html, 'data-page-key=' ) === 2 && strpos( $html, 'stable-page-1' ) !== false && strpos( $html, 'stable-page-2' ) !== false, 'Logical pages lost' );
   $clean = ai_manga_viewer_sanitize_library_attributes( $a );
   mode_expect( isset( $clean['enableInline'] ) && $clean['enableInline'] === $inline, 'Boolean presence/false lost' );
   $legacy_clean = ai_manga_viewer_sanitize_library_attributes( array_diff_key( $a, array( 'enableInline' => true ) ) );
   mode_expect( array_diff_key( $clean, array( 'enableInline' => true ) ) === $legacy_clean, 'Existing settings/pages/CTA changed by marker' );
   $GLOBALS['test_parsed_blocks']['viewer-123'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => $a ) );
   $library = ai_manga_viewer_render_library_viewer( 123, 'mode-library-' . $code );
   $shortcode = ai_manga_viewer_library_shortcode( array( 'id' => '123' ) );
   foreach ( array( $library, $shortcode ) as $output ) {
    mode_expect( strpos( $output, 'data-enable-inline="' . ( $inline ? 'on' : 'off' ) . '"' ) !== false, 'Library/shortcode mode lost' );
    mode_expect( ( strpos( $output, 'class="amv-reader__fullscreen"' ) !== false ) === $full, 'Library/shortcode forced fullscreen' );
   }
   $fixtures[$code] = $a;
  }
 }
}
$bad = array_merge( $common, array( 'enableInline' => false, 'enableFullscreen' => false, 'focusReader' => false ) );
mode_expect( ai_manga_viewer_reading_modes( $bad, ai_manga_viewer_pages( $bad['pages'] ) )['inline'], 'All-OFF runtime must remain readable' );
$request = new WP_REST_Request( array( 'title' => 'Invalid modes', 'attributes' => $bad ) );
$invalid = ai_manga_viewer_register_direct_viewer( $request );
mode_expect( is_wp_error( $invalid ) && 'amv_reading_mode_required' === $invalid->code, 'Library accepted all-OFF' );
$missing = array_merge( $bad, array( 'focusReader' => true ) );
foreach ( $missing['pages'] as &$p ) { $p['focusAreas'] = array(); } unset( $p );
mode_expect( ai_manga_viewer_reading_modes( $missing, ai_manga_viewer_pages( $missing['pages'] ) )['inline'], 'No-panel runtime trap' );
$invalid = ai_manga_viewer_register_direct_viewer( new WP_REST_Request( array( 'title' => 'Missing panels', 'attributes' => $missing ) ) );
mode_expect( is_wp_error( $invalid ) && 'amv_panel_configuration_required' === $invalid->code, 'Library accepted unavailable panel-only mode' );
$wrong_type = array_merge( $common, array( 'enableInline' => 'false', 'inlineDisplayMode' => 'coverLauncher', 'enableFullscreen' => false ) );
mode_expect( ! array_key_exists( 'enableInline', ai_manga_viewer_sanitize_library_attributes( $wrong_type ) ), 'Wrong boolean type adopted' );
mode_expect( ai_manga_viewer_reading_modes( $wrong_type, $mode_pages )['fullscreen'], 'Malformed marker broke legacy cover' );
if ( in_array( '--fixture-modes', $argv, true ) ) {
 echo '<!doctype html><meta charset="utf-8"><body>';
 foreach ( $fixtures as $code => $a ) { echo '<section id="mode-' . $code . '">' . ai_manga_viewer_render_viewer( $a ) . '</section>'; }
 foreach ( array( 'single', 'spread', 'auto' ) as $layout_mode ) {
  foreach ( array( 'rtl', 'ltr' ) as $binding_mode ) {
   foreach ( array( 'paged', 'vertical' ) as $full_mode ) {
    $a = array_merge( $fixtures['010'], array( 'pageLayout' => $layout_mode, 'binding' => $binding_mode, 'fullscreenReadingMode' => $full_mode, 'instanceKey' => 'layout-' . $layout_mode . '-' . $binding_mode . '-' . $full_mode ) );
    echo '<section id="' . $a['instanceKey'] . '">' . ai_manga_viewer_render_viewer( $a ) . '</section>';
   }
  }
 }
 $mobile = $fixtures['001'];
 foreach ( $mobile['pages'] as &$p ) { $p['mobileFocusAreas'] = $p['focusAreas']; $p['focusAreas'] = array(); } unset( $p );
 $mobile['mobileFocusReader'] = true; $mobile['instanceKey'] = 'mobile-panels';
 echo '<section id="mobile-panels">' . ai_manga_viewer_render_viewer( $mobile ) . '</section>';
 $GLOBALS['test_parsed_blocks']['viewer-123'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => $fixtures['001'] ) );
 echo '<section id="analytics-library">' . ai_manga_viewer_render_library_viewer( 123, 'analytics-library' ) . '</section>';
 echo '<section id="missing-panels">' . ai_manga_viewer_render_viewer( $missing ) . '</section>';
 echo '</body>';
} else { echo "PASS: eight exact legacy renders, seven modes, unchanged data, library/shortcode and invalid-mode guards\n"; }
