<?php
/** Core-owned Analytics retention and data-management settings. */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Keep lifecycle settings available even when the Pro reporting module is absent. */
function ai_manga_viewer_add_analytics_lifecycle_settings_page() {
	add_submenu_page( 'edit.php?post_type=amv_viewer', __( '漫画解析設定', 'mangafocus' ), __( '解析設定', 'mangafocus' ), 'manage_options', 'ai-manga-viewer-analytics', 'ai_manga_viewer_render_analytics_settings_page' );
}
add_action( 'admin_menu', 'ai_manga_viewer_add_analytics_lifecycle_settings_page' );

/** Render collection preference and Core-owned retention/deletion controls. */
function ai_manga_viewer_render_analytics_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'この設定を変更する権限がありません。', 'mangafocus' ) );
	}
	$enabled    = '1' === get_option( 'ai_manga_viewer_analytics_enabled', '0' );
	$retention  = ai_manga_viewer_sanitize_retention_days( get_option( 'ai_manga_viewer_analytics_retention_days', '90' ) );
	$delete_all = '1' === get_option( 'ai_manga_viewer_analytics_delete_on_uninstall', '0' );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( '漫画解析設定', 'mangafocus' ); ?></h1>
		<?php if ( isset( $_GET['amv-data-deleted'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-success is-dismissible"><p><?php echo esc_html__( '漫画解析データを削除しました。', 'mangafocus' ); ?></p></div>
		<?php endif; ?>
		<p><?php echo esc_html__( 'Manga Library登録済み漫画の解析設定と、保存済みデータの保持期間を管理します。Analytics収集とレポートにはMangaFocus Proが必要です。', 'mangafocus' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'ai_manga_viewer_analytics' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php echo esc_html__( '漫画解析', 'mangafocus' ); ?></th><td><input type="hidden" name="ai_manga_viewer_analytics_enabled" value="0" /><label><input type="checkbox" name="ai_manga_viewer_analytics_enabled" value="1" <?php checked( $enabled ); ?> /> <?php echo esc_html__( '読者イベントの収集を有効にする', 'mangafocus' ); ?></label><p class="description"><?php echo esc_html__( 'Proが利用可能な場合だけ収集します。OFFにしても過去の解析データは削除されません。', 'mangafocus' ); ?></p></td></tr>
				<tr><th scope="row"><label for="amv-retention-days"><?php echo esc_html__( '詳細データの保存期間', 'mangafocus' ); ?></label></th><td><input id="amv-retention-days" class="small-text" type="number" min="30" max="365" step="1" name="ai_manga_viewer_analytics_retention_days" value="<?php echo esc_attr( $retention ); ?>" /> <?php echo esc_html__( '日', 'mangafocus' ); ?><p class="description"><?php echo esc_html__( '既定は90日です。Proの状態に関係なく、期限を過ぎたデータを日次で削除します。', 'mangafocus' ); ?></p></td></tr>
				<tr><th scope="row"><?php echo esc_html__( 'アンインストール時', 'mangafocus' ); ?></th><td><input type="hidden" name="ai_manga_viewer_analytics_delete_on_uninstall" value="0" /><label><input type="checkbox" name="ai_manga_viewer_analytics_delete_on_uninstall" value="1" <?php checked( $delete_all ); ?> /> <?php echo esc_html__( '解析テーブルと設定をすべて削除する', 'mangafocus' ); ?></label></td></tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<hr />
		<h2 id="amv-analytics-delete"><?php echo esc_html__( '解析データの全削除', 'mangafocus' ); ?></h2>
		<p><?php echo esc_html__( '保存済みのセッション、ページ到達、イベントをすべて削除します。この操作は元に戻せません。設定とテーブルは残ります。', 'mangafocus' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return window.confirm('<?php echo esc_js( __( '漫画解析データをすべて削除しますか？', 'mangafocus' ) ); ?>');">
			<input type="hidden" name="action" value="ai_manga_viewer_delete_analytics" />
			<?php wp_nonce_field( 'ai_manga_viewer_delete_analytics' ); ?>
			<?php submit_button( __( '解析データをすべて削除', 'mangafocus' ), 'delete', 'submit', false ); ?>
		</form>
	</div>
	<?php
}

/** Handle the explicit destructive action through the Core storage API. */
function ai_manga_viewer_handle_delete_analytics() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'この操作を行う権限がありません。', 'mangafocus' ) );
	}
	check_admin_referer( 'ai_manga_viewer_delete_analytics' );
	ai_manga_viewer_delete_all_analytics_data();
	wp_safe_redirect( add_query_arg( 'amv-data-deleted', '1', admin_url( 'edit.php?post_type=amv_viewer&page=ai-manga-viewer-analytics' ) ) );
	exit;
}
add_action( 'admin_post_ai_manga_viewer_delete_analytics', 'ai_manga_viewer_handle_delete_analytics' );
