<?php
/** Isolated Feature API test; this is not a WordPress integration test. */
define( 'ABSPATH', __DIR__ );

$GLOBALS['test_feature_filter'] = null;

function apply_filters( $hook, $value, ...$args ) {
	if ( 'ai_manga_viewer_has_feature' === $hook && is_callable( $GLOBALS['test_feature_filter'] ) ) {
		return call_user_func( $GLOBALS['test_feature_filter'], $value, $args[0] ?? '' );
	}
	return $value;
}

function wp_json_encode( $value ) {
	return json_encode( $value );
}

require dirname( __DIR__ ) . '/includes/features.php';

function amv_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$expected_ids = array( 'panel_reader', 'cta', 'analytics', 'ai_consultation', 'manga_creation' );
$registry = ai_manga_viewer_get_feature_registry();
amv_expect( $expected_ids === array_keys( $registry ), 'Feature registry IDs or order changed.' );

foreach ( $expected_ids as $feature_id ) {
	$expected = 'panel_reader' === $feature_id;
	amv_expect( $expected === ai_manga_viewer_has_feature( $feature_id ), $feature_id . ' Core availability is incorrect.' );
	amv_expect( array( 'available' => $expected ) === $registry[ $feature_id ], $feature_id . ' registry entry is incorrect.' );
}

foreach ( array( 'unknown_feature', '', 'PANEL_READER', ' panel_reader ', null, false, 1, array(), new stdClass() ) as $invalid ) {
	amv_expect( false === ai_manga_viewer_has_feature( $invalid ), 'Unknown or invalid feature IDs must fail closed.' );
}

$map = ai_manga_viewer_get_feature_map();
amv_expect( $expected_ids === array_keys( $map ), 'Feature map must follow the PHP registry.' );
amv_expect( array( 'panel_reader' => true, 'cta' => false, 'analytics' => false, 'ai_consultation' => false, 'manga_creation' => false ) === $map, 'Core feature map must expose only the Free panel reader.' );

$prefix = 'window.aiMangaViewerFeatures=';
$script = ai_manga_viewer_feature_bootstrap_script();
amv_expect( 0 === strpos( $script, $prefix ) && ';' === substr( $script, -1 ), 'JavaScript bootstrap shape is invalid.' );
$decoded = json_decode( substr( $script, strlen( $prefix ), -1 ), true );
amv_expect( $map === $decoded, 'JavaScript feature map must match the PHP feature map.' );

$GLOBALS['test_feature_filter'] = function( $available, $feature_id ) {
	return in_array( $feature_id, array( 'panel_reader', 'cta' ), true ) ? true : $available;
};
amv_expect( true === ai_manga_viewer_has_feature( 'panel_reader' ), 'Core panel_reader must remain available.' );
amv_expect( true === ai_manga_viewer_has_feature( 'cta' ), 'Pro filter must be able to expose a registered feature.' );
amv_expect( false === ai_manga_viewer_has_feature( 'analytics' ), 'Core Analytics must remain unavailable without Pro.' );
amv_expect( true === ai_manga_viewer_get_feature_map()['cta'], 'Filtered availability must reach the JavaScript map source.' );

echo "Feature API smoke test passed.\n";
