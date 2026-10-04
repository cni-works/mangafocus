<?php
/** General product status and navigation hub owned by MangaFocus Core. */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Return the installed Core version through a stable public function. */
function ai_manga_viewer_get_version() {
	return defined( 'AI_MANGA_VIEWER_VERSION' ) ? AI_MANGA_VIEWER_VERSION : '';
}

/** Return the Core-owned general settings URL. */
function ai_manga_viewer_settings_url() {
	return add_query_arg(
		array(
			'post_type' => 'amv_viewer',
			'page'      => 'ai-manga-viewer-settings',
		),
		admin_url( 'edit.php' )
	);
}

/** Register the general hub before the separate Analytics settings entry. */
function ai_manga_viewer_add_settings_page() {
	add_submenu_page(
		'edit.php?post_type=amv_viewer',
		__( 'MangaFocus Settings', 'mangafocus' ),
		__( 'MangaFocus Settings', 'mangafocus' ),
		'manage_options',
		'ai-manga-viewer-settings',
		'ai_manga_viewer_render_settings_page'
	);
}
add_action( 'admin_menu', 'ai_manga_viewer_add_settings_page', 9 );

/** Load the small, screen-scoped stylesheet only on the general hub. */
function ai_manga_viewer_enqueue_settings_assets( $hook_suffix ) {
	if ( 'amv_viewer_page_ai-manga-viewer-settings' !== $hook_suffix ) {
		return;
	}

	$path = plugin_dir_path( AI_MANGA_VIEWER_PLUGIN_FILE ) . 'assets/admin-settings.css';
	wp_enqueue_style(
		'ai-manga-viewer-admin-settings',
		plugins_url( 'assets/admin-settings.css', AI_MANGA_VIEWER_PLUGIN_FILE ),
		array(),
		filemtime( $path )
	);
}
add_action( 'admin_enqueue_scripts', 'ai_manga_viewer_enqueue_settings_assets' );

/** Add the common settings hub to the Core plugin row. */
function ai_manga_viewer_plugin_action_links( $links ) {
	$settings = '<a href="' . esc_url( ai_manga_viewer_settings_url() ) . '">' . esc_html__( 'Settings', 'mangafocus' ) . '</a>';
	array_unshift( $links, $settings );
	return $links;
}
$ai_manga_viewer_plugin_basename = function_exists( 'plugin_basename' ) ? plugin_basename( AI_MANGA_VIEWER_PLUGIN_FILE ) : 'mangafocus/mangafocus.php';
add_filter( 'plugin_action_links_' . $ai_manga_viewer_plugin_basename, 'ai_manga_viewer_plugin_action_links' );
unset( $ai_manga_viewer_plugin_basename );

/** Normalize Pro's public status contribution without calling Pro internals. */
function ai_manga_viewer_get_pro_status() {
	$status = apply_filters(
		'ai_manga_viewer_pro_status',
		array(
			'installed' => false,
			'active'    => false,
			'version'   => '',
		)
	);
	$status = is_array( $status ) ? $status : array();
	return array(
		'installed' => ! empty( $status['installed'] ),
		'active'    => ! empty( $status['active'] ),
		'version'   => sanitize_text_field( (string) ( $status['version'] ?? '' ) ),
	);
}

/** Render one plain-language availability badge. */
function ai_manga_viewer_settings_badge( $available, $available_label = '', $unavailable_label = '' ) {
	$label = $available ? ( $available_label ?: __( 'Available', 'mangafocus' ) ) : ( $unavailable_label ?: __( 'Unavailable', 'mangafocus' ) );
	$class = $available ? 'is-available' : 'is-unavailable';
	return '<span class="amv-settings__status ' . esc_attr( $class ) . '">' . esc_html( $label ) . '</span>';
}

