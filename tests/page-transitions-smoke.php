<?php
/** Local WordPress doubles only; no site or database connection. */
ob_start(); require __DIR__ . '/render-smoke.php'; ob_end_clean();
$GLOBALS['test_block_class'] = 'wp-block-ai-manga-viewer-viewer';
function pt_assert( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
$pt_pages = array();
for ( $i = 0; $i < 6; $i++ ) {
	$pt_pages[] = array( 'id' => 0, 'url' => 'https://example.test/animation-' . $i . '.svg', 'alt' => 'Page ' . $i, 'width' => 600, 'height' => 900, 'pageKey' => 'animation-page-' . $i, 'focusAreas' => array(), 'mobileFocusAreas' => array() );
}
$pt_base = array( 'pages' => $pt_pages, 'viewerKey' => 'animation-viewer', 'enableInline' => true, 'enableFullscreen' => true, 'fullscreenStartAtCurrent' => true, 'focusReader' => true, 'enableZoom' => true, 'enableEdgeClick' => true, 'singleFirstPage' => true );
$pt_pages[0]['focusAreas'] = array( array( 'id' => 'first-panel', 'x' => 50, 'y' => 50, 'width' => 80, 'height' => 70, 'zoom' => 100, 'view' => 'auto' ) );
$pt_base['pages'] = $pt_pages;
$pt_count = 0;
foreach ( array( true, false ) as $enabled ) {
	$a = array_merge( $pt_base, array( 'enableAnimation' => $enabled ) );
	$legacy = ai_manga_viewer_sanitize_library_attributes( $a );
	pt_assert( ! array_key_exists( 'pageTransition', $legacy ), 'Legacy sanitize must not add a new setting' );
	foreach ( array( 'none', 'turn', 'fade', 'slide' ) as $effect ) {
		$a['pageTransition'] = $effect;
		$clean = ai_manga_viewer_sanitize_library_attributes( $a );
		pt_assert( $effect === $clean['pageTransition'] && $enabled === $clean['enableAnimation'], 'New effect lost or changed legacy flag' );
		unset( $clean['pageTransition'] ); pt_assert( $legacy === $clean, 'Unrelated stored attributes changed' );
		$html = ai_manga_viewer_render_viewer( $a );
		pt_assert( false !== strpos( $html, 'data-page-transition="' . $effect . '"' ), 'Effect missing from render' ); $pt_count++;
	}
	foreach ( array( 'unknown', 'SLIDE', '<script>', array( 'slide' ), 1, null ) as $invalid ) {
		$a['pageTransition'] = $invalid;
		pt_assert( ! array_key_exists( 'pageTransition', ai_manga_viewer_sanitize_library_attributes( $a ) ), 'Invalid effect persisted' );
		pt_assert( false === strpos( ai_manga_viewer_render_viewer( $a ), 'data-page-transition=' ), 'Invalid effect rendered' ); $pt_count++;
	}
}
if ( in_array( '--fixture', $argv, true ) ) {
	foreach ( array( 'single', 'spread', 'auto' ) as $layout ) foreach ( array( 'rtl', 'ltr' ) as $binding ) foreach ( array( 'none', 'turn', 'fade', 'slide', 'legacy-on', 'legacy-off', 'missing' ) as $effect ) {
		$id = $layout . '-' . $binding . '-' . $effect;
		$a = array_merge( $pt_base, array( 'instanceKey' => $id, 'pageLayout' => $layout, 'binding' => $binding ) );
		if ( in_array( $effect, array( 'none', 'turn', 'fade', 'slide' ), true ) ) { $a['pageTransition'] = $effect; $a['enableAnimation'] = false; }
		elseif ( 'missing' !== $effect ) { $a['enableAnimation'] = 'legacy-on' === $effect; }
		echo '<section id="pt-' . $id . '">' . ai_manga_viewer_render_viewer( $a ) . '</section>';
	}
	foreach ( array( 'vertical', 'pageFocus' ) as $special ) {
		$a = array_merge( $pt_base, array( 'instanceKey' => $special, 'pageLayout' => 'spread', 'binding' => 'rtl', 'pageTransition' => 'slide', 'fullscreenReadingMode' => 'vertical' === $special ? 'vertical' : 'paged', 'spreadReadingMode' => 'pageFocus' === $special ? 'pageFocus' : 'overview' ) );
		echo '<section id="pt-' . $special . '">' . ai_manga_viewer_render_viewer( $a ) . '</section>';
	}
} else { echo "PASS: $pt_count transition render/sanitize/legacy cases; local doubles, no real WordPress/DB.\n"; }
