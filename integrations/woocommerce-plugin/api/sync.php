<?php
/**
 * Mood Layer - Sync API Endpoint
 *
 * This file handles the /moodlayer/v1/sync REST endpoint.
 * It can be called externally to trigger a full product sync.
 *
 * Note: This is included for reference. The actual REST endpoint
 * is registered in moodlayer.php via register_rest_route().
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Sync Handler Class
 */
class MoodLayer_Sync_Handler {
    /**
     * Process sync request
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function handle_sync($request) {
        $params = $request->get_json_params();

        // Get sync options
        $product_ids = isset($params['product_ids']) ? $params['product_ids'] : null;
        $since = isset($params['since']) ? $params['since'] : null;
        $limit = isset($params['limit']) ? intval($params['limit']) : 100;
        $offset = isset($params['offset']) ? intval($params['offset']) : 0;

        // Build query args
        $args = array(
            'status' => 'publish',
            'limit' => $limit,
            'offset' => $offset,
            'orderby' => 'date',
            'order' => 'DESC',
        );

        // Filter by specific IDs
        if ($product_ids && is_array($product_ids)) {
            $args['include'] = array_map('intval', $product_ids);
        }

        // Filter by date
        if ($since) {
            $args['date_modified'] = '>' . $since;
        }

        // Get products
        $products = wc_get_products($args);
        $moodlayer = MoodLayer::get_instance();

        $synced = array();
        $errors = array();

        foreach ($products as $product) {
            try {
                $transformed = $moodlayer->transform_product($product);

                if ($transformed) {
                    $synced[] = array(
                        'id' => $transformed['external_id'],
                        'title' => $transformed['title'],
                        'variants_count' => count($transformed['variants']),
                        'fit_tags' => $transformed['fit_tags'],
                    );
                }
            } catch (Exception $e) {
                $errors[] = array(
                    'id' => $product->get_id(),
                    'error' => $e->getMessage(),
                );
            }
        }

        // Get total count for pagination
        $total_args = $args;
        $total_args['limit'] = -1;
        $total_args['return'] = 'ids';
        $total_products = wc_get_products($total_args);

        return new WP_REST_Response(array(
            'success' => true,
            'data' => array(
                'products' => $synced,
                'count' => count($synced),
                'total' => count($total_products),
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < count($total_products),
            ),
            'errors' => $errors,
        ), 200);
    }

    /**
     * Get sync status
     *
     * @return array
     */
    public static function get_sync_status() {
        $last_sync = get_option('moodlayer_last_sync', null);
        $sync_mode = get_option('moodlayer_sync_mode', 'manual');

        // Count products
        $total = wp_count_posts('product');
        $published = isset($total->publish) ? $total->publish : 0;

        // Count synced (products with moodlayer meta)
        global $wpdb;
        $synced_count = $wpdb->get_var(
            "SELECT COUNT(DISTINCT post_id) FROM {$wpdb->postmeta}
             WHERE meta_key = '_moodlayer_synced' AND meta_value = '1'"
        );

        return array(
            'sync_mode' => $sync_mode,
            'last_sync' => $last_sync,
            'total_products' => $published,
            'synced_products' => intval($synced_count),
            'pending' => $published - intval($synced_count),
        );
    }

    /**
     * Mark product as synced
     *
     * @param int $product_id
     */
    public static function mark_synced($product_id) {
        update_post_meta($product_id, '_moodlayer_synced', '1');
        update_post_meta($product_id, '_moodlayer_synced_at', current_time('mysql'));
    }

    /**
     * Mark product as pending sync
     *
     * @param int $product_id
     */
    public static function mark_pending($product_id) {
        update_post_meta($product_id, '_moodlayer_synced', '0');
    }

    /**
     * Get products pending sync
     *
     * @param int $limit
     * @return array
     */
    public static function get_pending_products($limit = 50) {
        $args = array(
            'status' => 'publish',
            'limit' => $limit,
            'meta_query' => array(
                'relation' => 'OR',
                array(
                    'key' => '_moodlayer_synced',
                    'compare' => 'NOT EXISTS',
                ),
                array(
                    'key' => '_moodlayer_synced',
                    'value' => '0',
                ),
            ),
        );

        return wc_get_products($args);
    }
}

/**
 * Hook into product save to mark as pending
 */
add_action('woocommerce_update_product', function($product_id) {
    MoodLayer_Sync_Handler::mark_pending($product_id);
}, 20);

add_action('woocommerce_new_product', function($product_id) {
    MoodLayer_Sync_Handler::mark_pending($product_id);
}, 20);
