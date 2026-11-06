<?php
/** Current Core fixtures only. Does NOT claim the external legacy-CNI parity test. */
$fixture_source = file_get_contents( __DIR__ . '/render-smoke.php' );
$legacy_boundary = "require dirname( __DIR__, 2 ) . '/cni_blocks/blocks/page-flip/render.php';";
if ( 1 !== substr_count( $fixture_source, $legacy_boundary ) ) { throw new RuntimeException( 'Fixture boundary changed; review before running.' ); }
// Run every current-Core assertion before the separate legacy comparison unchanged.
eval( '?>' . strstr( $fixture_source, $legacy_boundary, true ) );
if ( realpath( $argv[0] ?? '' ) === __FILE__ ) {
    if ( in_array( '--spread-fixture', $argv, true ) ) {
        echo '<!doctype html><html><meta charset="utf-8"><body><section id="spread-fixture">' . $spread_fixture . '</section><section id="page-focus-fixture">' . $page_focus_fixture . '</section><section id="page-focus-auto-fixture">' . $page_focus_auto_fixture . '</section><section id="auto-fixture">' . $auto_fixture . '</section><section id="vertical-fixture">' . $vertical_fixture . '</section><section id="vertical-current-fixture">' . $vertical_current_fixture . '</section><section id="wide-fixture">' . $wide_fixture . '</section><section id="cover-fixture">' . $cover_fixture . '</section><section id="cover-vertical-fixture">' . $cover_vertical_fixture . '</section>' . $count_fixture_html . '</body></html>';
    } else {
        echo "PASS current Core rendering/library/shortcode assertions. Legacy-CNI parity not executed.\n";
    }
}
