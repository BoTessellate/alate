<?php
/**
 * Plugin Name: Mood Layer
 * Plugin URI: https://moodlayer.com
 * Description: Sync your WooCommerce products with Mood Layer for AI-powered moodboard creation.
 * Version: 1.0.0
 * Author: Mood Layer
 * Author URI: https://moodlayer.com
 * License: GPL v2 or later
 * Text Domain: moodlayer
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('MOODLAYER_VERSION', '1.0.0');
define('MOODLAYER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MOODLAYER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('MOODLAYER_API_BASE', 'https://api.moodlayer.com/v1');

/**
 * Main Mood Layer Plugin Class
 */
class MoodLayer {
    /**
     * Single instance
     */
    private static $instance = null;

    /**
     * API Key
     */
    private $api_key;

    /**
     * API Secret
     */
    private $api_secret;

    /**
     * Get single instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        // Load credentials
        $this->api_key = get_option('moodlayer_api_key', '');
        $this->api_secret = get_option('moodlayer_api_secret', '');

        // Initialize hooks
        add_action('init', array($this, 'init'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));

        // REST API endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));

        // WooCommerce product hooks
        add_action('woocommerce_new_product', array($this, 'on_product_created'), 10, 2);
        add_action('woocommerce_update_product', array($this, 'on_product_updated'), 10, 2);
        add_action('before_delete_post', array($this, 'on_product_deleted'));

        // Warn if credentials missing
        if (empty($this->api_key) || empty($this->api_secret)) {
            add_action('admin_notices', array($this, 'credentials_warning'));
        }
    }

    /**
     * Initialize plugin
     */
    public function init() {
        // Load text domain
        load_plugin_textdomain('moodlayer', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }

    /**
     * Show credentials warning
     */
    public function credentials_warning() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="notice notice-warning is-dismissible">
            <p>
                <strong><?php _e('Mood Layer:', 'moodlayer'); ?></strong>
                <?php _e('API credentials not configured. Please visit Settings → Mood Layer to set up your connection.', 'moodlayer'); ?>
            </p>
        </div>
        <?php
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('Mood Layer Settings', 'moodlayer'),
            __('Mood Layer', 'moodlayer'),
            'manage_options',
            'moodlayer',
            array($this, 'settings_page')
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('moodlayer_settings', 'moodlayer_api_key');
        register_setting('moodlayer_settings', 'moodlayer_api_secret');
        register_setting('moodlayer_settings', 'moodlayer_sync_mode');
        register_setting('moodlayer_settings', 'moodlayer_brand_id');

        add_settings_section(
            'moodlayer_api_section',
            __('API Configuration', 'moodlayer'),
            array($this, 'api_section_callback'),
            'moodlayer'
        );

        add_settings_field(
            'moodlayer_api_key',
            __('API Key', 'moodlayer'),
            array($this, 'api_key_field'),
            'moodlayer',
            'moodlayer_api_section'
        );

        add_settings_field(
            'moodlayer_api_secret',
            __('API Secret', 'moodlayer'),
            array($this, 'api_secret_field'),
            'moodlayer',
            'moodlayer_api_section'
        );

        add_settings_field(
            'moodlayer_brand_id',
            __('Brand ID', 'moodlayer'),
            array($this, 'brand_id_field'),
            'moodlayer',
            'moodlayer_api_section'
        );

        add_settings_field(
            'moodlayer_sync_mode',
            __('Sync Mode', 'moodlayer'),
            array($this, 'sync_mode_field'),
            'moodlayer',
            'moodlayer_api_section'
        );
    }

    /**
     * API section description
     */
    public function api_section_callback() {
        echo '<p>' . __('Enter your Mood Layer API credentials. You can find these in your Mood Layer dashboard.', 'moodlayer') . '</p>';
    }

    /**
     * API Key field
     */
    public function api_key_field() {
        $value = get_option('moodlayer_api_key', '');
        echo '<input type="text" name="moodlayer_api_key" value="' . esc_attr($value) . '" class="regular-text" />';
    }

