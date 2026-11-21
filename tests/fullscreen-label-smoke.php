<?php
/** Offline WordPress-service doubles with the real renderer and library sanitizer. */
ob_start();
require __DIR__ . '/render-current-fixture.php';
ob_end_clean();

function fullscreen_label_check( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
}
$base = array(
    'pages' => array( array( 'url' => 'https://example.test/page.svg', 'width' => 600, 'height' => 900 ) ),
    'enableInline' => true, 'enableFullscreen' => true,
);
$markup = '';
foreach ( array( true, false ) as $inline ) {
    $attributes = array_merge( $base, array( 'enableInline' => $inline ) );
    $class = $inline ? 'amv-reader__fullscreen' : 'amv-reader__cover-launcher-button';
    foreach ( array( null, '', '  ', array(), 'Read & enjoy', '0', '<b>Begin</b> "now"' ) as $value ) {
        if ( null !== $value ) { $attributes['fullscreenButtonLabel'] = $value; }
        $expected = is_string( $value ) ? trim( strip_tags( $value ) ) : '';
        if ( '' === $expected ) { $expected = $inline ? 'Read in fullscreen' : 'Read manga'; }
        $html = ai_manga_viewer_render_viewer( $attributes );
        preg_match( '~class="' . $class . '"[^>]*>(.*?)</button>~s', $html, $matches );
        fullscreen_label_check( ( $matches[1] ?? null ) === esc_html( $expected ), 'Launch label or escaping failed.' );
        $copy = ai_manga_viewer_sanitize_library_attributes( $attributes );
        if ( is_string( $value ) ) {
            fullscreen_label_check( $copy['fullscreenButtonLabel'] === trim( strip_tags( $value ) ), 'Library copy lost the custom label.' );
        } else {
            fullscreen_label_check( ! isset( $copy['fullscreenButtonLabel'] ), 'Invalid label was copied.' );
        }
    }
    $attributes['fullscreenButtonLabel'] = $inline ? 'Start fullscreen' : 'Open this comic';
    $markup .= ai_manga_viewer_render_viewer( $attributes );
}
$attributes = array_merge( $base, array( 'fullscreenButtonLabel' => 'Library custom label' ) );
$GLOBALS['test_parsed_blocks']['viewer-123'] = array( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => $attributes, 'innerBlocks' => array() ) );
$library = ai_manga_viewer_render_library_viewer( 123, 'label-regression' );
fullscreen_label_check( false !== strpos( $library, '>Library custom label</button>' ), 'Registered Viewer lost the label.' );
$metadata = json_decode( file_get_contents( dirname( __DIR__ ) . '/blocks/viewer/block.json' ), true );
fullscreen_label_check( array( 'type' => 'string', 'default' => '' ) === $metadata['attributes']['fullscreenButtonLabel'], 'Attribute schema changed.' );
if ( in_array( '--fixture', $argv, true ) ) {
    echo '<!doctype html><html><meta charset="utf-8"><body>' . $markup . '</body></html>';
} else {
    echo "PASS fullscreen labels: defaults, invalid values, HTML escaping, zero, library copy and Registered Viewer.\n";
}
