<?php
/** Public library rendering; deliberately separate from the editor's REST routes. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** WordPress publication rules; membership sites must protect REST through their own integration. */
function ai_manga_viewer_library_is_publicly_readable( $id ) {
    $post = get_post( absint( $id ) );
    if ( ! $post || 'amv_viewer' !== $post->post_type || 'publish' !== $post->post_status || '' !== (string) $post->post_password ) { return false; }
    // Existing integrations may deny access, but cannot override type/status/password checks.
    return true === apply_filters( 'ai_manga_viewer_library_public_access', true, $post->ID );
}

function ai_manga_viewer_get_public_library_viewer( $request ) {
    $id = absint( $request['id'] );
    if ( ! ai_manga_viewer_library_is_publicly_readable( $id ) ) { return new WP_Error( 'amv_library_unavailable', 'Comic unavailable.', array( 'status' => 404 ) ); }
    $markup = ai_manga_viewer_render_library_viewer( $id, 'runtime-' . wp_generate_uuid4() );
    if ( ! ai_manga_viewer_library_is_publicly_readable( $id ) || '' === trim( $markup ) ) { return new WP_Error( 'amv_library_unavailable', 'Comic unavailable.', array( 'status' => 404 ) ); }
    $response = new WP_REST_Response( array( 'schemaVersion' => 1, 'id' => $id, 'title' => wp_strip_all_tags( get_the_title( $id ) ), 'coverUrl' => ai_manga_viewer_library_cover_url( $id, 'medium' ) ?: '', 'html' => $markup ) );
    $response->header( 'Cache-Control', 'no-store, private' );
    return $response;
}

function ai_manga_viewer_register_library_runtime_route() {
    register_rest_route( 'ai-manga-viewer/v1', '/library-viewers/(?P<id>[1-9][0-9]*)', array(
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => function( $request ) { return ai_manga_viewer_library_is_publicly_readable( $request['id'] ) ? true : new WP_Error( 'amv_library_unavailable', 'Comic unavailable.', array( 'status' => 404 ) ); },
        'callback' => 'ai_manga_viewer_get_public_library_viewer',
        'args' => array( 'id' => array( 'required' => true, 'validate_callback' => function( $value ) { return is_scalar( $value ) && preg_match( '/^[1-9][0-9]*$/D', (string) $value ) && (string) (int) $value === (string) $value; } ) ),
    ) );
}
add_action( 'rest_api_init', 'ai_manga_viewer_register_library_runtime_route' );

/** Success and rejection responses must not be reused by a shared REST cache. */
add_filter( 'rest_post_dispatch', static function( $response, $server, $request ) {
    if ( preg_match( '~^/ai-manga-viewer/v1/library-viewers/|^/ai-manga-viewer-pro/v1/after-reading/runtime$~', $request->get_route() ) && method_exists( $response, 'header' ) ) {
        $response->header( 'Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0' );
        $headers = method_exists( $response, 'get_headers' ) ? $response->get_headers() : array();
        $vary = $headers['Vary'] ?? $headers['vary'] ?? '';
        $response->header( 'Vary', trim( (string) $vary . ', Cookie, Origin', ', ' ) );
    }
    return $response;
}, 100, 3 );
