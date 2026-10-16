<?php
/** Isolated renderer fixtures. No WordPress instance or database is used. */
$bootstrap = getenv( 'MANGAFOCUS_RENDER_TEST_BOOTSTRAP' ) ?: __DIR__ . '/render-smoke.php';
ob_start();
require $bootstrap;
ob_end_clean();
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
$pages = array();
for ( $i = 0; $i < 3; $i++ ) {
 $pages[] = array( 'id' => 0, 'url' => 'https://example.test/vertical-' . $i . '.svg', 'alt' => 'Fixture page', 'pageKey' => 'fixture-page-' . $i, 'focusAreas' => array( array( 'id' => 'fixture-panel-' . $i, 'x' => 50, 'y' => 50, 'width' => 60, 'height' => 60, 'zoom' => 100, 'view' => 'focus' ) ), 'cta' => array( 'enabled' => true, 'ctaKey' => 'fixture-cta-' . $i, 'label' => 'Fixture CTA', 'url' => 'https://example.test/cta' ) );
}
$common = array( 'pages' => $pages, 'viewerKey' => 'fixture-viewer', 'pageLayout' => 'single', 'binding' => 'rtl', 'maxWidth' => 650, 'enableAnimation' => false, 'enableFullscreen' => true, 'fullscreenStartAtCurrent' => true, 'showPageNumbers' => true );
function vertical_fixture( $id, $attributes, $remove = '' ) {
 $attributes['instanceKey'] = $id;
 echo '<section id="' . esc_attr( $id ) . '" data-remove="' . esc_attr( $remove ) . '">' . ai_manga_viewer_render_viewer( $attributes ) . '</section>';
}
echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>';
foreach ( array( 'vertical', 'paged' ) as $mode ) {
 foreach ( array( false, true ) as $zoom ) {
  foreach ( array( '010', '110', '011', '111' ) as $code ) {
   vertical_fixture( 'modern-' . $mode . '-' . ( $zoom ? 'on' : 'off' ) . '-' . $code, array_merge( $common, array( 'enableInline' => '1' === $code[0], 'focusReader' => '1' === $code[2], 'fullscreenReadingMode' => $mode, 'enableZoom' => $zoom ) ) );
  }
  foreach ( array( 'reader', 'coverLauncher' ) as $display ) {
   vertical_fixture( 'legacy-' . $mode . '-' . ( $zoom ? 'on' : 'off' ) . '-' . $display, array_merge( $common, array( 'inlineDisplayMode' => $display, 'fullscreenReadingMode' => $mode, 'enableZoom' => $zoom ) ) );
  }
 }
 foreach ( array( 'level', 'out', 'in', 'reset', 'controls', 'all' ) as $remove ) {
  vertical_fixture( 'optional-' . $mode . '-' . $remove, array_merge( $common, array( 'enableInline' => true, 'fullscreenReadingMode' => $mode, 'enableZoom' => true ) ), $remove );
 }
}
echo '</body>';