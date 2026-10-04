<?php
/**
 * Public extension contract for MangaFocus add-ons.
 *
 * Only the constant, getter and documented filters in this file are public.
 * Core implementation functions and DOM class names remain private details.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'AI_MANGA_VIEWER_EXTENSION_API_VERSION' ) ) {
	define( 'AI_MANGA_VIEWER_EXTENSION_API_VERSION', 1 );
}

if ( ! function_exists( 'ai_manga_viewer_get_extension_api_version' ) ) {
	/** Return the major Extension API version implemented by this Core. */
	function ai_manga_viewer_get_extension_api_version() {
		return AI_MANGA_VIEWER_EXTENSION_API_VERSION;
	}
}

if ( ! function_exists( 'ai_manga_viewer_extension_root_attributes' ) ) {
	/**
	 * Return escaped root attributes supplied by extensions.
	 *
	 * Extensions may only add namespaced data-amv-* attributes. Core owns the
	 * class, style, ID, accessibility and existing reader data attributes.
	 */
	function ai_manga_viewer_extension_root_attributes( $context ) {
		$attributes = apply_filters( 'ai_manga_viewer_renderer_root_attributes', array(), $context );
		if ( ! is_array( $attributes ) ) {
			return '';
		}

		$output = '';
		foreach ( $attributes as $name => $value ) {
			if ( ! is_string( $name ) || ! preg_match( '/^data-amv-[a-z0-9_-]+$/', $name ) || ! is_scalar( $value ) ) {
				continue;
			}
			$output .= ' ' . $name . '="' . esc_attr( (string) $value ) . '"';
		}
		return $output;
	}
}

if ( ! function_exists( 'ai_manga_viewer_extension_page_overlay' ) ) {
	/**
	 * Return extension markup inside one page canvas, after Core page content.
	 *
	 * Providers are responsible for sanitizing and escaping their own markup.
	 */
	function ai_manga_viewer_extension_page_overlay( $page, $page_index, $context ) {
		$markup = apply_filters( 'ai_manga_viewer_renderer_page_overlay', '', $page, $page_index, $context );
		return is_string( $markup ) ? $markup : '';
	}
}

if ( ! function_exists( 'ai_manga_viewer_extension_after_content' ) ) {
	/**
	 * Return auxiliary extension markup at the end of the Reader root.
	 *
	 * Providers are responsible for sanitizing and escaping their own markup.
	 */
	function ai_manga_viewer_extension_after_content( $context ) {
		$markup = apply_filters( 'ai_manga_viewer_renderer_after_content', '', $context );
		return is_string( $markup ) ? $markup : '';
	}
}
