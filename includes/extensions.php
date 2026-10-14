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

if ( ! function_exists( 'ai_manga_viewer_extension_allowed_html' ) ) {
	/** Return the fixed HTML allowlist for extension rendering slots. */
	function ai_manga_viewer_extension_allowed_html() {
		return array(
			'a'      => array(
				'class'                     => true,
				'href'                      => true,
				'target'                    => true,
				'rel'                       => true,
				'style'                     => true,
				'data-cta-key'              => true,
				'data-amv-cta-instance'     => true,
				'data-amv-cta-page'         => true,
				'data-amv-page-interactive' => true,
				'data-amv-modal-overlay'    => true,
			),
			'button' => array(
				'class'         => true,
				'type'          => true,
				'aria-haspopup' => true,
				'aria-label'    => true,
			),
			'div'    => array(
				'class'      => true,
				'hidden'     => true,
				'role'       => true,
				'aria-modal' => true,
				'aria-label' => true,
			),
			'img'    => array(
				'class'    => true,
				'src'      => true,
				'alt'      => true,
				'loading'  => true,
				'decoding' => true,
			),
			'output' => array(
				'class'     => true,
				'aria-live' => true,
			),
			'p'      => array(
				'class' => true,
			),
			'span'   => array(
				'class'                        => true,
				'hidden'                       => true,
				'data-amv-panel-page'          => true,
				'data-amv-panel-areas'         => true,
				'data-amv-panel-mobile-areas'  => true,
			),
		);
	}
}

if ( ! function_exists( 'ai_manga_viewer_extension_safe_css_properties' ) ) {
	/** Permit only the CTA custom properties used by the documented extension contract. */
	function ai_manga_viewer_extension_safe_css_properties( $styles ) {
		return array_merge(
			array_values( array_diff( (array) $styles, array( '--*' ) ) ),
			array(
				'--amv-cta-x',
				'--amv-cta-y',
				'--amv-cta-width',
				'--amv-cta-font-size',
				'--amv-cta-text',
				'--amv-cta-background',
				'--amv-cta-border',
				'--amv-cta-radius',
			)
		);
	}
}

if ( ! function_exists( 'ai_manga_viewer_sanitize_extension_markup' ) ) {
	/** Sanitize extension markup at the Core boundary before it reaches a renderer. */
	function ai_manga_viewer_sanitize_extension_markup( $markup ) {
		if ( ! is_string( $markup ) ) {
			return '';
		}

		add_filter( 'safe_style_css', 'ai_manga_viewer_extension_safe_css_properties' );
		try {
			return wp_kses( $markup, ai_manga_viewer_extension_allowed_html() );
		} finally {
			remove_filter( 'safe_style_css', 'ai_manga_viewer_extension_safe_css_properties' );
		}
	}
}

if ( ! function_exists( 'ai_manga_viewer_extension_page_overlay' ) ) {
	/**
	 * Return sanitized extension markup inside one page canvas.
	 */
	function ai_manga_viewer_extension_page_overlay( $page, $page_index, $context ) {
		$markup = apply_filters( 'ai_manga_viewer_renderer_page_overlay', '', $page, $page_index, $context );
		return ai_manga_viewer_sanitize_extension_markup( $markup );
	}
}

if ( ! function_exists( 'ai_manga_viewer_extension_after_content' ) ) {
	/**
	 * Return sanitized auxiliary extension markup at the end of the Reader root.
	 */
	function ai_manga_viewer_extension_after_content( $context ) {
		$markup = apply_filters( 'ai_manga_viewer_renderer_after_content', '', $context );
		return ai_manga_viewer_sanitize_extension_markup( $markup );
	}
}
