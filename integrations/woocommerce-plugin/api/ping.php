<?php
/**
 * Mood Layer - Ping API Endpoint
 *
 * This file handles the /moodlayer/v1/ping REST endpoint.
 * Used for health checks and connection verification.
 *
 * Note: This is included for reference. The actual REST endpoint
 * is registered in moodlayer.php via register_rest_route().
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Ping Handler Class
 */
class MoodLayer_Ping_Handler {
    /**
     * Handle ping request
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function handle_ping($request) {
        global $wp_version;

        // Basic health info
        $response = array(
            'success' => true,
            'message' => 'Mood Layer connection healthy',
            'timestamp' => current_time('c'),
            'plugin' => array(
                'name' => 'Mood Layer',
                'version' => MOODLAYER_VERSION,
            ),
            'environment' => array(
                'wordpress' => $wp_version,
                'woocommerce' => defined('WC_VERSION') ? WC_VERSION : 'unknown',
                'php' => phpversion(),
            ),
        );

        // Add configuration status
        $response['configuration'] = array(
            'api_key_set' => !empty(get_option('moodlayer_api_key', '')),
            'api_secret_set' => !empty(get_option('moodlayer_api_secret', '')),
            'brand_id_set' => !empty(get_option('moodlayer_brand_id', '')),
            'sync_mode' => get_option('moodlayer_sync_mode', 'manual'),
        );

        // Add product stats
        $total = wp_count_posts('product');
        $response['products'] = array(
            'total' => isset($total->publish) ? $total->publish : 0,
            'draft' => isset($total->draft) ? $total->draft : 0,
        );

        // Check if WooCommerce is properly configured
        $response['woocommerce'] = array(
            'active' => class_exists('WooCommerce'),
            'currency' => get_woocommerce_currency(),
            'weight_unit' => get_option('woocommerce_weight_unit', 'kg'),
            'dimension_unit' => get_option('woocommerce_dimension_unit', 'cm'),
        );

        return new WP_REST_Response($response, 200);
    }

    /**
     * Detailed health check
     *
     * @return array
     */
    public static function detailed_health_check() {
        $health = array(
            'status' => 'healthy',
            'checks' => array(),
        );

        // Check 1: WooCommerce active
        $health['checks']['woocommerce'] = array(
            'name' => 'WooCommerce Active',
            'status' => class_exists('WooCommerce') ? 'pass' : 'fail',
            'message' => class_exists('WooCommerce') ? 'WooCommerce is active' : 'WooCommerce not found',
        );

        // Check 2: API credentials
        $api_key = get_option('moodlayer_api_key', '');
        $api_secret = get_option('moodlayer_api_secret', '');
        $health['checks']['credentials'] = array(
            'name' => 'API Credentials',
            'status' => (!empty($api_key) && !empty($api_secret)) ? 'pass' : 'warn',
            'message' => (!empty($api_key) && !empty($api_secret))
                ? 'API credentials configured'
                : 'API credentials missing - configure in Settings',
        );

        // Check 3: REST API available
        $health['checks']['rest_api'] = array(
            'name' => 'REST API',
            'status' => 'pass',
            'message' => 'REST API endpoints registered',
        );

        // Check 4: Products available
        $total = wp_count_posts('product');
        $product_count = isset($total->publish) ? $total->publish : 0;
        $health['checks']['products'] = array(
            'name' => 'Products Available',
            'status' => $product_count > 0 ? 'pass' : 'warn',
            'message' => $product_count > 0
                ? sprintf('%d products available for sync', $product_count)
                : 'No published products found',
        );

        // Check 5: PHP version
        $php_version = phpversion();
        $php_ok = version_compare($php_version, '7.4', '>=');
        $health['checks']['php'] = array(
            'name' => 'PHP Version',
            'status' => $php_ok ? 'pass' : 'warn',
            'message' => sprintf('PHP %s', $php_version),
        );

        // Check 6: Memory limit
        $memory_limit = ini_get('memory_limit');
        $memory_bytes = wp_convert_hr_to_bytes($memory_limit);
        $memory_ok = $memory_bytes >= 128 * 1024 * 1024; // 128MB minimum
        $health['checks']['memory'] = array(
            'name' => 'Memory Limit',
            'status' => $memory_ok ? 'pass' : 'warn',
            'message' => sprintf('Memory limit: %s', $memory_limit),
        );

        // Determine overall status
        $has_fail = false;
        $has_warn = false;
        foreach ($health['checks'] as $check) {
            if ($check['status'] === 'fail') {
                $has_fail = true;
            } elseif ($check['status'] === 'warn') {
                $has_warn = true;
            }
        }

        if ($has_fail) {
            $health['status'] = 'unhealthy';
        } elseif ($has_warn) {
            $health['status'] = 'degraded';
        }

        return $health;
    }
}

/**
 * Register additional health check endpoint
 */
add_action('rest_api_init', function() {
    register_rest_route('moodlayer/v1', '/health', array(
        'methods' => 'GET',
        'callback' => function($request) {
            $health = MoodLayer_Ping_Handler::detailed_health_check();
            $status_code = $health['status'] === 'healthy' ? 200 :
                          ($health['status'] === 'degraded' ? 200 : 503);
            return new WP_REST_Response($health, $status_code);
        },
        'permission_callback' => '__return_true', // Public endpoint
    ));
});
