<?php
/** Server-side rendering for AI Manga Viewer. */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function ai_manga_viewer_pages( $pages ) {
	$valid_pages = array();
	foreach ( (array) $pages as $page ) {
		if ( ! is_array( $page ) ) {
			continue;
		}
		$id  = isset( $page['id'] ) ? absint( $page['id'] ) : 0;
		$url = isset( $page['url'] ) ? esc_url_raw( $page['url'] ) : '';
		if ( ! $id && '' === $url ) {
			continue;
		}
		$focus_areas = array();
		foreach ( (array) ( $page['focusAreas'] ?? array() ) as $area ) {
			if ( ! is_array( $area ) ) {
				continue;
			}
			$focus_areas[] = array(
				'id'     => isset( $area['id'] ) ? sanitize_key( $area['id'] ) : '',
				'x'      => ai_manga_viewer_number( $area['x'] ?? 50, 0, 100, 50 ),
				'y'      => ai_manga_viewer_number( $area['y'] ?? 50, 0, 100, 50 ),
				'width'  => ai_manga_viewer_number( $area['width'] ?? 30, 5, 100, 30 ),
				'height' => ai_manga_viewer_number( $area['height'] ?? 30, 5, 100, 30 ),
				'zoom'   => ai_manga_viewer_number( $area['zoom'] ?? 100, 60, 110, 100 ),
				'view'   => in_array( $area['view'] ?? '', array( 'auto', 'focus', 'overview' ), true ) ? $area['view'] : 'auto',
			);
		}
		$mobile_focus_areas = array();
		foreach ( (array) ( $page['mobileFocusAreas'] ?? array() ) as $area ) {
			if ( ! is_array( $area ) ) {
				continue;
			}
			$mobile_focus_areas[] = array(
				'id'     => isset( $area['id'] ) ? sanitize_key( $area['id'] ) : '',
				'x'      => ai_manga_viewer_number( $area['x'] ?? 50, 0, 100, 50 ),
				'y'      => ai_manga_viewer_number( $area['y'] ?? 50, 0, 100, 50 ),
				'width'  => ai_manga_viewer_number( $area['width'] ?? 30, 5, 100, 30 ),
				'height' => ai_manga_viewer_number( $area['height'] ?? 30, 5, 100, 30 ),
				'zoom'   => ai_manga_viewer_number( $area['zoom'] ?? 100, 60, 110, 100 ),
				'view'   => in_array( $area['view'] ?? '', array( 'auto', 'focus', 'overview' ), true ) ? $area['view'] : 'auto',
			);
		}
		$valid_pages[] = array(
			'id'  => $id,
			'url' => $url,
			'alt' => isset( $page['alt'] ) ? sanitize_text_field( $page['alt'] ) : '',
			'focusAreas' => $focus_areas,
			'mobileFocusAreas' => $mobile_focus_areas,
		);
	}
	return $valid_pages;
}

function ai_manga_viewer_number( $value, $minimum, $maximum, $fallback ) {
	$value = is_numeric( $value ) ? (float) $value : $fallback;
	return max( $minimum, min( $maximum, $value ) );
}

function ai_manga_viewer_image( $page, $index ) {
	$image_attributes = array(
		'class'         => 'amv-reader__image',
		'alt'           => $page['alt'],
		'loading'       => 0 === $index ? 'eager' : 'lazy',
		'decoding'      => 'async',
		'fetchpriority' => 0 === $index ? 'high' : 'auto',
	);
	if ( $page['id'] ) {
		$image = wp_get_attachment_image( $page['id'], 'large', false, $image_attributes );
		if ( $image ) {
			return $image;
		}
	}
	return '<img class="amv-reader__image" src="' . esc_url( $page['url'] ) . '" alt="' . esc_attr( $page['alt'] ) . '" loading="' . ( 0 === $index ? 'eager' : 'lazy' ) . '" decoding="async"' . ( 0 === $index ? ' fetchpriority="high"' : '' ) . ' />';
}

function ai_manga_viewer_viewer_image_url( $page ) {
	if ( ! empty( $page['id'] ) ) {
		$full_url = wp_get_attachment_image_url( $page['id'], 'full' );
		if ( $full_url ) {
			return $full_url;
		}
	}
	return $page['url'];
}

