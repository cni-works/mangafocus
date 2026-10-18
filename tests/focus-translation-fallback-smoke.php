<?php
/** Local gettext merge doubles using the real bundled MO; no WordPress or site writes. */
$root = dirname( __DIR__ );
$work = sys_get_temp_dir() . '/amv-focus-l10n-' . bin2hex( random_bytes( 5 ) );
mkdir( $work ); mkdir( $work . '/plugins' );
define( 'WP_LANG_DIR', $work );
$locale = 'ja'; $messages = array(); $calls = array();
function determine_locale() { global $locale; return $locale; }
function trailingslashit( $path ) { return rtrim( $path, '/\\' ) . '/'; }
function plugin_dir_path( $path ) { global $root; return $root . '/'; }
function read_test_mo( $path ) {
    $raw = file_get_contents( $path ); $header = unpack( 'V7', substr( $raw, 0, 28 ) );
    if ( 0x950412de !== $header[1] ) { throw new Exception( 'Unexpected MO format' ); }
    $result = array();
    for ( $i = 0; $i < $header[3]; $i++ ) {
        $a = unpack( 'V2', substr( $raw, $header[4] + $i * 8, 8 ) ); $b = unpack( 'V2', substr( $raw, $header[5] + $i * 8, 8 ) );
        $result[ substr( $raw, $a[2], $a[1] ) ] = substr( $raw, $b[2], $b[1] );
    }
    return $result;
}
function load_textdomain( $domain, $path ) {
    global $messages, $calls;
    $calls[] = $path;
    // Core load_textdomain merges only missing entries, keeping earlier translations.
    $incoming = 0 === strpos( $path, WP_LANG_DIR ) ? array( 'Next page' => '公式訳テスト' ) : read_test_mo( $path );
    $messages += $incoming; return true;
}
$main = file_get_contents( $root . '/mangafocus.php' );
$start = strpos( $main, 'function ai_manga_viewer_load_textdomain()' );
$end = strpos( $main, "add_action( 'init', 'ai_manga_viewer_load_textdomain'", $start );
eval( substr( $main, $start, $end - $start ) );
try {
    touch( $work . '/plugins/mangafocus-ja.mo' );
    ai_manga_viewer_load_textdomain();
    if ( 2 !== count( $calls ) || '公式訳テスト' !== $messages['Next page'] || 'フォーカスモードで読む' !== $messages['Read in Focus Mode'] || 'フォーカスモードを終了' !== $messages['Exit Focus Mode'] ) { throw new Exception( 'Official-plus-bundled merge failed' ); }
    unlink( $work . '/plugins/mangafocus-ja.mo' ); $messages = array(); $calls = array();
    ai_manga_viewer_load_textdomain();
    if ( 1 !== count( $calls ) || 'フォーカスモードで読む' !== $messages['Read in Focus Mode'] ) { throw new Exception( 'Bundled-only Japanese failed' ); }
    $locale = 'en_US'; $messages = array(); $calls = array(); ai_manga_viewer_load_textdomain();
    if ( count( $calls ) || $messages ) { throw new Exception( 'English received Japanese overrides' ); }
    echo "PASS: official pack retained, missing launch/exit strings filled by real bundled MO, bundled-only Japanese and unchanged English; local doubles.\n";
} finally { if ( file_exists( $work . '/plugins/mangafocus-ja.mo' ) ) { unlink( $work . '/plugins/mangafocus-ja.mo' ); } rmdir( $work . '/plugins' ); rmdir( $work ); }
