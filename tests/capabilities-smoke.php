<?php
/** Isolated Capability API test; this is not a WordPress integration test. */
define( 'ABSPATH', __DIR__ );

$GLOBALS['amv_feature_map'] = array( 'panel_reader' => true, 'cta' => false, 'analytics' => false, 'ai_consultation' => false, 'manga_creation' => false );
$GLOBALS['amv_map_filters'] = array();
$GLOBALS['amv_has_filters'] = array();
function ai_manga_viewer_has_feature( $id ) { return is_string( $id ) && ! empty( $GLOBALS['amv_feature_map'][ $id ] ); }
function apply_filters( $hook, $value, ...$args ) {
	$filters = 'ai_manga_viewer_capability_map' === $hook ? $GLOBALS['amv_map_filters'] : ( 'ai_manga_viewer_has_capability' === $hook ? $GLOBALS['amv_has_filters'] : array() );
	ksort( $filters );
	foreach ( $filters as $callbacks ) foreach ( $callbacks as $callback ) $value = $callback( $value, ...$args );
	return $value;
}
function wp_json_encode( $value ) { return json_encode( $value ); }
function amv_cap_expect( $condition, $message ) { if ( ! $condition ) throw new RuntimeException( $message ); }

require dirname( __DIR__ ) . '/includes/capabilities.php';

$expected = array(
	'panel_reader' => array( 'runtime' => true, 'editor' => true ),
	'cta' => array( 'runtime' => false, 'editor' => false ),
	'analytics' => array( 'collection' => false, 'report' => false ),
	'ai_consultation' => array( 'admin' => false ),
	'manga_creation' => array( 'admin' => false ),
);
amv_cap_expect( $expected === ai_manga_viewer_get_capability_registry(), 'Capability registry changed.' );
amv_cap_expect( $expected === ai_manga_viewer_get_capability_map(), 'Core defaults must expose only panel reader capabilities.' );
foreach ( array( array( '', 'runtime' ), array( 'cta', '' ), array( 'unknown', 'runtime' ), array( 'cta', 'unknown' ), array( null, 'runtime' ), array( 'cta', 1 ) ) as $invalid ) amv_cap_expect( false === ai_manga_viewer_has_capability( $invalid[0], $invalid[1] ), 'Invalid capability must fail closed.' );

$GLOBALS['amv_map_filters'][10][] = function( $map ) { foreach ( $map as $feature => $caps ) foreach ( $caps as $capability => $value ) $map[ $feature ][ $capability ] = true; return $map; };
amv_cap_expect( false === ai_manga_viewer_has_capability( 'cta', 'runtime' ), 'Capability cannot bypass an unavailable Feature.' );
$GLOBALS['amv_feature_map'] = array_fill_keys( array_keys( $expected ), true );
foreach ( ai_manga_viewer_get_capability_map() as $caps ) foreach ( $caps as $value ) amv_cap_expect( true === $value, 'Compatible Pro baseline must be able to enable registered capabilities.' );

$GLOBALS['amv_map_filters'][20][] = function( $map ) { $map['cta']['editor'] = false; $map['panel_reader']['editor'] = false; $map['analytics']['report'] = false; $map['ai_consultation']['admin'] = false; return $map; };
$map = ai_manga_viewer_get_capability_map();
amv_cap_expect( true === $map['cta']['runtime'] && false === $map['cta']['editor'], 'CTA runtime/editor independence failed.' );
amv_cap_expect( true === $map['panel_reader']['runtime'] && false === $map['panel_reader']['editor'], 'Panel runtime/editor independence failed.' );
amv_cap_expect( true === $map['analytics']['collection'] && false === $map['analytics']['report'], 'Analytics collection/report independence failed.' );
amv_cap_expect( false === $map['ai_consultation']['admin'], 'Consultation admin restriction failed.' );
$GLOBALS['amv_has_filters'][30][] = function( $allowed, $feature, $capability ) { return 'analytics' === $feature && 'collection' === $capability ? false : $allowed; };
amv_cap_expect( false === ai_manga_viewer_has_capability( 'analytics', 'collection' ), 'Final capability restriction filter failed.' );

$script = ai_manga_viewer_capability_bootstrap_script();
amv_cap_expect( 0 === strpos( $script, 'window.aiMangaViewerCapabilities=' ) && ';' === substr( $script, -1 ), 'Capability JS bootstrap shape is invalid.' );
echo "Capability API smoke test passed.\n";
