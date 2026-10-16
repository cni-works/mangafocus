<?php
/** Local rendering fixture only; no WordPress boot, SDK or database. */
ob_start();
require getenv( 'MANGAFOCUS_RENDER_TEST_BOOTSTRAP' ) ?: __DIR__ . '/render-smoke.php';
ob_end_clean();
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
$config = json_decode( $argv[1] ?? '{}', true );
if ( ! is_array( $config ) ) { throw new Exception( 'Invalid fixture options' ); }
$pages = array();
for ( $i = 0; $i < 4; $i++ ) {
 $pages[] = array( 'id' => 0, 'url' => 'https://example.test/start-' . $i . '.svg', 'pageKey' => 'start-page-' . $i, 'alt' => 'Local fixture page' );
}
$a = array( 'pages' => $pages, 'viewerKey' => 'start-viewer', 'enableInline' => true, 'enableFullscreen' => true, 'fullscreenStartAtCurrent' => true, 'fullscreenReadingMode' => 'vertical', 'enableZoom' => ! empty( $config['zoom'] ), 'pageLayout' => 'single', 'maxWidth' => 650, 'enableAnimation' => false );
if ( ! empty( $config['legacy'] ) ) { unset( $a['enableInline'] ); }
echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>';
foreach ( array( 'start-reader', 'other-reader' ) as $id ) {
 $a['instanceKey'] = $id;
 $markup = ai_manga_viewer_render_viewer( $a );
 if ( ! empty( $config['known'] ) ) { $markup = str_replace( '<img ', '<img width="600" height="900" ', $markup ); }
 echo '<section id="' . $id . '">' . $markup . '</section>';
}
echo '</body>';
