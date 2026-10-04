<?php
/** Core-owned panel reader renderer attached through Core Extension API Version 1. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Return whether the preserved Viewer settings contain an enabled panel reader. */
function ai_manga_viewer_panel_reader_context_enabled( $context ) {
	if ( ! ai_manga_viewer_has_capability( 'panel_reader', 'runtime' ) || empty( $context['settings']['focus_reader'] ) ) { return false; }
	$mobile_enabled = ! empty( $context['settings']['mobile_focus_reader'] );
	foreach ( (array) ( $context['pages'] ?? array() ) as $page ) {
		if ( ! empty( $page['focusAreas'] ) || ( $mobile_enabled && ! empty( $page['mobileFocusAreas'] ) ) ) { return true; }
	}
	return false;
}

/** Add only namespaced runtime state to the Core Viewer root. */
function ai_manga_viewer_panel_reader_root_attributes( $attributes, $context ) {
	$attributes = is_array( $attributes ) ? $attributes : array();
	if ( ! ai_manga_viewer_panel_reader_context_enabled( $context ) ) { return $attributes; }
	$attributes['data-amv-panel-reader'] = 'on';
	$attributes['data-amv-panel-start'] = ! empty( $context['settings']['focus_reader_start_at_current'] ) ? 'current' : 'first';
	$attributes['data-amv-panel-mobile'] = ! empty( $context['settings']['mobile_focus_reader'] ) ? 'on' : 'off';
	return $attributes;
}
add_filter( 'ai_manga_viewer_renderer_root_attributes', 'ai_manga_viewer_panel_reader_root_attributes', 20, 2 );

/** Attach the preserved PC/mobile areas to their logical page without changing Core markup. */
function ai_manga_viewer_panel_reader_page_data( $markup, $page, $page_index, $context ) {
	$markup = is_string( $markup ) ? $markup : '';
	if ( ! ai_manga_viewer_panel_reader_context_enabled( $context ) ) { return $markup; }
	$areas = wp_json_encode( array_values( (array) ( $page['focusAreas'] ?? array() ) ) );
	$mobile = wp_json_encode( array_values( (array) ( $page['mobileFocusAreas'] ?? array() ) ) );
	return $markup . '<span hidden data-amv-panel-page="' . esc_attr( (string) absint( $page_index ) ) . '" data-amv-panel-areas="' . esc_attr( $areas ) . '" data-amv-panel-mobile-areas="' . esc_attr( $mobile ) . '"></span>';
}
add_filter( 'ai_manga_viewer_renderer_page_overlay', 'ai_manga_viewer_panel_reader_page_data', 20, 4 );

/** Add the launch controls and modal after Core Viewer content. */
function ai_manga_viewer_panel_reader_markup( $markup, $context ) {
	$markup = is_string( $markup ) ? $markup : '';
	if ( ! ai_manga_viewer_panel_reader_context_enabled( $context ) ) { return $markup; }
	$is_cover = 'coverLauncher' === ( $context['settings']['inline_display_mode'] ?? '' );
	$output = '<div class="amv-panel-reader-controls"><button type="button" class="amv-reader__focus-open" aria-haspopup="dialog">' . esc_html__( 'Read by panel', 'mangafocus' ) . '</button>';
	if ( $is_cover ) { $output .= '<button type="button" class="amv-reader__cover-focus-open" aria-haspopup="dialog">' . esc_html__( 'Read by panel', 'mangafocus' ) . '</button>'; }
	$output .= '</div>';
	$output .= '<div class="amv-modal" hidden role="dialog" aria-modal="true" aria-label="' . esc_attr__( 'Panel-by-Panel viewer', 'mangafocus' ) . '">';
	$output .= '<div class="amv-modal__header"><button type="button" class="amv-modal__close">× <span>' . esc_html__( 'Return to full view', 'mangafocus' ) . '</span></button><output class="amv-modal__count" aria-live="polite"></output></div>';
	$output .= '<div class="amv-modal__stage"><button type="button" class="amv-modal__edge amv-modal__edge--previous" aria-label="' . esc_attr__( 'Previous panel', 'mangafocus' ) . '"></button><img class="amv-modal__image" alt="" /><div class="amv-modal__extension-layer" hidden></div><button type="button" class="amv-modal__edge amv-modal__edge--next" aria-label="' . esc_attr__( 'Next panel', 'mangafocus' ) . '"></button><p class="amv-modal__hint">' . esc_html__( 'Swipe left or right to navigate panels', 'mangafocus' ) . '</p></div>';
	$output .= '<div class="amv-modal__controls"><button type="button" class="amv-modal__next">' . esc_html__( 'Next panel', 'mangafocus' ) . '</button><button type="button" class="amv-modal__overview">' . esc_html__( 'Full page', 'mangafocus' ) . '</button><button type="button" class="amv-modal__previous">' . esc_html__( 'Previous panel', 'mangafocus' ) . '</button></div></div>';
	wp_enqueue_script( 'ai-manga-viewer-panel-reader-frontend' );
	wp_enqueue_style( 'ai-manga-viewer-panel-reader' );
	return $markup . $output;
}
add_filter( 'ai_manga_viewer_renderer_after_content', 'ai_manga_viewer_panel_reader_markup', 20, 2 );
