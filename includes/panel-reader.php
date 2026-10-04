<?php
/** Core-owned panel-by-panel reader bootstrap. */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/panel-reader/renderer.php';

/** Register the panel reader editor and frontend assets. */
function ai_manga_viewer_register_panel_reader_assets() {
	$base_path = plugin_dir_path( AI_MANGA_VIEWER_PLUGIN_FILE ) . 'assets/panel-reader/';
	$base_url  = plugin_dir_url( AI_MANGA_VIEWER_PLUGIN_FILE ) . 'assets/panel-reader/';

	wp_register_script(
		'ai-manga-viewer-panel-reader-editor',
		$base_url . 'editor.js',
		array( 'ai-manga-viewer-editor', 'wp-components', 'wp-element', 'wp-hooks', 'wp-i18n' ),
		filemtime( $base_path . 'editor.js' ),
		true
	);
	wp_register_script(
		'ai-manga-viewer-panel-reader-frontend',
		$base_url . 'frontend.js',
		array( 'ai-manga-viewer-view', 'wp-i18n' ),
		filemtime( $base_path . 'frontend.js' ),
		true
	);
	wp_register_style(
		'ai-manga-viewer-panel-reader',
		$base_url . 'style.css',
		array( 'ai-manga-viewer-style' ),
		filemtime( $base_path . 'style.css' )
	);
	wp_set_script_translations( 'ai-manga-viewer-panel-reader-editor', 'mangafocus' );
	wp_set_script_translations( 'ai-manga-viewer-panel-reader-frontend', 'mangafocus' );
}
add_action( 'init', 'ai_manga_viewer_register_panel_reader_assets', 30 );

/** Load public panel reader behavior and styles. */
function ai_manga_viewer_enqueue_panel_reader_runtime() {
	if ( ai_manga_viewer_has_capability( 'panel_reader', 'runtime' ) ) {
		wp_enqueue_script( 'ai-manga-viewer-panel-reader-frontend' );
		wp_enqueue_style( 'ai-manga-viewer-panel-reader' );
	}
}
add_action( 'wp_enqueue_scripts', 'ai_manga_viewer_enqueue_panel_reader_runtime' );

/** Load panel area editing in the block editor. */
function ai_manga_viewer_enqueue_panel_reader_editor() {
	if ( ai_manga_viewer_has_capability( 'panel_reader', 'editor' ) ) {
		wp_enqueue_script( 'ai-manga-viewer-panel-reader-editor' );
		wp_enqueue_style( 'ai-manga-viewer-panel-reader' );
	}
}
add_action( 'enqueue_block_editor_assets', 'ai_manga_viewer_enqueue_panel_reader_editor' );
