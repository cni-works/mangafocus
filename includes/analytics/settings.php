<?php
/** Core-owned Analytics retention and data-management settings. */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Keep lifecycle settings available even when the Pro reporting module is absent. */
function ai_manga_viewer_add_analytics_lifecycle_settings_page() {
	add_submenu_page( 'edit.php?post_type=amv_viewer', __( 'Manga Analytics Settings', 'mangafocus' ), __( 'Analytics Settings', 'mangafocus' ), 'manage_options', 'ai-manga-viewer-analytics', 'ai_manga_viewer_render_analytics_settings_page' );
}
add_action( 'admin_menu', 'ai_manga_viewer_add_analytics_lifecycle_settings_page' );

/** Render collection preference and Core-owned retention/deletion controls. */
function ai_manga_viewer_render_analytics_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to change this setting.', 'mangafocus' ) );
	}
	$enabled    = '1' === get_option( 'ai_manga_viewer_analytics_enabled', '0' );
	$retention  = ai_manga_viewer_sanitize_retention_days( get_option( 'ai_manga_viewer_analytics_retention_days', '90' ) );
	$delete_all = '1' === get_option( 'ai_manga_viewer_analytics_delete_on_uninstall', '0' );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'Manga Analytics Settings', 'mangafocus' ); ?></h1>
		<?php if ( isset( $_GET['amv-data-deleted'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-success is-dismissible"><p><?php echo esc_html__( 'Manga Analytics data deleted.', 'mangafocus' ); ?></p></div>
		<?php endif; ?>
		<p><?php echo esc_html__( 'Manage analytics settings and data retention for comics in Manga Library. MangaFocus Pro is required for analytics collection and reports.', 'mangafocus' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'ai_manga_viewer_analytics' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php echo esc_html__( 'Manga Analytics', 'mangafocus' ); ?></th><td><input type="hidden" name="ai_manga_viewer_analytics_enabled" value="0" /><label><input type="checkbox" name="ai_manga_viewer_analytics_enabled" value="1" <?php checked( $enabled ); ?> /> <?php echo esc_html__( 'Enable reader event collection', 'mangafocus' ); ?></label><p class="description"><?php echo esc_html__( 'Events are collected only when Pro is available. Disabling this option does not delete existing analytics data.', 'mangafocus' ); ?></p></td></tr>
				<tr><th scope="row"><label for="amv-retention-days"><?php echo esc_html__( 'Detailed data retention', 'mangafocus' ); ?></label></th><td><input id="amv-retention-days" class="small-text" type="number" min="30" max="365" step="1" name="ai_manga_viewer_analytics_retention_days" value="<?php echo esc_attr( $retention ); ?>" /> <?php echo esc_html__( 'days', 'mangafocus' ); ?><p class="description"><?php echo esc_html__( 'The default is 90 days. Expired data is deleted daily regardless of Pro status.', 'mangafocus' ); ?></p></td></tr>
				<tr><th scope="row"><?php echo esc_html__( 'On uninstall', 'mangafocus' ); ?></th><td><input type="hidden" name="ai_manga_viewer_analytics_delete_on_uninstall" value="0" /><label><input type="checkbox" name="ai_manga_viewer_analytics_delete_on_uninstall" value="1" <?php checked( $delete_all ); ?> /> <?php echo esc_html__( 'Delete all analytics tables and settings', 'mangafocus' ); ?></label></td></tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<hr />
		<h2 id="amv-analytics-delete"><?php echo esc_html__( 'Delete all analytics data', 'mangafocus' ); ?></h2>
		<p><?php echo esc_html__( 'Delete all saved sessions, page progress, and events. This action cannot be undone. Settings and tables remain.', 'mangafocus' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return window.confirm('<?php echo esc_js( __( 'Delete all Manga Analytics data?', 'mangafocus' ) ); ?>');">
			<input type="hidden" name="action" value="ai_manga_viewer_delete_analytics" />
			<?php wp_nonce_field( 'ai_manga_viewer_delete_analytics' ); ?>
			<?php submit_button( __( 'Delete all analytics data', 'mangafocus' ), 'delete', 'submit', false ); ?>
		</form>
	</div>
	<?php
}

/** Handle the explicit destructive action through the Core storage API. */
function ai_manga_viewer_handle_delete_analytics() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to perform this action.', 'mangafocus' ) );
	}
	check_admin_referer( 'ai_manga_viewer_delete_analytics' );
	ai_manga_viewer_delete_all_analytics_data();
	wp_safe_redirect( add_query_arg( 'amv-data-deleted', '1', admin_url( 'edit.php?post_type=amv_viewer&page=ai-manga-viewer-analytics' ) ) );
	exit;
}
add_action( 'admin_post_ai_manga_viewer_delete_analytics', 'ai_manga_viewer_handle_delete_analytics' );
