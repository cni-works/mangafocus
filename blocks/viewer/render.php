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
		// Compatibility schema only: Pro owns CTA editing and rendering, while Core preserves saved values.
		$cta_source = isset( $page['cta'] ) && is_array( $page['cta'] ) ? $page['cta'] : array();
		$position = in_array( $cta_source['position'] ?? '', array( 'left', 'center', 'right' ), true ) ? $cta_source['position'] : 'center';
		$cta = array(
			'enabled'  => ! empty( $cta_source['enabled'] ),
			'ctaKey'   => isset( $cta_source['ctaKey'] ) ? sanitize_key( $cta_source['ctaKey'] ) : '',
			'type'     => ( $cta_source['type'] ?? '' ) === 'image' ? 'image' : 'text',
			'label'    => isset( $cta_source['label'] ) ? sanitize_text_field( $cta_source['label'] ) : '',
			'url'      => isset( $cta_source['url'] ) ? esc_url_raw( $cta_source['url'] ) : '',
			'imageId'  => isset( $cta_source['imageId'] ) ? absint( $cta_source['imageId'] ) : 0,
			'imageUrl' => isset( $cta_source['imageUrl'] ) ? esc_url_raw( $cta_source['imageUrl'] ) : '',
			'imageAlt' => isset( $cta_source['imageAlt'] ) ? sanitize_text_field( $cta_source['imageAlt'] ) : '',
			'position' => $position,
			'newTab'   => ! empty( $cta_source['newTab'] ),
			'freePosition'   => ! empty( $cta_source['freePosition'] ),
			'x'              => ai_manga_viewer_number( $cta_source['x'] ?? ( 'left' === $position ? 18 : ( 'right' === $position ? 82 : 50 ) ), 0, 100, 50 ),
			'y'              => ai_manga_viewer_number( $cta_source['y'] ?? 86, 0, 100, 86 ),
			'width'          => ai_manga_viewer_number( $cta_source['width'] ?? 32, 10, 80, 32 ),
			'fontSize'       => ai_manga_viewer_number( $cta_source['fontSize'] ?? 16, 10, 48, 16 ),
			'textColor'      => sanitize_hex_color( $cta_source['textColor'] ?? '' ) ?: '#ffffff',
			'backgroundColor'=> sanitize_hex_color( $cta_source['backgroundColor'] ?? '' ) ?: '#1f2937',
			'borderColor'    => sanitize_hex_color( $cta_source['borderColor'] ?? '' ) ?: '#ffffff',
			'borderRadius'   => ai_manga_viewer_number( $cta_source['borderRadius'] ?? 24, 0, 50, 24 ),
			'attentionEffect'=> ( $cta_source['attentionEffect'] ?? '' ) === 'glow' ? 'glow' : 'none',
			'hoverEffect'    => in_array( $cta_source['hoverEffect'] ?? '', array( 'lift', 'darken' ), true ) ? $cta_source['hoverEffect'] : 'none',
		);
		$valid_pages[] = array(
			'id'  => $id,
			'url' => $url,
			'pageKey' => isset( $page['pageKey'] ) ? sanitize_key( $page['pageKey'] ) : '',
			'alt' => isset( $page['alt'] ) ? sanitize_text_field( $page['alt'] ) : '',
			'focusAreas' => $focus_areas,
			'mobileFocusAreas' => $mobile_focus_areas,
			'cta' => $cta,
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

/** Return intrinsic dimensions when WordPress has attachment metadata. */
function ai_manga_viewer_page_dimensions( $page ) {
	if ( empty( $page['id'] ) || ! function_exists( 'wp_get_attachment_metadata' ) ) {
		return array( 0, 0 );
	}
	$metadata = wp_get_attachment_metadata( $page['id'] );
	if ( ! is_array( $metadata ) ) {
		return array( 0, 0 );
	}
	return array( absint( $metadata['width'] ?? 0 ), absint( $metadata['height'] ?? 0 ) );
}

function ai_manga_viewer_zoom_controls( $modifier = '' ) {
	$class = 'amv-reader__zoom-controls' . ( $modifier ? ' ' . $modifier : '' );
	return '<div class="' . esc_attr( $class ) . '" role="group" aria-label="' . esc_attr__( '画像の拡大と移動', 'ai-manga-viewer' ) . '"><button type="button" class="amv-reader__zoom-out" aria-label="' . esc_attr__( '縮小', 'ai-manga-viewer' ) . '">−</button><output class="amv-reader__zoom-level" aria-live="polite">100%</output><button type="button" class="amv-reader__zoom-in" aria-label="' . esc_attr__( '拡大', 'ai-manga-viewer' ) . '">＋</button><button type="button" class="amv-reader__zoom-reset">' . esc_html__( '全体', 'ai-manga-viewer' ) . '</button></div>';
}

function ai_manga_viewer_render_viewer( $attributes ) {
	$pages = ai_manga_viewer_pages( $attributes['pages'] ?? array() );
	if ( empty( $pages ) ) {
		return '';
	}
	$binding       = ( $attributes['binding'] ?? 'rtl' ) === 'ltr' ? 'ltr' : 'rtl';
	$page_layout   = in_array( $attributes['pageLayout'] ?? '', array( 'spread', 'auto' ), true ) ? $attributes['pageLayout'] : 'single';
	$single_first  = ! isset( $attributes['singleFirstPage'] ) || ! empty( $attributes['singleFirstPage'] );
	$spread_reading_mode = 'pageFocus' === ( $attributes['spreadReadingMode'] ?? '' ) ? 'pageFocus' : 'overview';
	$show_numbers  = ! isset( $attributes['showPageNumbers'] ) || ! empty( $attributes['showPageNumbers'] );
	$edge_click    = ! isset( $attributes['enableEdgeClick'] ) || ! empty( $attributes['enableEdgeClick'] );
	$guide_arrow_all_pages = ! empty( $attributes['showGuideArrowOnAllPages'] );
	$animation     = ! isset( $attributes['enableAnimation'] ) || ! empty( $attributes['enableAnimation'] );
	$inline_display_mode = 'coverLauncher' === ( $attributes['inlineDisplayMode'] ?? '' ) ? 'coverLauncher' : 'reader';
	$cover_launcher = 'coverLauncher' === $inline_display_mode;
	$fullscreen    = $cover_launcher || ! empty( $attributes['enableFullscreen'] );
	$fullscreen_reading_mode = 'vertical' === ( $attributes['fullscreenReadingMode'] ?? '' ) ? 'vertical' : 'paged';
	$zoom          = ! empty( $attributes['enableZoom'] );
	$zoom_position = in_array( $attributes['zoomControlsPosition'] ?? '', array( 'bottom', 'right', 'left' ), true ) ? $attributes['zoomControlsPosition'] : 'bottom';
	$scroll_assist  = ! empty( $attributes['scrollAssist'] );
	$scroll_position = in_array( $attributes['scrollAssistPosition'] ?? '', array( 'auto', 'top', 'center' ), true ) ? $attributes['scrollAssistPosition'] : 'auto';
	$scroll_strength = in_array( $attributes['scrollAssistStrength'] ?? '', array( 'gentle', 'normal', 'strong' ), true ) ? $attributes['scrollAssistStrength'] : 'normal';
	$viewer_key    = isset( $attributes['viewerKey'] ) ? sanitize_key( $attributes['viewerKey'] ) : '';
	$instance_key  = isset( $attributes['instanceKey'] ) ? sanitize_key( $attributes['instanceKey'] ) : '';
	if ( '' === $viewer_key || '' === $instance_key ) {
		static $legacy_viewer_counts = array();
		$post_id = absint( get_the_ID() );
		if ( $post_id ) {
			$legacy_viewer_counts[ $post_id ] = isset( $legacy_viewer_counts[ $post_id ] ) ? $legacy_viewer_counts[ $post_id ] + 1 : 1;
			$legacy_ordinal = $legacy_viewer_counts[ $post_id ];
			if ( '' === $viewer_key ) {
				$viewer_key = 'legacy-post-' . $post_id . '-viewer-' . $legacy_ordinal;
			}
			if ( '' === $instance_key ) {
				$instance_key = 'legacy-post-' . $post_id . '-placement-' . $legacy_ordinal;
			}
		}
	}
	if ( '' !== $viewer_key && '' !== $instance_key ) {
		foreach ( $pages as $page_index => &$page ) {
			if ( '' === $page['pageKey'] ) {
				$page['pageKey'] = substr( sanitize_key( $viewer_key . '-page-' . ( $page_index + 1 ) ), 0, 64 );
			}
			if ( ! empty( $page['cta']['enabled'] ) && '' === $page['cta']['ctaKey'] ) {
				$page['cta']['ctaKey'] = substr( sanitize_key( $viewer_key . '-cta-' . ( $page_index + 1 ) ), 0, 64 );
			}
		}
		unset( $page );
	}
	$max_width     = ai_manga_viewer_number( $attributes['maxWidth'] ?? 650, 320, 1600, 650 );
	$spread_gap    = 12;
	$spread_width  = $max_width * 2 + $spread_gap;
	$stage_id      = wp_unique_id( 'amv-reader-pages-' );
	$wrapper_class = 'amv-reader is-first-page' . ( $cover_launcher ? ' amv-reader--cover-launcher' : '' );
	$wrapper       = get_block_wrapper_attributes( array( 'class' => $wrapper_class, 'style' => '--amv-reader-max-width:' . $max_width . 'px;--amv-reader-spread-max-width:' . $spread_width . 'px;--amv-reader-spread-gap:' . $spread_gap . 'px;' ) );
	$count         = count( $pages );
	$extension_context = array(
		'api_version'  => ai_manga_viewer_get_extension_api_version(),
		'viewer_key'   => $viewer_key,
		'instance_key' => $instance_key,
		'page_count'   => $count,
		'pages'        => $pages,
		'settings'     => array(
			'binding'                => $binding,
			'page_layout'            => $page_layout,
			'spread_reading_mode'    => $spread_reading_mode,
			'fullscreen_reading_mode'=> $fullscreen_reading_mode,
			'fullscreen_start_at_current' => ! empty( $attributes['fullscreenStartAtCurrent'] ),
			'focus_reader'           => ! empty( $attributes['focusReader'] ),
			'focus_reader_start_at_current' => ! empty( $attributes['focusReaderStartAtCurrent'] ),
			'mobile_focus_reader'    => ! empty( $attributes['mobileFocusReader'] ),
			'inline_display_mode'    => $inline_display_mode,
		),
	);

	$output = '<div ' . $wrapper . ( '' !== $viewer_key ? ' data-viewer-key="' . esc_attr( $viewer_key ) . '"' : '' ) . ( '' !== $instance_key ? ' data-instance-key="' . esc_attr( $instance_key ) . '"' : '' ) . ' data-binding="' . esc_attr( $binding ) . '" data-page-layout="' . esc_attr( $page_layout ) . '" data-inline-display-mode="' . esc_attr( $inline_display_mode ) . '" data-single-first-page="' . ( $single_first ? 'on' : 'off' ) . '" data-spread-reading-mode="' . esc_attr( $spread_reading_mode ) . '" data-fullscreen-reading-mode="' . esc_attr( $fullscreen_reading_mode ) . '" data-fullscreen-start="' . ( ! empty( $attributes['fullscreenStartAtCurrent'] ) ? 'current' : 'first' ) . '" data-edge-click="' . ( $edge_click ? 'on' : 'off' ) . '" data-guide-arrow="' . ( $guide_arrow_all_pages ? 'all' : 'first' ) . '" data-animation="' . ( $animation ? 'on' : 'off' ) . '" data-zoom="' . ( $zoom ? 'on' : 'off' ) . '" data-zoom-position="' . esc_attr( $zoom_position ) . '" data-scroll-assist="' . ( $scroll_assist ? 'on' : 'off' ) . '" data-scroll-position="' . esc_attr( $scroll_position ) . '" data-scroll-strength="' . esc_attr( $scroll_strength ) . '"' . ai_manga_viewer_extension_root_attributes( $extension_context ) . '>';
	if ( $cover_launcher ) {
		$cover_url   = esc_url_raw( $attributes['_libraryCoverUrl'] ?? '' );
		$cover_url   = $cover_url ?: ai_manga_viewer_viewer_image_url( $pages[0] );
		$viewer_title = sanitize_text_field( $attributes['_viewerTitle'] ?? '' );
		$cover_alt   = '' !== $viewer_title ? $viewer_title : $pages[0]['alt'];
		$button_label = '' !== $viewer_title ? sprintf( __( '%sを全画面で読む', 'ai-manga-viewer' ), $viewer_title ) : __( '漫画を全画面で読む', 'ai-manga-viewer' );
		$output .= '<div class="amv-reader__cover-launcher">';
		if ( $cover_url ) {
			$output .= '<img class="amv-reader__cover-image" src="' . esc_url( $cover_url ) . '" alt="' . esc_attr( $cover_alt ) . '" loading="eager" decoding="async" fetchpriority="high" />';
		} else {
			$output .= '<div class="amv-reader__cover-placeholder">' . esc_html__( '表紙未設定', 'ai-manga-viewer' ) . '</div>';
		}
		$output .= '<div class="amv-reader__cover-actions"><button type="button" class="amv-reader__cover-launcher-button" aria-label="' . esc_attr( $button_label ) . '">' . esc_html__( '漫画を読む', 'ai-manga-viewer' ) . '</button>';
		$output .= '</div></div>';
	}
	$output .= '<div id="' . esc_attr( $stage_id ) . '" class="amv-reader__stage" tabindex="0" role="group" aria-roledescription="' . esc_attr__( 'ページビューアー', 'ai-manga-viewer' ) . '" aria-label="' . esc_attr__( 'ページを左右キーまたはスワイプで送れます', 'ai-manga-viewer' ) . '">';
	$output .= '<button type="button" class="amv-reader__edge amv-reader__edge--previous" aria-label="' . esc_attr__( '前のページ', 'ai-manga-viewer' ) . '"></button>';
	$output .= '<div class="amv-reader__pages">';
	$output .= '<div class="amv-reader__focus-layer">';
	$output .= '<div class="amv-reader__surface">';
	foreach ( $pages as $index => $page ) {
		list( $image_width, $image_height ) = ai_manga_viewer_page_dimensions( $page );
		$output .= '<figure class="amv-reader__page' . ( 0 === $index ? ' is-active' : '' ) . '" data-page-index="' . esc_attr( (string) $index ) . '"' . ( '' !== $page['pageKey'] ? ' data-page-key="' . esc_attr( $page['pageKey'] ) . '"' : '' ) . ( $image_width && $image_height ? ' data-image-width="' . esc_attr( (string) $image_width ) . '" data-image-height="' . esc_attr( (string) $image_height ) . '"' : '' ) . ' data-viewer-src="' . esc_url( ai_manga_viewer_viewer_image_url( $page ) ) . '" role="group" aria-label="' . esc_attr( sprintf( __( '%dページ目', 'ai-manga-viewer' ), $index + 1 ) ) . '"><div class="amv-reader__canvas">' . ai_manga_viewer_image( $page, $index ) . ai_manga_viewer_extension_page_overlay( $page, $index, $extension_context ) . '</div></figure>';
	}
	$output .= '</div>';
	$output .= '</div>';
	$output .= '</div>';
	$output .= '<button type="button" class="amv-reader__edge amv-reader__edge--next" aria-label="' . esc_attr__( '次のページ', 'ai-manga-viewer' ) . '"></button>';
	if ( $zoom && 'bottom' !== $zoom_position ) {
		$output .= ai_manga_viewer_zoom_controls( 'amv-reader__zoom-controls--side' );
	}
	$output .= '</div>';
	$output .= '<div class="amv-reader__controls">';
	$output .= '<button type="button" class="amv-reader__button amv-reader__button--previous" aria-controls="' . esc_attr( $stage_id ) . '">' . esc_html__( '前のページ', 'ai-manga-viewer' ) . '</button>';
	if ( $zoom ) {
		$output .= '<button type="button" class="amv-reader__zoom-page amv-reader__zoom-page--previous" aria-controls="' . esc_attr( $stage_id ) . '" aria-label="' . esc_attr__( 'ズームを解除して前のページ', 'ai-manga-viewer' ) . '"></button>';
		$output .= '<div class="amv-reader__controls-main">';
	}
	if ( $show_numbers ) {
		$output .= '<output class="amv-reader__count" aria-live="polite">1 / ' . esc_html( (string) $count ) . '</output>';
	}
	if ( $zoom && 'bottom' === $zoom_position ) {
		$output .= ai_manga_viewer_zoom_controls( 'amv-reader__zoom-controls--bottom' );
	}
	if ( $zoom ) {
		$output .= '</div>';
		$output .= '<button type="button" class="amv-reader__zoom-page amv-reader__zoom-page--next" aria-controls="' . esc_attr( $stage_id ) . '" aria-label="' . esc_attr__( 'ズームを解除して次のページ', 'ai-manga-viewer' ) . '"></button>';
	}
	$output .= '<button type="button" class="amv-reader__button amv-reader__button--next" aria-controls="' . esc_attr( $stage_id ) . '">' . esc_html__( '次のページ', 'ai-manga-viewer' ) . '</button>';
	$output .= '</div>';
	if ( $fullscreen ) {
		$output .= '<div class="amv-reader__mode-controls">';
		if ( $fullscreen ) {
			$output .= '<button type="button" class="amv-reader__fullscreen" aria-controls="' . esc_attr( $stage_id ) . '" aria-pressed="false">' . esc_html__( '全画面で読む', 'ai-manga-viewer' ) . '</button>';
		}
		if ( $fullscreen && 'paged' === $fullscreen_reading_mode && 'pageFocus' === $spread_reading_mode && 'single' !== $page_layout ) {
			$output .= '<button type="button" class="amv-reader__spread-overview" aria-pressed="false" hidden>' . esc_html__( '見開き全体を見る', 'ai-manga-viewer' ) . '</button>';
		}
		$output .= '</div>';
	}
	$output .= ai_manga_viewer_extension_after_content( $extension_context );
	return $output . '</div>';
}
