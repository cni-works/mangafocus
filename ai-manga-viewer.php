<?php
/**
 * Plugin Name: AI Manga Viewer
 * Description: AI Manga Viewer – Manga Reader for WordPress / WordPress用AI漫画ビューアー
 * Version: 0.1.0-alpha
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

/** Register the standalone reader and its WordPress dependencies. */
function ai_manga_viewer_register_blocks() {
	$path = plugin_dir_path( __FILE__ ) . 'blocks/viewer/';
	$url  = plugin_dir_url( __FILE__ ) . 'blocks/viewer/';
	wp_register_script(
		'ai-manga-viewer-editor',
		$url . 'index.js',
		array( 'wp-blocks', 'wp-i18n', 'wp-element', 'wp-block-editor', 'wp-components' ),
		filemtime( $path . 'index.js' )
	);
	wp_register_script( 'ai-manga-viewer-view', $url . 'view.js', array(), filemtime( $path . 'view.js' ), true );
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
}
add_action( 'init', 'ai_manga_viewer_register_blocks' );

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