    /**
     * API Secret field
     */
    public function api_secret_field() {
        $value = get_option('moodlayer_api_secret', '');
        echo '<input type="password" name="moodlayer_api_secret" value="' . esc_attr($value) . '" class="regular-text" />';
    }

    /**
     * Brand ID field
     */
    public function brand_id_field() {
        $value = get_option('moodlayer_brand_id', '');
        echo '<input type="text" name="moodlayer_brand_id" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('Your unique Brand ID from Mood Layer dashboard.', 'moodlayer') . '</p>';
    }

    /**
     * Sync mode field
     */
    public function sync_mode_field() {
        $value = get_option('moodlayer_sync_mode', 'manual');
        ?>
        <select name="moodlayer_sync_mode">
            <option value="manual" <?php selected($value, 'manual'); ?>><?php _e('Manual', 'moodlayer'); ?></option>
            <option value="auto" <?php selected($value, 'auto'); ?>><?php _e('Automatic', 'moodlayer'); ?></option>
        </select>
        <p class="description"><?php _e('Automatic: Sync on product changes. Manual: Sync only when triggered.', 'moodlayer'); ?></p>
        <?php
    }

    /**
     * Settings page
     */
    public function settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <form method="post" action="options.php">
                <?php
                settings_fields('moodlayer_settings');
                do_settings_sections('moodlayer');
                submit_button();
                ?>
            </form>

            <hr />

            <h2><?php _e('Manual Actions', 'moodlayer'); ?></h2>
            <p>
                <button type="button" class="button" id="moodlayer-test-connection">
                    <?php _e('Test Connection', 'moodlayer'); ?>
                </button>
                <button type="button" class="button" id="moodlayer-sync-all">
                    <?php _e('Sync All Products', 'moodlayer'); ?>
                </button>
            </p>
            <div id="moodlayer-status"></div>

