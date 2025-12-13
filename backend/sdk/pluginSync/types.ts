/**
 * Plugin Sync Types
 * Type definitions for product catalog syncing
 */

/**
 * Sync source platforms
 */
export type SyncSource = 'shopify' | 'woocommerce' | 'csv' | 'manual';

/**
 * Normalized product input
 */
export interface NormalizedProductInput {
  name: string;
  brand: string;
  category: string;
  price: number;
  image_url?: string;
  region?: string;
  sku?: string;
  tags?: string[];
}

/**
 * Sync request
 */
export interface SyncRequest {
  source: SyncSource;
  brand: string;
  products: NormalizedProductInput[];
  user_id?: string;
}

/**
 * Sync response
 */
export interface SyncResponse {
  success: boolean;
  sync_id: string;
  total_products: number;
  synced_count: number;
  enriched_count: number;
  failed_count: number;
  errors?: string[];
  timestamp: string;
}

/**
 * Sync status
 */
export interface SyncStatus {
  sync_id: string;
  source: SyncSource;
  brand: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  total_products: number;
  synced_count: number;
  enriched_count: number;
  failed_count: number;
  errors?: string[];
}

/**
 * CSV product row
 */
export interface CSVProductRow {
  name: string;
  brand: string;
  category: string;
  price: string | number;
  image_url?: string;
  region?: string;
  sku?: string;
  tags?: string;
}