/** Resolve one user-facing feature state from Feature and Capability APIs. */
function ai_manga_viewer_settings_feature_state( $feature_id, $features, $capabilities ) {
	$unavailable = array( 'class' => 'is-unavailable', 'label' => __( 'Unavailable', 'mangafocus' ) );
	if ( empty( $features[ $feature_id ] ) || empty( $capabilities[ $feature_id ] ) || ! is_array( $capabilities[ $feature_id ] ) ) {
		return $unavailable;
	}

	$allowed = $capabilities[ $feature_id ];
	if ( in_array( $feature_id, array( 'panel_reader', 'cta' ), true ) ) {
		if ( ! empty( $allowed['runtime'] ) && ! empty( $allowed['editor'] ) ) {
			return array( 'class' => 'is-available', 'label' => __( 'Available', 'mangafocus' ) );
		}
		if ( ! empty( $allowed['runtime'] ) ) {
			return array( 'class' => 'is-limited', 'label' => __( 'Display active; editing unavailable', 'mangafocus' ) );
		}
	} elseif ( 'analytics' === $feature_id ) {
		if ( ! empty( $allowed['collection'] ) && ! empty( $allowed['report'] ) ) {
			return array( 'class' => 'is-available', 'label' => __( 'Available', 'mangafocus' ) );
		}
		if ( ! empty( $allowed['collection'] ) ) {
			return array( 'class' => 'is-limited', 'label' => __( 'Collection active; reports unavailable', 'mangafocus' ) );
		}
	} elseif ( in_array( $feature_id, array( 'ai_consultation', 'manga_creation' ), true ) && ! empty( $allowed['admin'] ) ) {
		return array( 'class' => 'is-available', 'label' => __( 'Available', 'mangafocus' ) );
	}

	return $unavailable;
}

/** Render one validated feature-state badge. */
function ai_manga_viewer_settings_feature_badge( $state ) {
	$classes = array( 'is-available', 'is-limited', 'is-unavailable' );
	$class   = is_array( $state ) && in_array( $state['class'] ?? '', $classes, true ) ? $state['class'] : 'is-unavailable';
	$label   = is_array( $state ) && isset( $state['label'] ) ? $state['label'] : __( 'Unavailable', 'mangafocus' );
	return '<span class="amv-settings__status ' . esc_attr( $class ) . '">' . esc_html( $label ) . '</span>';
}