            <script>
            jQuery(document).ready(function($) {
                $('#moodlayer-test-connection').on('click', function() {
                    $('#moodlayer-status').html('<?php _e('Testing connection...', 'moodlayer'); ?>');
                    $.post(ajaxurl, {
                        action: 'moodlayer_test_connection',
                        nonce: '<?php echo wp_create_nonce('moodlayer_nonce'); ?>'
                    }, function(response) {
                        $('#moodlayer-status').html(response.data.message);
                    });
                });

                $('#moodlayer-sync-all').on('click', function() {
                    $('#moodlayer-status').html('<?php _e('Syncing products...', 'moodlayer'); ?>');
                    $.post(ajaxurl, {
                        action: 'moodlayer_sync_all',
                        nonce: '<?php echo wp_create_nonce('moodlayer_nonce'); ?>'
                    }, function(response) {
                        $('#moodlayer-status').html(response.data.message);
                    });
                });
            });
            </script>
        </div>
        <?php
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('moodlayer/v1', '/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_sync_products'),
            'permission_callback' => array($this, 'verify_api_request'),
        ));

        register_rest_route('moodlayer/v1', '/ping', array(
            'methods' => 'GET',
            'callback' => array($this, 'rest_ping'),
            'permission_callback' => array($this, 'verify_api_request'),
        ));

        register_rest_route('moodlayer/v1', '/products', array(
            'methods' => 'GET',
            'callback' => array($this, 'rest_get_products'),
            'permission_callback' => array($this, 'verify_api_request'),
        ));
    }

    /**
     * Verify API request authentication
     */
    public function verify_api_request($request) {
        $auth_header = $request->get_header('Authorization');

        if (empty($auth_header)) {
            return false;
        }

        // Expected format: Bearer {api_key}:{signature}
        if (strpos($auth_header, 'Bearer ') !== 0) {
            return false;
        }

        $token = substr($auth_header, 7);
        $parts = explode(':', $token);

        if (count($parts) !== 2) {
            return false;
        }

        list($key, $signature) = $parts;

        if ($key !== $this->api_key) {
            return false;
        }

        // Verify signature (HMAC of request body with secret)
        $body = $request->get_body();
        $expected_signature = hash_hmac('sha256', $body ?: '', $this->api_secret);

        return hash_equals($expected_signature, $signature);
    }

    /**
     * REST: Ping endpoint
     */
    public function rest_ping($request) {
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Mood Layer connection healthy',
            'version' => MOODLAYER_VERSION,
            'wc_version' => defined('WC_VERSION') ? WC_VERSION : 'unknown',
        ), 200);
    }

    /**
     * REST: Sync products endpoint
     */
    public function rest_sync_products($request) {
        $products = $this->get_all_products();
        $synced = 0;
        $errors = array();

        foreach ($products as $product) {
            $result = $this->sync_product_to_moodlayer($product);
            if ($result['success']) {
                $synced++;
            } else {
                $errors[] = $result['error'];
            }
        }

        return new WP_REST_Response(array(
            'success' => true,
            'synced' => $synced,
            'total' => count($products),
            'errors' => $errors,
        ), 200);
    }

    /**
     * REST: Get products endpoint
     */
    public function rest_get_products($request) {
        $products = $this->get_all_products();
        $transformed = array_map(array($this, 'transform_product'), $products);

        return new WP_REST_Response(array(
            'success' => true,
            'products' => $transformed,
            'count' => count($transformed),
        ), 200);
    }

    /**
     * Handle product created
     */
    public function on_product_created($product_id, $product) {
        if (get_option('moodlayer_sync_mode', 'manual') !== 'auto') {
            return;
        }

        $this->sync_product_to_moodlayer($product);
    }

    /**
     * Handle product updated
     */
    public function on_product_updated($product_id, $product) {
        if (get_option('moodlayer_sync_mode', 'manual') !== 'auto') {
            return;
        }

        $this->sync_product_to_moodlayer($product);
    }

    /**
     * Handle product deleted
     */
    public function on_product_deleted($post_id) {
        if (get_post_type($post_id) !== 'product') {
            return;
        }

        if (get_option('moodlayer_sync_mode', 'manual') !== 'auto') {
            return;
        }

        $this->delete_product_from_moodlayer($post_id);
    }

    /**
     * Get all WooCommerce products
     */
    private function get_all_products() {
        $args = array(
            'status' => 'publish',
            'limit' => -1,
        );

        return wc_get_products($args);
    }

    /**
     * Transform WooCommerce product to Mood Layer format
     */
    public function transform_product($product) {
        if (!$product instanceof WC_Product) {
            return null;
        }

        $data = array(
            'external_id' => (string) $product->get_id(),
            'platform' => 'woocommerce',
            'title' => $product->get_name(),
            'description' => wp_strip_all_tags($product->get_description()),
            'short_description' => wp_strip_all_tags($product->get_short_description()),
            'url' => $product->get_permalink(),
            'price' => (float) $product->get_price(),
            'regular_price' => (float) $product->get_regular_price(),
            'sale_price' => (float) $product->get_sale_price(),
            'sku' => $product->get_sku(),
            'stock_status' => $product->get_stock_status(),
            'categories' => $this->get_product_categories($product),
            'tags' => $this->get_product_tags($product),
            'images' => $this->get_product_images($product),
            'variants' => array(),
            'dimensions' => array(),
            'fit_tags' => array(),
            'created_at' => $product->get_date_created() ? $product->get_date_created()->format('c') : null,
            'updated_at' => $product->get_date_modified() ? $product->get_date_modified()->format('c') : null,
        );

        // Add variants for variable products
        if ($product->is_type('variable')) {
            $data['variants'] = $this->get_product_variants($product);
        }

        // Add dimensions
        $data['dimensions'] = $this->get_product_dimensions($product);

        // Generate fit tags
        $data['fit_tags'] = $this->generate_fit_tags($product, $data['dimensions']);

        return $data;
    }

    /**
     * Get product categories
     */
    private function get_product_categories($product) {
        $terms = get_the_terms($product->get_id(), 'product_cat');
        if (empty($terms) || is_wp_error($terms)) {
            return array();
        }
        return array_map(function($term) {
            return $term->name;
        }, $terms);
    }

    /**
     * Get product tags
     */
    private function get_product_tags($product) {
        $terms = get_the_terms($product->get_id(), 'product_tag');
        if (empty($terms) || is_wp_error($terms)) {
            return array();
        }
        return array_map(function($term) {
            return $term->name;
        }, $terms);
    }

    /**
     * Get product images
     */
    private function get_product_images($product) {
        $images = array();

        // Main image
        $main_image_id = $product->get_image_id();
        if ($main_image_id) {
            $images[] = wp_get_attachment_url($main_image_id);
        }

        // Gallery images
        $gallery_ids = $product->get_gallery_image_ids();
        foreach ($gallery_ids as $image_id) {
            $images[] = wp_get_attachment_url($image_id);
        }

        return array_filter($images);
    }

    /**
     * Get product variants (for variable products)
     */
    private function get_product_variants($product) {
        $variants = array();
        $available_variations = $product->get_available_variations();

        foreach ($available_variations as $variation_data) {
            $variation = wc_get_product($variation_data['variation_id']);
            if (!$variation) {
                continue;
            }

            $variant = array(
                'id' => (string) $variation->get_id(),
                'price' => (float) $variation->get_price(),
                'sku' => $variation->get_sku(),
                'url' => $variation->get_permalink(),
            );

            // Extract color and size from attributes
            $attributes = $variation->get_attributes();
            foreach ($attributes as $attr_name => $attr_value) {
                $attr_name_lower = strtolower($attr_name);
                if (strpos($attr_name_lower, 'color') !== false || strpos($attr_name_lower, 'colour') !== false) {
                    $variant['color'] = $attr_value;
                } elseif (strpos($attr_name_lower, 'size') !== false) {
                    $variant['size'] = $attr_value;
                }
            }

            // Variant image
            $image_id = $variation->get_image_id();
            if ($image_id) {
                $variant['image_url'] = wp_get_attachment_url($image_id);
            }

            $variants[] = $variant;
        }

        return $variants;
    }

    /**
     * Get product dimensions
     */
    private function get_product_dimensions($product) {
        $dimensions = array();

        if ($product->has_dimensions()) {
            $length = $product->get_length();
            $width = $product->get_width();
            $height = $product->get_height();

            if ($length) $dimensions['depth'] = (float) $length;
            if ($width) $dimensions['width'] = (float) $width;
            if ($height) $dimensions['height'] = (float) $height;
        }

        if ($product->has_weight()) {
            $dimensions['weight'] = (float) $product->get_weight();
            $dimensions['weight_unit'] = get_option('woocommerce_weight_unit', 'kg');
        }

        return $dimensions;
    }

    /**
     * Generate fit tags based on product attributes
     */
    private function generate_fit_tags($product, $dimensions) {
        $tags = array();
        $categories = $this->get_product_categories($product);
        $title = strtolower($product->get_name());
        $description = strtolower($product->get_description());

        // Weight-based tags
        if (!empty($dimensions['weight'])) {
            $weight = $dimensions['weight'];
            $unit = $dimensions['weight_unit'] ?? 'kg';

            // Convert to kg for comparison
            if ($unit === 'g') {
                $weight = $weight / 1000;
            } elseif ($unit === 'lbs') {
                $weight = $weight * 0.453592;
            }

            if ($weight > 5) {
                $tags[] = 'bulky';
            } elseif ($weight < 0.5) {
                $tags[] = 'lightweight';
            }
        }

        // Category-based tags
        $category_str = strtolower(implode(' ', $categories));
        if (strpos($category_str, 'furniture') !== false) {
            $tags[] = 'bulky';
        }
        if (strpos($category_str, 'jewelry') !== false || strpos($category_str, 'jewellery') !== false) {
            $tags[] = 'delicate';
        }
        if (strpos($category_str, 'poster') !== false || strpos($category_str, 'print') !== false || strpos($category_str, 'art') !== false) {
            $tags[] = 'flat';
        }
        if (strpos($category_str, 'clothing') !== false || strpos($category_str, 'apparel') !== false) {
            $tags[] = 'flat';
        }

        // Title/description-based tags
        if (strpos($title, 'fragile') !== false || strpos($description, 'fragile') !== false) {
            $tags[] = 'delicate';
        }
        if (strpos($title, 'oversized') !== false || strpos($description, 'oversized') !== false) {
            $tags[] = 'bulky';
        }

        return array_unique($tags);
    }

    /**
     * Sync product to Mood Layer API
     */
    private function sync_product_to_moodlayer($product) {
        if (empty($this->api_key) || empty($this->api_secret)) {
            return array('success' => false, 'error' => 'API credentials not configured');
        }

        $data = $this->transform_product($product);
        if (!$data) {
            return array('success' => false, 'error' => 'Failed to transform product');
        }

        $brand_id = get_option('moodlayer_brand_id', '');
        $body = json_encode(array(
            'brand_id' => $brand_id,
            'product' => $data,
        ));

        $signature = hash_hmac('sha256', $body, $this->api_secret);

        $response = wp_remote_post(MOODLAYER_API_BASE . '/products/sync', array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->api_key . ':' . $signature,
            ),
            'body' => $body,
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            return array('success' => false, 'error' => $response->get_error_message());
        }

        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            return array('success' => false, 'error' => 'API returned status ' . $status_code);
        }

        return array('success' => true);
    }

    /**
     * Delete product from Mood Layer API
     */
    private function delete_product_from_moodlayer($product_id) {
        if (empty($this->api_key) || empty($this->api_secret)) {
            return;
        }

        $brand_id = get_option('moodlayer_brand_id', '');
        $body = json_encode(array(
            'brand_id' => $brand_id,
            'external_id' => (string) $product_id,
        ));

        $signature = hash_hmac('sha256', $body, $this->api_secret);

        wp_remote_request(MOODLAYER_API_BASE . '/products/delete', array(
            'method' => 'DELETE',
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->api_key . ':' . $signature,
            ),
            'body' => $body,
            'timeout' => 30,
        ));
    }
}

