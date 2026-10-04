<?php
/**
 * Shared operation-level capability API.
 *
 * Core owns the schema and fails closed. Compatible add-ons may provide a
 * baseline through the map filter; later policy layers may restrict it.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'ai_manga_viewer_get_capability_registry' ) ) {
	/** Return the fixed feature/capability allowlist with Core defaults. */
	function ai_manga_viewer_get_capability_registry() {
		return array(
			'panel_reader'   => array( 'runtime' => true, 'editor' => true ),
			'cta'            => array( 'runtime' => false, 'editor' => false ),
			'analytics'      => array( 'collection' => false, 'report' => false ),
			'ai_consultation' => array( 'admin' => false ),
			'manga_creation'  => array( 'admin' => false ),
		);
	}
}

if ( ! function_exists( 'ai_manga_viewer_get_capability_baseline' ) ) {
	/** Apply providers and normalize the result back to the registered schema. */
	function ai_manga_viewer_get_capability_baseline() {
		$registry = ai_manga_viewer_get_capability_registry();
		$filtered = apply_filters( 'ai_manga_viewer_capability_map', $registry );
		$filtered = is_array( $filtered ) ? $filtered : array();
		$map      = array();
		foreach ( $registry as $feature_id => $capabilities ) {
			$map[ $feature_id ] = array();
			foreach ( $capabilities as $capability_id => $default ) {
				$map[ $feature_id ][ $capability_id ] = isset( $filtered[ $feature_id ] ) && is_array( $filtered[ $feature_id ] ) && true === ( $filtered[ $feature_id ][ $capability_id ] ?? false );
			}
		}
		return $map;
	}
}

if ( ! function_exists( 'ai_manga_viewer_has_capability' ) ) {
	/** Return whether one registered operation is currently allowed. */
	function ai_manga_viewer_has_capability( $feature_id, $capability_id ) {
		if ( ! is_string( $feature_id ) || '' === $feature_id || ! is_string( $capability_id ) || '' === $capability_id ) {
			return false;
		}
		$registry = ai_manga_viewer_get_capability_registry();
		if ( ! isset( $registry[ $feature_id ] ) || ! array_key_exists( $capability_id, $registry[ $feature_id ] ) ) {
			return false;
		}
		if ( ! function_exists( 'ai_manga_viewer_has_feature' ) || ! ai_manga_viewer_has_feature( $feature_id ) ) {
			return false;
		}
		$map     = ai_manga_viewer_get_capability_baseline();
		$allowed = true === $map[ $feature_id ][ $capability_id ];
		return (bool) apply_filters( 'ai_manga_viewer_has_capability', $allowed, $feature_id, $capability_id );
	}
}

if ( ! function_exists( 'ai_manga_viewer_get_capability_map' ) ) {
	/** Build the final public map through the feature and per-operation guards. */
	function ai_manga_viewer_get_capability_map() {
		$map = array();
		foreach ( ai_manga_viewer_get_capability_registry() as $feature_id => $capabilities ) {
			$map[ $feature_id ] = array();
			foreach ( array_keys( $capabilities ) as $capability_id ) {
				$map[ $feature_id ][ $capability_id ] = ai_manga_viewer_has_capability( $feature_id, $capability_id );
			}
		}
		return $map;
	}
}

if ( ! function_exists( 'ai_manga_viewer_capability_bootstrap_script' ) ) {
	/** Return the PHP-authored capability map used by editor and frontend JS. */
	function ai_manga_viewer_capability_bootstrap_script() {
		return 'window.aiMangaViewerCapabilities=' . wp_json_encode( ai_manga_viewer_get_capability_map() ) . ';';
	}
}
