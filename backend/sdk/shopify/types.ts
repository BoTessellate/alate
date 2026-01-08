/**
 * Shopify SDK Types
 * TypeScript interfaces for Shopify integration
 */

// ============================================================================
// Shopify GraphQL Types
// ============================================================================

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ShopifyGraphQLProduct {
  id: string; // gid://shopify/Product/123
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
  images: {
    edges: Array<{
      node: ShopifyImage;
    }>;
  };
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
  options: ShopifyProductOption[];
  metafields?: {
    edges: Array<{
      node: ShopifyMetafield;
    }>;
  };
}

export interface ShopifyImage {
  id: string;
  src: string;
  altText: string | null;
  width?: number;
  height?: number;
}

export interface ShopifyVariant {
  id: string; // gid://shopify/ProductVariant/123
  title: string;
  price: string;
  compareAtPrice: string | null;
  sku: string | null;
  barcode: string | null;
  inventoryQuantity: number | null;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
  weight: number | null;
  weightUnit: 'KILOGRAMS' | 'GRAMS' | 'POUNDS' | 'OUNCES';
  image: { src: string } | null;
  metafields?: {
    edges: Array<{
      node: ShopifyMetafield;
    }>;
  };
}

export interface ShopifyProductOption {
  id: string;
  name: string;
  values: string[];
}

// ============================================================================
// Session & Auth Types
// ============================================================================

export interface ShopifySession {
  id: string;
  shop_domain: string;
  access_token: string; // Encrypted
  scope: string;
  is_online: boolean;
  expires_at?: string;
  associated_user?: ShopifyUser;
  state_nonce?: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  account_owner: boolean;
  locale: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
  associated_user_scope?: string;
  associated_user?: ShopifyUser;
}

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookTopic =
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'app/uninstalled'
  | 'shop/update';

export interface WebhookPayload {
  topic: WebhookTopic;
  shop_domain: string;
  data: unknown;
  timestamp: string;
}

export interface ShopifyWebhookHeaders {
  'x-shopify-topic': string;
  'x-shopify-hmac-sha256': string;
  'x-shopify-shop-domain': string;
  'x-shopify-api-version': string;
  'x-shopify-webhook-id': string;
}

// ============================================================================
// Sync Types
// ============================================================================

export interface SyncRequest {
  shop_domain: string;
  product_ids?: string[]; // Optional: sync specific products only
  force?: boolean; // Force re-sync even if recently synced
}

export interface SyncResult {
  success: boolean;
  sync_id: string;
  shop_domain: string;
  products_synced: number;
  products_enriched: number;
  products_failed: number;
  errors: SyncError[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

export interface SyncError {
  product_id: string;
  product_name?: string;
  error: string;
  stage: 'fetch' | 'transform' | 'enrich' | 'save';
}

export interface SyncStatus {
  shop_domain: string;
  is_connected: boolean;
  last_sync_at?: string;
  last_sync_status?: 'success' | 'partial' | 'failed';
  total_products: number;
  synced_products: number;
  pending_sync: boolean;
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

export interface BulkOperationStatus {
  id: string;
  status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  errorCode?: string;
  objectCount?: number;
  url?: string; // URL to download results (JSONL)
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  apiVersion: string;
  scopes: string[];
  appUrl: string;
  encryptionKey: string;
}

export interface ShopifyClientConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

// ============================================================================
// Transformation Types
// ============================================================================

export interface TransformOptions {
  shopDomain: string;
  includeVariants?: boolean;
  includeDimensions?: boolean;
}

export interface TransformedProduct {
  product_name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  image_url?: string;
  product_url: string;
  external_id: string;
  platform: 'shopify';
  shop_domain: string;
  variants?: TransformedVariant[];
  product_dimensions?: ProductDimensions;
  _metadata: {
    description: string;
    tags: string[];
    handle: string;
    status: string;
    all_images: string[];
  };
}

export interface TransformedVariant {
  id: string;
  url: string;
  price: number;
  sku?: string;
  color?: string;
  size?: string;
  image_url?: string;
}

export interface ProductDimensions {
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  weight_unit?: 'kg' | 'g' | 'lbs' | 'oz';
  // Sizing info extracted from metafields
  size_chart?: SizeChartEntry[];
  fit_info?: string;
  material_info?: string;
  care_instructions?: string;
}

export interface SizeChartEntry {
  size: string;
  measurements?: {
    chest?: string;
    waist?: string;
    hips?: string;
    length?: string;
    inseam?: string;
    shoulders?: string;
    sleeve?: string;
    [key: string]: string | undefined;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ShopifyApiResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}
