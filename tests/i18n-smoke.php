<?php
/** Verify English source strings and bundled Japanese catalogs. */

$root = dirname( __DIR__ );
$runtime_files = array(
	'mangafocus.php',
	'readme.txt',
	'includes/settings.php',
	'includes/analytics/settings.php',
	'includes/panel-reader/renderer.php',
	'blocks/viewer/render.php',
	'blocks/viewer/index.js',
	'blocks/viewer/view.js',
	'blocks/library-viewer/index.js',
	'assets/panel-reader/editor.js',
	'assets/panel-reader/frontend.js',
	'blocks/viewer/block.json',
	'blocks/library-viewer/block.json',
);

foreach ( $runtime_files as $relative ) {
	$source = file_get_contents( $root . '/' . $relative );
	if ( false === $source || preg_match( '/[ぁ-んァ-ヶ一-龯]/u', $source ) ) {
		throw new RuntimeException( 'Japanese source text remains in ' . $relative );
	}
}

$main = file_get_contents( $root . '/mangafocus.php' );
if ( false === strpos( $main, 'Domain Path: /languages' ) || false === strpos( $main, "load_plugin_textdomain( 'mangafocus'" ) || false === strpos( $main, "wp_set_script_translations( 'ai-manga-viewer-view', 'mangafocus', \$translations_path )" ) ) {
	throw new RuntimeException( 'Bundled translation loading is incomplete.' );
}

$po = file_get_contents( $root . '/languages/mangafocus-ja.po' );
if ( false === strpos( $po, 'msgid "Next page"' ) || false === strpos( $po, 'msgstr "次のページ"' ) || false === strpos( $po, 'msgid "Read by panel"' ) || false === strpos( $po, 'msgid_plural "%s pages"' ) || false === strpos( $po, 'msgstr[0] "%sページ"' ) ) {
	throw new RuntimeException( 'Japanese PO catalog is incomplete.' );
}

$mo = file_get_contents( $root . '/languages/mangafocus-ja.mo' );
if ( false === $mo || substr( $mo, 0, 4 ) !== pack( 'V', 0x950412de ) ) {
	throw new RuntimeException( 'Japanese MO catalog is invalid.' );
}

$json_files = glob( $root . '/languages/mangafocus-ja-*.json' );
if ( 5 !== count( $json_files ) ) {
	throw new RuntimeException( 'Expected five JavaScript translation catalogs.' );
}
foreach ( $json_files as $json_file ) {
	$data = json_decode( file_get_contents( $json_file ), true, 512, JSON_THROW_ON_ERROR );
	if ( 'messages' !== ( $data['domain'] ?? '' ) || 'ja' !== ( $data['locale_data']['messages']['']['lang'] ?? '' ) ) {
		throw new RuntimeException( 'Invalid JavaScript translation catalog: ' . basename( $json_file ) );
	}
}

echo "Internationalization smoke passed.\n";
