<?php
/**
 * Plugin Name: AI Manga Viewer
 * Description: AI Manga Viewer – Manga Reader for WordPress / WordPress用AI漫画ビューアー
 * Version: 0.3.0-alpha
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author: CNI
 * License: GPLv2 or later
 * Text Domain: ai-manga-viewer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once plugin_dir_path( __FILE__ ) . 'blocks/viewer/render.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/analytics.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/consultation.php';

register_activation_hook( __FILE__, 'ai_manga_viewer_install_analytics_tables' );
register_deactivation_hook( __FILE__, 'ai_manga_viewer_deactivate_analytics' );
register_uninstall_hook( __FILE__, 'ai_manga_viewer_uninstall_analytics' );

/** Register the standalone reader and its WordPress dependencies. */
function ai_manga_viewer_register_blocks() {
	$path = plugin_dir_path( __FILE__ ) . 'blocks/viewer/';
	$url  = plugin_dir_url( __FILE__ ) . 'blocks/viewer/';
	$library_path = plugin_dir_path( __FILE__ ) . 'blocks/library-viewer/';
	$library_url  = plugin_dir_url( __FILE__ ) . 'blocks/library-viewer/';
	wp_register_script( 'ai-manga-viewer-layout', $url . 'layout.js', array(), filemtime( $path . 'layout.js' ) );
	wp_register_script(
		'ai-manga-viewer-editor',
		$url . 'index.js',
		array( 'ai-manga-viewer-layout', 'wp-api-fetch', 'wp-blocks', 'wp-i18n', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-data' ),
		filemtime( $path . 'index.js' )
	);
	wp_register_script( 'ai-manga-viewer-view', $url . 'view.js', array( 'ai-manga-viewer-layout' ), filemtime( $path . 'view.js' ), true );
	wp_add_inline_script(
		'ai-manga-viewer-view',
		'window.aiMangaViewerAnalytics=' . wp_json_encode(
			array(
				'enabled'   => null,
				'restUrl'   => esc_url_raw( rest_url( 'ai-manga-viewer/v1/events' ) ),
				'configUrl' => esc_url_raw( rest_url( 'ai-manga-viewer/v1/config' ) ),
			)
		) . ';',
		'before'
	);
	wp_register_style( 'ai-manga-viewer-style', $url . 'style.css', array(), filemtime( $path . 'style.css' ) );
	wp_set_script_translations( 'ai-manga-viewer-editor', 'ai-manga-viewer' );
	register_block_type(
		$path,
		array(
			'editor_script'   => 'ai-manga-viewer-editor',
			'view_script'     => 'ai-manga-viewer-view',
			'style'           => 'ai-manga-viewer-style',
			'editor_style'    => 'ai-manga-viewer-style',
			'render_callback' => 'ai_manga_viewer_render_viewer',
		)
	);
	wp_register_script(
		'ai-manga-viewer-library-editor',
		$library_url . 'index.js',
		array( 'wp-api-fetch', 'wp-blocks', 'wp-i18n', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-data' ),
		filemtime( $library_path . 'index.js' )
	);
	wp_set_script_translations( 'ai-manga-viewer-library-editor', 'ai-manga-viewer' );
	register_block_type(
		$library_path,
		array(
			'editor_script'   => 'ai-manga-viewer-library-editor',
			'editor_style'    => 'ai-manga-viewer-style',
			'render_callback' => 'ai_manga_viewer_render_library_block',
		)
	);
}
add_action( 'init', 'ai_manga_viewer_register_blocks' );

/** Register the reusable Manga Library managed in the block editor. */
function ai_manga_viewer_register_library() {
	$labels = array(
		'name'                  => __( '漫画ライブラリ', 'ai-manga-viewer' ),
		'singular_name'         => __( '登録済みViewer', 'ai-manga-viewer' ),
		'menu_name'             => __( '漫画ライブラリ', 'ai-manga-viewer' ),
		'name_admin_bar'        => __( '登録済みViewer', 'ai-manga-viewer' ),
		'add_new'               => __( '新規追加', 'ai-manga-viewer' ),
		'add_new_item'          => __( '漫画を新規登録', 'ai-manga-viewer' ),
		'new_item'              => __( '新しい漫画', 'ai-manga-viewer' ),
		'edit_item'             => __( '漫画を編集', 'ai-manga-viewer' ),
		'view_item'             => __( '漫画を確認', 'ai-manga-viewer' ),
		'all_items'             => __( '登録済み漫画', 'ai-manga-viewer' ),
		'search_items'          => __( '漫画を検索', 'ai-manga-viewer' ),
		'not_found'             => __( '登録済みの漫画はありません。', 'ai-manga-viewer' ),
		'not_found_in_trash'    => __( 'ゴミ箱に漫画はありません。', 'ai-manga-viewer' ),
		'featured_image'        => __( '表紙画像', 'ai-manga-viewer' ),
		'set_featured_image'    => __( '表紙画像を設定', 'ai-manga-viewer' ),
		'remove_featured_image' => __( '表紙画像を削除', 'ai-manga-viewer' ),
		'use_featured_image'    => __( '表紙画像として使用', 'ai-manga-viewer' ),
	);
	register_post_type(
		'amv_viewer',
		array(
			'labels'              => $labels,
			'description'         => __( '再利用する漫画Viewerを登録・編集します。', 'ai-manga-viewer' ),
			'public'              => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_admin_bar'   => false,
			'show_in_nav_menus'   => false,
			'show_in_rest'        => true,
			'rest_base'           => 'ai-manga-viewers',
			'menu_icon'           => 'dashicons-book-alt',
			'menu_position'       => 25,
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'supports'            => array( 'title', 'editor', 'thumbnail', 'revisions' ),
			'has_archive'         => false,
			'rewrite'             => false,
			'query_var'           => false,
			'can_export'          => true,
			'delete_with_user'    => false,
			'template'            => array( array( 'ai-manga-viewer/viewer' ) ),
			'template_lock'       => 'all',
		)
	);
}
add_action( 'init', 'ai_manga_viewer_register_library' );

/** Expose one prepared cover URL so the editor selector does not depend on REST embedding behavior. */
function ai_manga_viewer_register_library_rest_fields() {
	register_rest_field(
		'amv_viewer',
		'amv_cover_url',
		array(
			'get_callback' => function( $object ) {
				$post_id = absint( $object['id'] ?? 0 );
				$url     = $post_id ? ai_manga_viewer_library_cover_url( $post_id, 'medium' ) : false;
				return $url ? esc_url_raw( $url ) : '';
			},
			'schema' => array( 'description' => __( '漫画ライブラリの表紙画像URL', 'ai-manga-viewer' ), 'type' => 'string', 'format' => 'uri', 'context' => array( 'view', 'edit' ), 'readonly' => true ),
		)
	);
}
add_action( 'rest_api_init', 'ai_manga_viewer_register_library_rest_fields' );

/** Return the first saved page used as the automatic Library cover candidate. */
function ai_manga_viewer_library_first_page( $post_id ) {
	$post_id = absint( $post_id );
	if ( ! $post_id || 'amv_viewer' !== get_post_type( $post_id ) ) {
		return array( 'id' => 0, 'url' => '' );
	}
	$viewer_block = ai_manga_viewer_find_library_block( parse_blocks( (string) get_post_field( 'post_content', $post_id ) ) );
	$pages        = is_array( $viewer_block['attrs']['pages'] ?? null ) ? $viewer_block['attrs']['pages'] : array();
	$first_page   = is_array( $pages[0] ?? null ) ? $pages[0] : array();
	$page_url     = esc_url_raw( $first_page['thumbnailUrl'] ?? '' );
	if ( ! $page_url ) {
		$page_url = esc_url_raw( $first_page['url'] ?? '' );
	}
	return array(
		'id'  => absint( $first_page['id'] ?? 0 ),
		'url' => $page_url,
	);
}

/** Resolve a Library cover without downloading externally hosted page images. */
function ai_manga_viewer_library_cover_url( $post_id, $size = 'medium' ) {
	$post_id = absint( $post_id );
	$cover   = $post_id ? get_the_post_thumbnail_url( $post_id, $size ) : false;
	if ( $cover ) {
		return esc_url_raw( $cover );
	}
	$first_page = ai_manga_viewer_library_first_page( $post_id );
	if ( $first_page['id'] && 'attachment' === get_post_type( $first_page['id'] ) && wp_attachment_is_image( $first_page['id'] ) ) {
		$attachment_cover = wp_get_attachment_image_url( $first_page['id'], $size );
		if ( $attachment_cover ) {
			return esc_url_raw( $attachment_cover );
		}
	}
	return $first_page['url'];
}

/** Keep only plugin-created featured images synchronized with the first page. */
function ai_manga_viewer_sync_library_featured_image( $post_id ) {
	$post_id = absint( $post_id );
	if ( ! $post_id || 'amv_viewer' !== get_post_type( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
		return;
	}
	$tracking = (string) get_post_meta( $post_id, '_amv_auto_featured_image', true );
	$current  = absint( get_post_thumbnail_id( $post_id ) );
	if ( 'manual' === $tracking ) {
		return;
	}
	if ( preg_match( '/^auto:(\d+)$/', $tracking, $matches ) ) {
		if ( $current !== absint( $matches[1] ) ) {
			update_post_meta( $post_id, '_amv_auto_featured_image', 'manual' );
			return;
		}
	} elseif ( $current || '' !== $tracking ) {
		update_post_meta( $post_id, '_amv_auto_featured_image', 'manual' );
		return;
	}
	$first_page = ai_manga_viewer_library_first_page( $post_id );
	$cover_id   = absint( $first_page['id'] );
	if ( $cover_id && 'attachment' === get_post_type( $cover_id ) && wp_attachment_is_image( $cover_id ) ) {
		if ( $current !== $cover_id ) {
			set_post_thumbnail( $post_id, $cover_id );
		}
		update_post_meta( $post_id, '_amv_auto_featured_image', 'auto:' . $cover_id );
		return;
	}
	if ( $current ) {
		delete_post_thumbnail( $post_id );
	}
	update_post_meta( $post_id, '_amv_auto_featured_image', 'auto:0' );
}

/** Synchronize covers saved through the native block editor. */
function ai_manga_viewer_sync_library_featured_image_on_save( $post_id ) {
	ai_manga_viewer_sync_library_featured_image( $post_id );
}
add_action( 'save_post_amv_viewer', 'ai_manga_viewer_sync_library_featured_image_on_save', 20 );

/** Synchronize after REST fields, including a manually selected featured image, are applied. */
function ai_manga_viewer_sync_library_featured_image_after_rest( $post ) {
	if ( is_object( $post ) && ! empty( $post->ID ) ) {
		ai_manga_viewer_sync_library_featured_image( $post->ID );
	}
}
add_action( 'rest_after_insert_amv_viewer', 'ai_manga_viewer_sync_library_featured_image_after_rest', 20 );

/** Add the cover and stable numeric Viewer ID to the Manga Library list. */
function ai_manga_viewer_library_columns( $columns ) {
	$library_columns = array();
	foreach ( $columns as $key => $label ) {
		if ( 'date' === $key ) {
			$library_columns['amv_modified'] = __( '更新日', 'ai-manga-viewer' );
			continue;
		}
		$library_columns[ $key ] = $label;
		if ( 'cb' === $key ) {
			$library_columns['amv_cover'] = __( '表紙', 'ai-manga-viewer' );
		}
		if ( 'title' === $key ) {
			$library_columns['amv_details'] = __( 'Viewer情報', 'ai-manga-viewer' );
		}
	}
	return $library_columns;
}
add_filter( 'manage_amv_viewer_posts_columns', 'ai_manga_viewer_library_columns' );

/** Render Manga Library-only list columns. */
function ai_manga_viewer_library_column( $column, $post_id ) {
	if ( 'amv_details' === $column ) {
		$status_name   = get_post_status( $post_id );
		$status        = get_post_status_object( $status_name );
		$viewer_block  = ai_manga_viewer_find_library_block( parse_blocks( (string) get_post_field( 'post_content', $post_id ) ) );
		$page_count    = is_array( $viewer_block['attrs']['pages'] ?? null ) ? count( $viewer_block['attrs']['pages'] ) : 0;
		$format        = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		$modified      = get_post_modified_time( $format, false, $post_id, true );
		$edit_url      = get_edit_post_link( $post_id, 'raw' );
		$shortcode     = '[ai_manga_viewer id="' . absint( $post_id ) . '"]';
		$analytics_url = add_query_arg(
			array(
				'post_type' => 'amv_viewer',
				'page'      => 'ai-manga-viewer-analytics-report',
				'amv_viewer'=> 'library-viewer-' . absint( $post_id ),
			),
			admin_url( 'edit.php' )
		);
		$analytics_enabled = ai_manga_viewer_analytics_enabled();
		$consultation_url = ai_manga_viewer_consultation_url( 30, 'library-viewer-' . absint( $post_id ) );
		$analytics_settings_url = add_query_arg(
			array(
				'post_type' => 'amv_viewer',
				'page'      => 'ai-manga-viewer-analytics',
			),
			admin_url( 'edit.php' )
		);
		echo '<div class="amv-library-meta"><span class="amv-library-badge amv-library-badge--status is-' . esc_attr( sanitize_html_class( $status_name ) ) . '">' . esc_html( $status ? $status->label : $status_name ) . '</span><span class="amv-library-badge">' . esc_html( sprintf( _n( '%sページ', '%sページ', $page_count, 'ai-manga-viewer' ), number_format_i18n( $page_count ) ) ) . '</span><span class="amv-library-meta__id">' . esc_html__( 'Viewer ID:', 'ai-manga-viewer' ) . ' ' . esc_html( (string) absint( $post_id ) ) . '</span><span class="amv-library-meta__modified">' . esc_html__( '更新:', 'ai-manga-viewer' ) . ' ' . ( $modified ? esc_html( $modified ) : '<span aria-hidden="true">—</span>' ) . '</span></div>';
		echo '<div class="amv-library-primary-actions">';
		if ( $edit_url ) {
			echo '<a class="button button-small" href="' . esc_url( $edit_url ) . '">' . esc_html__( '編集', 'ai-manga-viewer' ) . '</a>';
		}
		if ( $analytics_enabled ) {
			echo '<a class="button button-small amv-library-analytics" href="' . esc_url( $analytics_url ) . '">' . esc_html__( '解析を見る', 'ai-manga-viewer' ) . '</a>';
			if ( current_user_can( 'manage_options' ) ) {
				echo '<a class="button button-small amv-library-consultation" href="' . esc_url( $consultation_url ) . '">' . esc_html__( 'AI相談資料を作成', 'ai-manga-viewer' ) . '</a>';
			}
		} else {
			echo '<span class="amv-library-analytics-state">' . esc_html__( '解析停止中', 'ai-manga-viewer' ) . '</span>';
			if ( current_user_can( 'manage_options' ) ) {
				echo '<a class="button button-small amv-library-analytics-settings" href="' . esc_url( $analytics_settings_url ) . '">' . esc_html__( '解析を有効にする', 'ai-manga-viewer' ) . '</a>';
			}
		}
		echo '<span class="amv-library-shortcode"><button type="button" class="amv-library-shortcode__copy" data-shortcode="' . esc_attr( $shortcode ) . '" data-default-label="' . esc_attr__( 'コピー', 'ai-manga-viewer' ) . '" data-copied-label="' . esc_attr__( 'コピーしました', 'ai-manga-viewer' ) . '" data-success-message="' . esc_attr__( 'ショートコードをコピーしました。', 'ai-manga-viewer' ) . '" data-error-message="' . esc_attr__( 'コピーできませんでした。', 'ai-manga-viewer' ) . '" aria-label="' . esc_attr( sprintf( __( 'ショートコード %s をコピー', 'ai-manga-viewer' ), $shortcode ) ) . '" title="' . esc_attr__( 'クリックしてショートコードをコピー', 'ai-manga-viewer' ) . '"><code class="amv-library-shortcode__code">' . esc_html( $shortcode ) . '</code><span class="amv-library-shortcode__feedback" aria-hidden="true">' . esc_html__( 'コピー', 'ai-manga-viewer' ) . '</span></button><span class="screen-reader-text amv-library-shortcode__status" aria-live="polite"></span></span></div>';
		return;
	}
	if ( 'amv_modified' === $column ) {
		$format   = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );
		$modified = get_post_modified_time( $format, false, $post_id, true );
		echo '<span class="screen-reader-text">' . esc_html__( '更新:', 'ai-manga-viewer' ) . ' ' . ( $modified ? esc_html( $modified ) : esc_html__( '不明', 'ai-manga-viewer' ) ) . '</span>';
		return;
	}
	if ( 'amv_cover' !== $column ) {
		return;
	}
	$cover    = get_the_post_thumbnail( $post_id, 'medium', array( 'alt' => '', 'class' => 'amv-library-cover-image' ) );
	if ( ! $cover ) {
		$cover_url = ai_manga_viewer_library_cover_url( $post_id, 'medium' );
		$cover     = $cover_url ? '<img class="amv-library-cover-image" src="' . esc_url( $cover_url ) . '" alt="" />' : '';
	}
	$edit_url = get_edit_post_link( $post_id, 'raw' );
	$content  = $cover ? wp_kses_post( $cover ) : '<span class="amv-library-cover-placeholder">' . esc_html__( '表紙未設定', 'ai-manga-viewer' ) . '</span>';
	if ( $edit_url ) {
		echo '<a class="amv-library-cover-link" href="' . esc_url( $edit_url ) . '" aria-label="' . esc_attr__( 'この漫画を編集', 'ai-manga-viewer' ) . '">' . $content . '</a>';
		return;
	}
	echo $content;
}
add_action( 'manage_amv_viewer_posts_custom_column', 'ai_manga_viewer_library_column', 10, 2 );

/** Allow useful sorting without changing the underlying WordPress list query. */
function ai_manga_viewer_library_sortable_columns( $columns ) {
	$columns['amv_details'] = 'ID';
	$columns['amv_modified']  = 'modified';
	return $columns;
}
add_filter( 'manage_edit-amv_viewer_sortable_columns', 'ai_manga_viewer_library_sortable_columns' );

/** Load the copy helper only on the Manga Library list screen. */
function ai_manga_viewer_library_admin_assets( $hook_suffix ) {
	if ( 'edit.php' !== $hook_suffix ) {
		return;
	}
	$screen = get_current_screen();
	if ( ! $screen || 'edit-amv_viewer' !== $screen->id ) {
		return;
	}
	$path = plugin_dir_path( __FILE__ ) . 'assets/admin-library.js';
	$url  = plugin_dir_url( __FILE__ ) . 'assets/admin-library.js';
	wp_enqueue_script( 'ai-manga-viewer-library-admin', $url, array(), filemtime( $path ), true );
	$style_path = plugin_dir_path( __FILE__ ) . 'assets/admin-library.css';
	$style_url  = plugin_dir_url( __FILE__ ) . 'assets/admin-library.css';
	wp_enqueue_style( 'ai-manga-viewer-library-admin', $style_url, array(), filemtime( $style_path ) );
}
add_action( 'admin_enqueue_scripts', 'ai_manga_viewer_library_admin_assets' );

/** Sanitize one focus area copied from a direct Viewer. */
function ai_manga_viewer_sanitize_library_focus_area( $area ) {
	if ( ! is_array( $area ) ) {
		return null;
	}
	$clean = array(
		'id'     => sanitize_key( $area['id'] ?? '' ),
		'x'      => min( 100, max( 0, (float) ( $area['x'] ?? 50 ) ) ),
		'y'      => min( 100, max( 0, (float) ( $area['y'] ?? 50 ) ) ),
		'width'  => min( 100, max( 5, (float) ( $area['width'] ?? 20 ) ) ),
		'height' => min( 100, max( 5, (float) ( $area['height'] ?? 20 ) ) ),
		'view'   => in_array( $area['view'] ?? '', array( 'auto', 'focus', 'overview' ), true ) ? $area['view'] : 'auto',
		'zoom'   => min( 110, max( 60, (float) ( $area['zoom'] ?? 100 ) ) ),
	);
	return $clean;
}

/** Sanitize one CTA copied from a direct Viewer. */
function ai_manga_viewer_sanitize_library_cta( $cta ) {
	if ( ! is_array( $cta ) ) {
		return array();
	}
	return array(
		'enabled'         => ! empty( $cta['enabled'] ),
		'ctaKey'          => sanitize_key( $cta['ctaKey'] ?? '' ),
		'type'            => 'image' === ( $cta['type'] ?? '' ) ? 'image' : 'text',
		'label'           => sanitize_text_field( $cta['label'] ?? '' ),
		'url'             => esc_url_raw( $cta['url'] ?? '' ),
		'imageId'         => absint( $cta['imageId'] ?? 0 ),
		'imageUrl'        => esc_url_raw( $cta['imageUrl'] ?? '' ),
		'imageAlt'        => sanitize_text_field( $cta['imageAlt'] ?? '' ),
		'position'        => in_array( $cta['position'] ?? '', array( 'left', 'center', 'right' ), true ) ? $cta['position'] : 'center',
		'newTab'          => ! empty( $cta['newTab'] ),
		'freePosition'    => ! empty( $cta['freePosition'] ),
		'x'               => min( 100, max( 0, (float) ( $cta['x'] ?? 50 ) ) ),
		'y'               => min( 100, max( 0, (float) ( $cta['y'] ?? 86 ) ) ),
		'width'           => min( 80, max( 10, (float) ( $cta['width'] ?? 32 ) ) ),
		'fontSize'        => min( 48, max( 10, (float) ( $cta['fontSize'] ?? 16 ) ) ),
		'textColor'       => sanitize_hex_color( $cta['textColor'] ?? '' ) ?: '#ffffff',
		'backgroundColor' => sanitize_hex_color( $cta['backgroundColor'] ?? '' ) ?: '#1f2937',
		'borderColor'     => sanitize_hex_color( $cta['borderColor'] ?? '' ) ?: '#ffffff',
		'borderRadius'    => min( 50, max( 0, (float) ( $cta['borderRadius'] ?? 24 ) ) ),
		'attentionEffect' => 'glow' === ( $cta['attentionEffect'] ?? '' ) ? 'glow' : 'none',
		'hoverEffect'     => in_array( $cta['hoverEffect'] ?? '', array( 'lift', 'darken' ), true ) ? $cta['hoverEffect'] : 'none',
	);
}

/** Sanitize the complete direct Viewer payload before storing a Library copy. */
function ai_manga_viewer_sanitize_library_attributes( $attributes ) {
	$attributes = is_array( $attributes ) ? $attributes : array();
	$pages      = array();
	foreach ( array_slice( is_array( $attributes['pages'] ?? null ) ? $attributes['pages'] : array(), 0, 500 ) as $page ) {
		if ( ! is_array( $page ) || '' === esc_url_raw( $page['url'] ?? '' ) ) {
			continue;
		}
		$focus  = array_values( array_filter( array_map( 'ai_manga_viewer_sanitize_library_focus_area', is_array( $page['focusAreas'] ?? null ) ? $page['focusAreas'] : array() ) ) );
		$mobile = array_values( array_filter( array_map( 'ai_manga_viewer_sanitize_library_focus_area', is_array( $page['mobileFocusAreas'] ?? null ) ? $page['mobileFocusAreas'] : array() ) ) );
		$clean  = array(
			'id'               => absint( $page['id'] ?? 0 ),
			'url'              => esc_url_raw( $page['url'] ?? '' ),
			'alt'              => sanitize_text_field( $page['alt'] ?? '' ),
			'thumbnailUrl'     => esc_url_raw( $page['thumbnailUrl'] ?? '' ),
			'pageKey'          => sanitize_key( $page['pageKey'] ?? '' ),
			'focusAreas'       => $focus,
			'mobileFocusAreas' => $mobile,
		);
		if ( isset( $page['cta'] ) ) {
			$clean['cta'] = ai_manga_viewer_sanitize_library_cta( $page['cta'] );
		}
		$pages[] = $clean;
	}
	return array(
		'pages'                     => $pages,
		'binding'                   => 'ltr' === ( $attributes['binding'] ?? '' ) ? 'ltr' : 'rtl',
		'pageLayout'                => in_array( $attributes['pageLayout'] ?? '', array( 'spread', 'auto' ), true ) ? $attributes['pageLayout'] : 'single',
		'singleFirstPage'           => ! isset( $attributes['singleFirstPage'] ) || ! empty( $attributes['singleFirstPage'] ),
		'spreadReadingMode'         => 'pageFocus' === ( $attributes['spreadReadingMode'] ?? '' ) ? 'pageFocus' : 'overview',
		'maxWidth'                  => min( 1600, max( 320, absint( $attributes['maxWidth'] ?? 650 ) ) ),
		'showPageNumbers'           => ! isset( $attributes['showPageNumbers'] ) || ! empty( $attributes['showPageNumbers'] ),
		'enableEdgeClick'           => ! isset( $attributes['enableEdgeClick'] ) || ! empty( $attributes['enableEdgeClick'] ),
		'showGuideArrowOnAllPages'  => ! empty( $attributes['showGuideArrowOnAllPages'] ),
		'enableAnimation'           => ! isset( $attributes['enableAnimation'] ) || ! empty( $attributes['enableAnimation'] ),
		'enableFullscreen'          => ! empty( $attributes['enableFullscreen'] ),
		'inlineDisplayMode'         => 'coverLauncher' === ( $attributes['inlineDisplayMode'] ?? '' ) ? 'coverLauncher' : 'reader',
		'fullscreenReadingMode'     => 'vertical' === ( $attributes['fullscreenReadingMode'] ?? '' ) ? 'vertical' : 'paged',
		'enableZoom'                => ! empty( $attributes['enableZoom'] ),
		'zoomControlsPosition'      => in_array( $attributes['zoomControlsPosition'] ?? '', array( 'left', 'right', 'bottom' ), true ) ? $attributes['zoomControlsPosition'] : 'bottom',
		'scrollAssist'              => ! empty( $attributes['scrollAssist'] ),
		'scrollAssistPosition'      => in_array( $attributes['scrollAssistPosition'] ?? '', array( 'auto', 'top', 'center' ), true ) ? $attributes['scrollAssistPosition'] : 'auto',
		'scrollAssistStrength'      => in_array( $attributes['scrollAssistStrength'] ?? '', array( 'gentle', 'normal', 'strong' ), true ) ? $attributes['scrollAssistStrength'] : 'normal',
		'focusReader'               => ! empty( $attributes['focusReader'] ),
		'focusReaderStartAtCurrent' => ! empty( $attributes['focusReaderStartAtCurrent'] ),
		'mobileFocusReader'         => ! empty( $attributes['mobileFocusReader'] ),
	);
}

/** Create an independent Manga Library copy of one direct Viewer. */
function ai_manga_viewer_register_direct_viewer( WP_REST_Request $request ) {
	$title          = sanitize_text_field( (string) $request->get_param( 'title' ) );
	$source_post_id = absint( $request->get_param( 'sourcePostId' ) );
	$source_key     = sanitize_key( (string) $request->get_param( 'sourceInstanceKey' ) );
	$existing_id    = absint( $request->get_param( 'existingViewerId' ) );
	if ( '' === $title ) {
		return new WP_Error( 'amv_title_required', __( '漫画タイトルを入力してください。', 'ai-manga-viewer' ), array( 'status' => 400 ) );
	}
	if ( $source_post_id && ! current_user_can( 'edit_post', $source_post_id ) ) {
		return new WP_Error( 'amv_source_forbidden', __( 'この投稿から漫画を登録する権限がありません。', 'ai-manga-viewer' ), array( 'status' => 403 ) );
	}
	if ( $existing_id && 'amv_viewer' === get_post_type( $existing_id ) && current_user_can( 'edit_post', $existing_id ) ) {
		return ai_manga_viewer_library_registration_response( $existing_id, true );
	}
	if ( $source_post_id && $source_key ) {
		$duplicates = get_posts( array( 'post_type' => 'amv_viewer', 'post_status' => 'any', 'posts_per_page' => 1, 'meta_key' => '_amv_source_reference', 'meta_value' => $source_post_id . ':' . $source_key, 'fields' => 'ids' ) );
		if ( ! empty( $duplicates[0] ) && current_user_can( 'edit_post', $duplicates[0] ) ) {
			return ai_manga_viewer_library_registration_response( $duplicates[0], true );
		}
	}
	$attributes = ai_manga_viewer_sanitize_library_attributes( $request->get_param( 'attributes' ) );
	if ( empty( $attributes['pages'] ) ) {
		return new WP_Error( 'amv_pages_required', __( '登録できる漫画ページがありません。', 'ai-manga-viewer' ), array( 'status' => 400 ) );
	}
	$post_status = current_user_can( 'publish_posts' ) ? 'publish' : 'draft';
	$viewer_id = wp_insert_post( array( 'post_type' => 'amv_viewer', 'post_status' => $post_status, 'post_title' => $title, 'post_content' => '' ), true );
	if ( is_wp_error( $viewer_id ) ) {
		return new WP_Error( 'amv_library_create_failed', __( '漫画ライブラリへの登録に失敗しました。', 'ai-manga-viewer' ), array( 'status' => 500 ) );
	}
	$attributes['viewerKey']       = 'library-viewer-' . $viewer_id;
	$attributes['instanceKey']     = 'library-source-' . $viewer_id;
	$attributes['libraryViewerId'] = 0;
	$content = serialize_block( array( 'blockName' => 'ai-manga-viewer/viewer', 'attrs' => $attributes, 'innerBlocks' => array(), 'innerHTML' => '', 'innerContent' => array() ) );
	$updated = wp_update_post( array( 'ID' => $viewer_id, 'post_content' => $content ), true );
	if ( is_wp_error( $updated ) || ! $updated ) {
		wp_delete_post( $viewer_id, true );
		return new WP_Error( 'amv_library_save_failed', __( '漫画ライブラリへの登録に失敗しました。', 'ai-manga-viewer' ), array( 'status' => 500 ) );
	}
	if ( $source_post_id && $source_key ) {
		update_post_meta( $viewer_id, '_amv_source_reference', $source_post_id . ':' . $source_key );
	}
	ai_manga_viewer_sync_library_featured_image( $viewer_id );
	return ai_manga_viewer_library_registration_response( $viewer_id, false );
}

/** Build the editor response after a Library registration or duplicate lookup. */
function ai_manga_viewer_library_registration_response( $viewer_id, $duplicate ) {
	$status = get_post_status( $viewer_id );
	return rest_ensure_response( array(
		'id'        => absint( $viewer_id ),
		'title'     => get_the_title( $viewer_id ),
		'editUrl'   => get_edit_post_link( $viewer_id, 'raw' ),
		'shortcode' => '[ai_manga_viewer id="' . absint( $viewer_id ) . '"]',
		'duplicate' => (bool) $duplicate,
		'status'    => $status,
		'canSwitch' => 'publish' === $status,
	) );
}

/** Register the authenticated editor-only Library migration endpoint. */
function ai_manga_viewer_register_library_routes() {
	register_rest_route( 'ai-manga-viewer/v1', '/library', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'ai_manga_viewer_register_direct_viewer',
		'permission_callback' => function() { return current_user_can( 'edit_posts' ); },
	) );
}
add_action( 'rest_api_init', 'ai_manga_viewer_register_library_routes' );

/** Find the first AI Manga Viewer block without rendering unrelated Library content. */
function ai_manga_viewer_find_library_block( $blocks ) {
	foreach ( (array) $blocks as $block ) {
		if ( ! is_array( $block ) ) {
			continue;
		}
		if ( 'ai-manga-viewer/viewer' === ( $block['blockName'] ?? '' ) ) {
			return $block;
		}
		if ( ! empty( $block['innerBlocks'] ) ) {
			$viewer_block = ai_manga_viewer_find_library_block( $block['innerBlocks'] );
			if ( $viewer_block ) {
				return $viewer_block;
			}
		}
	}
	return null;
}

/** Render one registered Manga Library item by its stable numeric Viewer ID. */
function ai_manga_viewer_render_library_viewer( $viewer_id, $instance_key = '' ) {
	$viewer_id = absint( $viewer_id );
	if ( ! $viewer_id ) {
		return '';
	}
	$viewer = get_post( $viewer_id );
	if ( ! is_object( $viewer ) || 'amv_viewer' !== ( $viewer->post_type ?? '' ) ) {
		return '';
	}

	$status = get_post_status( $viewer );
	if ( ! in_array( $status, array( 'publish', 'private', 'draft', 'pending', 'future' ), true ) ) {
		return '';
	}
	if ( 'publish' !== $status && ! current_user_can( 'edit_post', $viewer_id ) ) {
		return '';
	}

	$viewer_block = ai_manga_viewer_find_library_block( parse_blocks( $viewer->post_content ) );
	if ( ! $viewer_block ) {
		return '';
	}
	$viewer_block['attrs'] = isset( $viewer_block['attrs'] ) && is_array( $viewer_block['attrs'] ) ? $viewer_block['attrs'] : array();
	if ( '' === sanitize_key( $viewer_block['attrs']['viewerKey'] ?? '' ) ) {
		$viewer_block['attrs']['viewerKey'] = 'library-viewer-' . $viewer_id;
	}
	$instance_key = sanitize_key( $instance_key );
	if ( '' !== $instance_key ) {
		$viewer_block['attrs']['instanceKey'] = $instance_key;
	}
	$viewer_block['attrs']['_libraryCoverUrl'] = ai_manga_viewer_library_cover_url( $viewer_id, 'large' );
	$viewer_block['attrs']['_viewerTitle']     = get_the_title( $viewer_id );

	$rendered = render_block( $viewer_block );
	$rendered = preg_replace( '/<div\b/', '<div data-analytics-source="library"', $rendered, 1 );
	if ( '' === trim( $rendered ) ) {
		return '';
	}

	return $rendered;
}

/** Render a registered Viewer block by ID while keeping the Library item as the source of truth. */
function ai_manga_viewer_render_library_block( $attributes ) {
	$viewer_id = absint( $attributes['viewerId'] ?? 0 );
	$instance_key = sanitize_key( $attributes['instanceKey'] ?? '' );
	$rendered  = ai_manga_viewer_render_library_viewer( $viewer_id, $instance_key );
	if ( '' === $rendered ) {
		return '';
	}
	$wrapper_attributes = array(
		'class'          => 'amv-library-embed',
		'data-viewer-id' => (string) $viewer_id,
	);
	if ( '' !== $instance_key ) {
		$wrapper_attributes['data-instance-key'] = $instance_key;
	}
	$wrapper = get_block_wrapper_attributes( $wrapper_attributes );
	return '<div ' . $wrapper . '>' . $rendered . '</div>';
}

/** Render one registered Manga Library item from a Classic Editor shortcode. */
function ai_manga_viewer_library_shortcode( $attributes ) {
	$attributes = shortcode_atts( array( 'id' => 0, 'instance' => '' ), is_array( $attributes ) ? $attributes : array(), 'ai_manga_viewer' );
	$raw_id     = (string) $attributes['id'];
	if ( ! preg_match( '/^[1-9][0-9]*$/', $raw_id ) ) {
		return '';
	}
	$viewer_id = absint( $raw_id );
	$instance_key = sanitize_key( $attributes['instance'] );
	if ( '' === $instance_key ) {
		$post_id = absint( get_the_ID() );
		$instance_key = $post_id ? 'shortcode-' . $post_id . '-' . $viewer_id : '';
	}
	$rendered  = ai_manga_viewer_render_library_viewer( $viewer_id, $instance_key );
	if ( '' === $rendered ) {
		return '';
	}
	return '<div class="amv-library-embed" data-viewer-id="' . esc_attr( (string) $viewer_id ) . '"' . ( '' !== $instance_key ? ' data-instance-key="' . esc_attr( $instance_key ) . '"' : '' ) . '>' . $rendered . '</div>';
}

/** Register the Classic Editor-compatible one-book shortcode. */
function ai_manga_viewer_register_shortcodes() {
	add_shortcode( 'ai_manga_viewer', 'ai_manga_viewer_library_shortcode' );
}
add_action( 'init', 'ai_manga_viewer_register_shortcodes' );

/** Add a separate category without duplicating an existing category. */
function ai_manga_viewer_block_categories( $categories ) {
	foreach ( $categories as $category ) {
		if ( 'ai-manga-viewer' === ( $category['slug'] ?? '' ) ) {
			return $categories;
		}
	}
	$categories[] = array(
		'slug'  => 'ai-manga-viewer',
		'title' => __( 'AI Manga Viewer', 'ai-manga-viewer' ),
		'icon'  => 'book-alt',
	);
	return $categories;
}
add_filter( 'block_categories_all', 'ai_manga_viewer_block_categories' );
