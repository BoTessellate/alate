/**
 * Plugin Bridge Types
 * Type definitions for external platform integrations
 */

/**
 * Supported plugin platforms
 */
export type PluginPlatform = 'canva' | 'figma' | 'shopify' | 'woocommerce' | 'csv' | 'wix' | 'pinterest';

/**
 * Plugin authentication credentials
 */
export interface PluginAuthCredentials {
  platform: PluginPlatform;
  api_key?: string;
  access_token?: string;
  shop_domain?: string;
  user_id?: string;
  plugin_version?: string;
}

/**
 * Plugin authentication result
 */
export interface PluginAuthResult {
  authenticated: boolean;
  user_id?: string;
  platform: PluginPlatform;
  error?: string;
}

/**
 * Canva search request
 */
export interface CanvaSearchRequest {
  query?: string;
  tags?: string[];
  category?: string;
  region?: string;
  limit?: number;
}

/**
 * Canva search response
 */
export interface CanvaSearchResponse {
  success: boolean;
  products: CanvaProduct[];
  count: number;
  query: CanvaSearchRequest;
}

/**
 * Canva product format
 */
export interface CanvaProduct {
  id: string;
  product_name: string;
  brand: string;
  category: string;
  tags: string[];
  color_palette: string[];
  image_url?: string;
  thumbnail_url?: string;
}

/**
 * Canva insert request
 */
export interface CanvaInsertRequest {
  product_ids: string[];
  layout_type?: string;
  canvas_size?: {
    width: number;
    height: number;
  };
  format?: 'json' | 'image';
}

/**
 * Canva insert response
 */
export interface CanvaInsertResponse {
  success: boolean;
  layout?: any;
  image_url?: string;
  elements?: any[];
  error?: string;
}

/**
 * Commerce platform product (raw)
 */
export interface CommerceProduct {
  id?: string;
  name: string;
  price: number;
  category?: string;
  image_url?: string;
  sku?: string;
  description?: string;
  variants?: any[];
  tags?: string[];
}

/**
 * Shopify product
 */
export interface ShopifyProduct extends CommerceProduct {
  shopify_id: string;
  handle: string;
  product_type?: string;
  vendor?: string;
}

/**
 * WooCommerce product
 */
export interface WooCommerceProduct extends CommerceProduct {
  woo_id: number;
  permalink?: string;
  status?: string;
}

/**
 * Sync request from commerce platform
 */
export interface CommerceSyncRequest {
  platform: 'shopify' | 'woocommerce';
  shop_domain: string;
  api_key: string;
  products?: CommerceProduct[];
  webhook_data?: any;
}

/**
 * Sync response
 */
export interface CommerceSyncResponse {
  success: boolean;
  synced_count: number;
  enriched_count: number;
  failed_count: number;
  errors?: string[];
  sync_id?: string;
  timestamp: string;
}

/**
 * Sync status log
 */
export interface SyncStatusLog {
  sync_id: string;
  platform: PluginPlatform;
  shop_domain?: string;
  started_at: string;
  completed_at?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_products: number;
  synced_count: number;
  enriched_count: number;
  failed_count: number;
  errors?: string[];
}