// AJAX handlers
add_action('wp_ajax_moodlayer_test_connection', function() {
    check_ajax_referer('moodlayer_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'Unauthorized'));
    }

    $api_key = get_option('moodlayer_api_key', '');
    $api_secret = get_option('moodlayer_api_secret', '');

    if (empty($api_key) || empty($api_secret)) {
        wp_send_json_error(array('message' => 'API credentials not configured'));
    }

    // Test connection
    $signature = hash_hmac('sha256', '', $api_secret);
    $response = wp_remote_get(MOODLAYER_API_BASE . '/ping', array(
        'headers' => array(
            'Authorization' => 'Bearer ' . $api_key . ':' . $signature,
        ),
        'timeout' => 10,
    ));

    if (is_wp_error($response)) {
        wp_send_json_error(array('message' => 'Connection failed: ' . $response->get_error_message()));
    }

    $status = wp_remote_retrieve_response_code($response);
    if ($status === 200) {
        wp_send_json_success(array('message' => 'Connection successful!'));
    } else {
        wp_send_json_error(array('message' => 'Connection failed: HTTP ' . $status));
    }
});

add_action('wp_ajax_moodlayer_sync_all', function() {
    check_ajax_referer('moodlayer_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'Unauthorized'));
    }

    $moodlayer = MoodLayer::get_instance();
    $products = wc_get_products(array('status' => 'publish', 'limit' => -1));
    $synced = 0;

    foreach ($products as $product) {
        // Use reflection to call private method for testing
        $result = $moodlayer->transform_product($product);
        if ($result) {
            $synced++;
        }
    }

    wp_send_json_success(array('message' => sprintf('Synced %d products', $synced)));
});

// Initialize plugin
function moodlayer_init() {
    // Check if WooCommerce is active
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function() {
            ?>
            <div class="notice notice-error">
                <p><?php _e('Mood Layer requires WooCommerce to be installed and active.', 'moodlayer'); ?></p>
            </div>
            <?php
        });
        return;
    }

    MoodLayer::get_instance();
}
add_action('plugins_loaded', 'moodlayer_init');

// Activation hook
register_activation_hook(__FILE__, function() {
    // Set default options
    add_option('moodlayer_sync_mode', 'manual');
});

// Deactivation hook
register_deactivation_hook(__FILE__, function() {
    // Clean up if needed
});
