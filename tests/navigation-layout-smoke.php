<?php
/** Isolated markup fixtures; no WordPress instance, database or SDK is used. */
ob_start();
require getenv( 'MANGAFOCUS_RENDER_TEST_BOOTSTRAP' ) ?: __DIR__ . '/render-smoke.php';
ob_end_clean();
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
$config = json_decode( $argv[1] ?? '{}', true );
if ( ! is_array( $config ) ) { throw new Exception( 'Invalid fixture configuration' ); }
$pages = array();
for ( $i = 0; $i < 6; $i++ ) {
 $wide = ! empty( $config['landscape'] ) || 3 === $i;
 $pages[] = array( 'id' => $wide ? 901 : 0, 'url' => 'https://example.test/' . ( $wide ? 'wide' : 'portrait' ) . '-' . $i . '.svg', 'alt' => 'Fixture page', 'pageKey' => 'fixture-page-' . $i, 'focusAreas' => array( array( 'id' => 'panel-' . $i, 'x' => 50, 'y' => 50, 'width' => 60, 'height' => 60, 'zoom' => 100, 'view' => 'focus' ) ), 'cta' => array( 'enabled' => true, 'ctaKey' => 'cta-' . $i, 'type' => 'text', 'label' => 'CTA', 'url' => 'https://example.test/cta', 'freePosition' => true, 'x' => $config['ctaX'] ?? 12, 'y' => 50, 'width' => 20 ) );
}
$a = array( 'pages' => $pages, 'viewerKey' => 'fixture-viewer', 'enableInline' => true, 'enableFullscreen' => true, 'focusReader' => true, 'enableZoom' => ! empty( $config['zoom'] ), 'zoomControlsPosition' => $config['side'] ?? 'bottom', 'enableAnimation' => false, 'binding' => $config['binding'] ?? 'rtl', 'pageLayout' => $config['layout'] ?? 'single', 'maxWidth' => $config['maxWidth'] ?? 650, 'enableEdgeClick' => $config['edge'] ?? true, 'showGuideArrowOnAllPages' => $config['guide'] ?? true, 'showPageNumbers' => true );
if ( ! empty( $config['legacy'] ) ) { unset( $a['enableInline'] ); }
echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>';
foreach ( array( 'reader-a', 'reader-b' ) as $id ) {
 $a['instanceKey'] = $id;
 echo '<section id="' . $id . '" style="width:100%;max-width:' . absint( $config['column'] ?? 1100 ) . 'px;margin:0 auto 80px">' . ai_manga_viewer_render_viewer( $a ) . '</section>';
}
echo '</body>';