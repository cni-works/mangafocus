<?php
/**
 * Shared feature availability API.
 *
 * Core owns the allowlist and its own defaults. Add-ons expose Pro features
 * through the filter below; later license checks must use the same boundary.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'ai_manga_viewer_get_feature_registry' ) ) {
	/** Return the allowlisted feature registry. */
	function ai_manga_viewer_get_feature_registry() {
		return array(
			'panel_reader'   => array( 'available' => true ),
			'cta'            => array( 'available' => false ),
			'analytics'       => array( 'available' => false ),
			'ai_consultation' => array( 'available' => false ),
			'manga_creation'  => array( 'available' => false ),
		);
	}
}

if ( ! function_exists( 'ai_manga_viewer_has_feature' ) ) {
	/**
	 * Determine whether one registered feature is currently available.
	 *
	 * Unknown IDs and non-string values fail closed. Callers must use an exact
	 * registry ID rather than relying on normalization.
	 */
	function ai_manga_viewer_has_feature( $feature_id ) {
		if ( ! is_string( $feature_id ) || '' === $feature_id ) {
			return false;
		}

		$registry = ai_manga_viewer_get_feature_registry();
		if ( ! array_key_exists( $feature_id, $registry ) ) {
			return false;
		}

		$available = ! empty( $registry[ $feature_id ]['available'] );
		return (bool) apply_filters( 'ai_manga_viewer_has_feature', $available, $feature_id );
	}
}

if ( ! function_exists( 'ai_manga_viewer_get_feature_map' ) ) {
	/** Build the public boolean map from the PHP registry and availability API. */
	function ai_manga_viewer_get_feature_map() {
		$features = array();
		foreach ( array_keys( ai_manga_viewer_get_feature_registry() ) as $feature_id ) {
			$features[ $feature_id ] = ai_manga_viewer_has_feature( $feature_id );
		}
		return $features;
	}
}

if ( ! function_exists( 'ai_manga_viewer_feature_bootstrap_script' ) ) {
	/** Return the small PHP-authored feature map used by editor and frontend JS. */
	function ai_manga_viewer_feature_bootstrap_script() {
		return 'window.aiMangaViewerFeatures=' . wp_json_encode( ai_manga_viewer_get_feature_map() ) . ';';
	}
}
