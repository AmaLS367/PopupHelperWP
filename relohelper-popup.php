<?php
/**
 * Plugin Name: ReloHelper Popup
 * Description: Lightweight popup for WordPress. Injects a single #popup-root mount and enqueues JS/CSS. Text and visual content live in /assets/content and are selected via JS config.
 * Version: 1.0.0
 * Author: Ama
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: MIT
 * Text Domain: relohelper-popup
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Define immutable plugin constants for reuse.
 */
if ( ! defined( 'RHP_VERSION' ) ) {
    define( 'RHP_VERSION', '1.0.0' );
}
if ( ! defined( 'RHP_DIR' ) ) {
    define( 'RHP_DIR', plugin_dir_path( __FILE__ ) );
}
if ( ! defined( 'RHP_URL' ) ) {
    define( 'RHP_URL', plugin_dir_url( __FILE__ ) );
}

/**
 * Render a single mount point for the popup.
 * No modal HTML is rendered here; JS will attach to #popup-root.
 */
function rhp_render_root() : void {
    echo '<div id="popup-root" style="display:block"></div>';
}
add_action( 'wp_footer', 'rhp_render_root' );

/**
 * Enqueue frontend assets with cache-busting versions.
 * Versions are derived from filemtime and fall back to plugin version.
 */
function rhp_enqueue_assets() : void {
    if ( is_admin() ) {
        return;
    }

    $css_path  = RHP_DIR . 'assets/css/popup.css';
    $css_url   = RHP_URL . 'assets/css/popup.css';
    $css_ver   = file_exists( $css_path ) ? (string) filemtime( $css_path ) : RHP_VERSION;

    $helpers_path  = RHP_DIR . 'utils/helpers.js';
    $helpers_url   = RHP_URL . 'utils/helpers.js';
    $helpers_ver   = file_exists( $helpers_path ) ? (string) filemtime( $helpers_path ) : RHP_VERSION;

    $config_path = RHP_DIR . 'assets/js/config.js';
    $config_url  = RHP_URL . 'assets/js/config.js';
    $config_ver  = file_exists( $config_path ) ? (string) filemtime( $config_path ) : RHP_VERSION;

    $state_path = RHP_DIR . 'assets/js/state.js';
    $state_url  = RHP_URL . 'assets/js/state.js';
    $state_ver  = file_exists( $state_path ) ? (string) filemtime( $state_path ) : RHP_VERSION;

    $triggers_path = RHP_DIR . 'assets/js/triggers.js';
    $triggers_url  = RHP_URL . 'assets/js/triggers.js';
    $triggers_ver  = file_exists( $triggers_path ) ? (string) filemtime( $triggers_path ) : RHP_VERSION;

    $popup_path = RHP_DIR . 'assets/js/popup.js';
    $popup_url  = RHP_URL . 'assets/js/popup.js';
    $popup_ver  = file_exists( $popup_path ) ? (string) filemtime( $popup_path ) : RHP_VERSION;

    // CSS
    wp_enqueue_style( 'rhp-popup-css', $css_url, array(), $css_ver );

    // JS (keep explicit order)
    wp_enqueue_script( 'rhp-helpers',  $helpers_url,  array(), $helpers_ver, true );
    wp_enqueue_script( 'rhp-config',   $config_url,   array(), $config_ver,  true );
    wp_enqueue_script( 'rhp-state',    $state_url,    array(), $state_ver,   true );
    wp_enqueue_script( 'rhp-triggers', $triggers_url, array(), $triggers_ver,true );
    wp_enqueue_script( 'rhp-popup',    $popup_url,    array( 'rhp-helpers', 'rhp-config', 'rhp-state', 'rhp-triggers' ), $popup_ver, true );

    // Provide base URLs and REST route to JS without hardcoding.
    wp_localize_script(
        'rhp-popup',
        'RHP_BOOT',
        array(
            'baseUrl'      => untrailingslashit( RHP_URL ),
            'assetsUrl'    => untrailingslashit( RHP_URL ) . '/assets',
            'contentRoute' => esc_url_raw( rest_url( 'rhp/v1/content' ) ),
        )
    );
}
add_action( 'wp_enqueue_scripts', 'rhp_enqueue_assets', 20 );

/**
 * Validate content filename to avoid directory traversal and unsupported types.
 * Allowed: .json, .txt from /assets/content only.
 */
function rhp_validate_content_file( string $file ) : ?string {
    $file = wp_basename( $file ); // strips any path fragments
    if ( $file === '' ) {
        return null;
    }
    // Simple allow-list
    if ( ! preg_match( '/^[a-z0-9._-]+$/i', $file ) ) {
        return null;
    }
    if ( ! preg_match( '/\.(json|txt)$/i', $file ) ) {
        return null;
    }
    return $file;
}

// Serve static content files from assets/content via REST.
function rhp_register_rest_routes() : void {
    register_rest_route(
        'rhp/v1',
        '/content',
        array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => function ( WP_REST_Request $request ) {
                $file = (string) $request->get_param( 'file' );
                $file = rhp_validate_content_file( $file );
                if ( $file === null ) {
                    return new WP_REST_Response( array( 'error' => 'Invalid file name.' ), 400 );
                }

                $full = RHP_DIR . 'assets/content/' . $file;
                if ( ! file_exists( $full ) || ! is_file( $full ) ) {
                    return new WP_REST_Response( array( 'error' => 'Not found.' ), 404 );
                }

                // Disable caching during edits; adjust max-age if needed later.
                nocache_headers();

                $ext = strtolower( pathinfo( $full, PATHINFO_EXTENSION ) );
                $ctype = ( $ext === 'json' )
                    ? 'application/json; charset=utf-8'
                    : 'text/plain; charset=utf-8';

                header( 'Content-Type: ' . $ctype );
                readfile( $full );
                exit;
            },
            'args' => array(
                'file' => array(
                    'required' => true,
                    'type'     => 'string',
                ),
            ),
        )
    );
}
add_action( 'rest_api_init', 'rhp_register_rest_routes' );

/**
 * Load translations only if /languages exists.
 * Safe to keep Text Domain and Domain Path in the header even without actual files.
 */
function rhp_load_textdomain() : void {
    $languages_dir = dirname( plugin_basename( __FILE__ ) ) . '/languages';

    if ( is_dir( plugin_dir_path( __FILE__ ) . 'languages' ) ) {
        load_plugin_textdomain(
            'relohelper-popup',
            false,
            $languages_dir
        );
    }
}
add_action( 'init', 'rhp_load_textdomain' );