function ai_manga_viewer_render_viewer( $attributes ) {
	$pages = ai_manga_viewer_pages( $attributes['pages'] ?? array() );
	if ( empty( $pages ) ) {
		return '';
	}
	$binding       = ( $attributes['binding'] ?? 'rtl' ) === 'ltr' ? 'ltr' : 'rtl';
	$show_numbers  = ! isset( $attributes['showPageNumbers'] ) || ! empty( $attributes['showPageNumbers'] );
	$edge_click    = ! isset( $attributes['enableEdgeClick'] ) || ! empty( $attributes['enableEdgeClick'] );
	$guide_arrow_all_pages = ! empty( $attributes['showGuideArrowOnAllPages'] );
	$animation     = ! isset( $attributes['enableAnimation'] ) || ! empty( $attributes['enableAnimation'] );
	$scroll_assist  = ! empty( $attributes['scrollAssist'] );
	$scroll_position = in_array( $attributes['scrollAssistPosition'] ?? '', array( 'auto', 'top', 'center' ), true ) ? $attributes['scrollAssistPosition'] : 'auto';
	$scroll_strength = in_array( $attributes['scrollAssistStrength'] ?? '', array( 'gentle', 'normal', 'strong' ), true ) ? $attributes['scrollAssistStrength'] : 'normal';
	$focus_reader   = ! empty( $attributes['focusReader'] );
	$mobile_focus_reader = ! empty( $attributes['mobileFocusReader'] );
	$max_width     = ai_manga_viewer_number( $attributes['maxWidth'] ?? 650, 320, 1600, 650 );
	$stage_id      = wp_unique_id( 'amv-reader-pages-' );
	$wrapper       = get_block_wrapper_attributes( array( 'class' => 'amv-reader is-first-page', 'style' => '--amv-reader-max-width:' . $max_width . 'px;' ) );
	$count         = count( $pages );
	$has_focus_areas = false;
	foreach ( $pages as $page ) {
		if ( ! empty( $page['focusAreas'] ) || ( $mobile_focus_reader && ! empty( $page['mobileFocusAreas'] ) ) ) {
			$has_focus_areas = true;
			break;
		}
	}

	$output = '<div ' . $wrapper . ' data-binding="' . esc_attr( $binding ) . '" data-edge-click="' . ( $edge_click ? 'on' : 'off' ) . '" data-guide-arrow="' . ( $guide_arrow_all_pages ? 'all' : 'first' ) . '" data-animation="' . ( $animation ? 'on' : 'off' ) . '" data-scroll-assist="' . ( $scroll_assist ? 'on' : 'off' ) . '" data-scroll-position="' . esc_attr( $scroll_position ) . '" data-scroll-strength="' . esc_attr( $scroll_strength ) . '" data-mobile-focus-reader="' . ( $mobile_focus_reader ? 'on' : 'off' ) . '">';
	$output .= '<div id="' . esc_attr( $stage_id ) . '" class="amv-reader__stage" tabindex="0" role="group" aria-roledescription="' . esc_attr__( 'ページビューアー', 'ai-manga-viewer' ) . '" aria-label="' . esc_attr__( 'ページを左右キーまたはスワイプで送れます', 'ai-manga-viewer' ) . '">';
	$output .= '<button type="button" class="amv-reader__edge amv-reader__edge--previous" aria-label="' . esc_attr__( '前のページ', 'ai-manga-viewer' ) . '"></button>';
	$output .= '<div class="amv-reader__pages">';
	foreach ( $pages as $index => $page ) {
		$focus_json = wp_json_encode( $page['focusAreas'] );
		$mobile_focus_json = wp_json_encode( $page['mobileFocusAreas'] );
		$output .= '<figure class="amv-reader__page' . ( 0 === $index ? ' is-active' : '' ) . '" data-page-index="' . esc_attr( (string) $index ) . '" data-focus-areas="' . esc_attr( $focus_json ) . '" data-mobile-focus-areas="' . esc_attr( $mobile_focus_json ) . '" data-viewer-src="' . esc_url( ai_manga_viewer_viewer_image_url( $page ) ) . '">' . ai_manga_viewer_image( $page, $index ) . '</figure>';
	}
	$output .= '</div>';
	$output .= '<button type="button" class="amv-reader__edge amv-reader__edge--next" aria-label="' . esc_attr__( '次のページ', 'ai-manga-viewer' ) . '"></button>';
	$output .= '</div>';
	$output .= '<div class="amv-reader__controls">';
	$output .= '<button type="button" class="amv-reader__button amv-reader__button--previous" aria-controls="' . esc_attr( $stage_id ) . '">' . esc_html__( '前のページ', 'ai-manga-viewer' ) . '</button>';
	if ( $show_numbers ) {
		$output .= '<output class="amv-reader__count" aria-live="polite">1 / ' . esc_html( (string) $count ) . '</output>';
	}
	$output .= '<button type="button" class="amv-reader__button amv-reader__button--next" aria-controls="' . esc_attr( $stage_id ) . '">' . esc_html__( '次のページ', 'ai-manga-viewer' ) . '</button>';
	$output .= '</div>';
	if ( $focus_reader && $has_focus_areas ) {
		$output .= '<button type="button" class="amv-reader__focus-open" aria-haspopup="dialog">' . esc_html__( '専用ビューアーで読む', 'ai-manga-viewer' ) . '</button>';
		$output .= '<div class="amv-modal" hidden role="dialog" aria-modal="true" aria-label="' . esc_attr__( 'コマ読みビューアー', 'ai-manga-viewer' ) . '">';
		$output .= '<div class="amv-modal__header"><button type="button" class="amv-modal__close">× <span>' . esc_html__( '全体表示に戻る', 'ai-manga-viewer' ) . '</span></button><output class="amv-modal__count" aria-live="polite"></output></div>';
		$output .= '<div class="amv-modal__stage"><button type="button" class="amv-modal__edge amv-modal__edge--previous" aria-label="' . esc_attr__( '前のコマ', 'ai-manga-viewer' ) . '"></button><img class="amv-modal__image" alt="" /><button type="button" class="amv-modal__edge amv-modal__edge--next" aria-label="' . esc_attr__( '次のコマ', 'ai-manga-viewer' ) . '"></button><p class="amv-modal__hint">' . esc_html__( '左右にスワイプしてコマを送れます', 'ai-manga-viewer' ) . '</p></div>';
		$output .= '<div class="amv-modal__controls"><button type="button" class="amv-modal__next">' . esc_html__( '次のコマ', 'ai-manga-viewer' ) . '</button><button type="button" class="amv-modal__overview">' . esc_html__( 'ページ全体', 'ai-manga-viewer' ) . '</button><button type="button" class="amv-modal__previous">' . esc_html__( '前のコマ', 'ai-manga-viewer' ) . '</button></div></div>';
	}
	return $output . '</div>';
}