/** Render the Core-owned status and navigation hub. */
function ai_manga_viewer_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to view this screen.', 'mangafocus' ) );
	}

	$features      = ai_manga_viewer_get_feature_map();
	$capabilities  = function_exists( 'ai_manga_viewer_get_capability_map' ) ? ai_manga_viewer_get_capability_map() : array();
	$pro           = ai_manga_viewer_get_pro_status();
	$retention     = function_exists( 'ai_manga_viewer_sanitize_retention_days' ) ? ai_manga_viewer_sanitize_retention_days( get_option( 'ai_manga_viewer_analytics_retention_days', '90' ) ) : 90;
	$library_url   = admin_url( 'edit.php?post_type=amv_viewer' );
	$new_url       = admin_url( 'post-new.php?post_type=amv_viewer' );
	$analytics_url = add_query_arg(
		array(
			'post_type' => 'amv_viewer',
			'page'      => 'ai-manga-viewer-analytics',
		),
		admin_url( 'edit.php' )
	);
	$pro_label = $pro['active'] ? __( 'Active', 'mangafocus' ) : ( $pro['installed'] ? __( 'Unavailable', 'mangafocus' ) : __( 'Not installed or inactive', 'mangafocus' ) );
	$feature_states = array();
	foreach ( array( 'panel_reader', 'cta', 'analytics', 'ai_consultation', 'manga_creation' ) as $feature_id ) {
		$feature_states[ $feature_id ] = ai_manga_viewer_settings_feature_state( $feature_id, $features, $capabilities );
	}
	/* translators: %d: analytics data retention period in days. */
	$retention_label = sprintf( __( '%d days', 'mangafocus' ), (int) $retention );
	?>
	<div class="wrap amv-settings">
		<h1><?php echo esc_html__( 'MangaFocus Settings', 'mangafocus' ); ?></h1>
		<p class="amv-settings__lead"><?php echo esc_html__( 'Review product status and open comic management or analytics settings.', 'mangafocus' ); ?></p>

		<div class="amv-settings__grid">
			<section class="amv-settings__card" aria-labelledby="amv-settings-product">
				<h2 id="amv-settings-product"><?php echo esc_html__( 'MangaFocus', 'mangafocus' ); ?></h2>
				<dl class="amv-settings__definition">
					<div><dt><?php echo esc_html__( 'Core version', 'mangafocus' ); ?></dt><dd><?php echo esc_html( ai_manga_viewer_get_version() ); ?></dd></div>
					<div><dt><?php echo esc_html__( 'Pro version', 'mangafocus' ); ?></dt><dd><?php echo '' !== $pro['version'] ? esc_html( $pro['version'] ) : esc_html__( '—', 'mangafocus' ); ?></dd></div>
					<div><dt><?php echo esc_html__( 'Pro status', 'mangafocus' ); ?></dt><dd><?php echo wp_kses_post( ai_manga_viewer_settings_badge( $pro['active'], __( 'Active', 'mangafocus' ), $pro_label ) ); ?></dd></div>
				</dl>
			</section>

			<section class="amv-settings__card" aria-labelledby="amv-settings-library">
				<h2 id="amv-settings-library"><?php echo esc_html__( 'Manga', 'mangafocus' ); ?></h2>
				<p><?php echo esc_html__( 'Manage reusable comics in Manga Library.', 'mangafocus' ); ?></p>
				<p class="amv-settings__actions"><a class="button button-primary" href="<?php echo esc_url( $library_url ); ?>"><?php echo esc_html__( 'Open Manga Library', 'mangafocus' ); ?></a> <a class="button" href="<?php echo esc_url( $new_url ); ?>"><?php echo esc_html__( 'Register a new comic', 'mangafocus' ); ?></a></p>
			</section>

			<section class="amv-settings__card" aria-labelledby="amv-settings-data">
				<h2 id="amv-settings-data"><?php echo esc_html__( 'Analytics & Data', 'mangafocus' ); ?></h2>
				<dl class="amv-settings__definition">
					<div><dt><?php echo esc_html__( 'Detailed data retention', 'mangafocus' ); ?></dt><dd><?php echo esc_html( $retention_label ); ?></dd></div>
						<div><dt><?php echo esc_html__( 'Manga Analytics', 'mangafocus' ); ?> <span class="amv-settings__pro">Pro</span></dt><dd><?php echo wp_kses_post( ai_manga_viewer_settings_feature_badge( $feature_states['analytics'] ) ); ?></dd></div>
				</dl>
				<p><?php echo esc_html__( 'Manage collection, retention, and deletion from the dedicated Analytics Settings screen.', 'mangafocus' ); ?></p>
				<p class="amv-settings__actions"><a class="button" href="<?php echo esc_url( $analytics_url ); ?>"><?php echo esc_html__( 'Open Analytics Settings', 'mangafocus' ); ?></a> <a href="<?php echo esc_url( $analytics_url . '#amv-analytics-delete' ); ?>"><?php echo esc_html__( 'Review analytics data deletion', 'mangafocus' ); ?></a></p>
			</section>

			<section class="amv-settings__card" aria-labelledby="amv-settings-features">
				<h2 id="amv-settings-features"><?php echo esc_html__( 'Features', 'mangafocus' ); ?></h2>
				<ul class="amv-settings__features">
					<li><span><strong><?php echo esc_html__( 'Free Viewer', 'mangafocus' ); ?></strong><small><?php echo esc_html__( 'Paged reading, spreads, page focus, fullscreen, vertical reading, zoom, Panel-by-Panel, Manga Library', 'mangafocus' ); ?></small></span><?php echo wp_kses_post( ai_manga_viewer_settings_badge( true ) ); ?></li>
					<li><span><strong><?php echo esc_html__( 'Panel-by-Panel', 'mangafocus' ); ?></strong><small><?php echo esc_html__( 'Enlarge panels in sequence with Panel-by-Panel reading', 'mangafocus' ); ?></small></span><?php echo wp_kses_post( ai_manga_viewer_settings_feature_badge( $feature_states['panel_reader'] ) ); ?></li>
					<?php
					$feature_labels = array(
						'cta'            => __( 'CTA', 'mangafocus' ),
						'analytics'      => __( 'Manga Analytics', 'mangafocus' ),
						'ai_consultation' => __( 'AI consultation', 'mangafocus' ),
						'manga_creation'  => __( 'AI manga production support', 'mangafocus' ),
					);
					foreach ( $feature_labels as $feature_id => $label ) :
						?>
						<li><span><strong><?php echo esc_html( $label ); ?></strong> <span class="amv-settings__pro">Pro</span></span><?php echo wp_kses_post( ai_manga_viewer_settings_feature_badge( $feature_states[ $feature_id ] ) ); ?></li>
					<?php endforeach; ?>
				</ul>
			</section>
		</div>
		<?php do_action( 'ai_manga_viewer_settings_sections', array( 'features' => $features, 'pro' => $pro ) ); ?>
	</div>
	<?php
}
