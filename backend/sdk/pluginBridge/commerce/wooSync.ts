/**
 * WooCommerce Sync Module
 * Syncs products from WooCommerce stores
 */

import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductEnricher } from '../../productEnrichment/enrichProduct';
import { CommerceSyncRequest, CommerceSyncResponse, WooCommerceProduct, SyncStatusLog } from '../types';

/**
 * WooCommerce Sync Handler
 */
export class WooCommerceSyncHandler {
  private supabase: SupabaseClient;
  private enricher: ProductEnricher;

  constructor(supabaseUrl: string, supabaseKey: string, anthropicApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.enricher = new ProductEnricher({
      anthropicApiKey,
      supabaseUrl,
      supabaseKey
    });
  }

  /**
   * Sync products from WooCommerce
   */
  async syncProducts(request: CommerceSyncRequest): Promise<CommerceSyncResponse> {
    const syncId = this.generateSyncId();
    const startTime = new Date().toISOString();

    try {
      const { shop_domain, api_key, products: inlineProducts } = request;

      // Create sync log
      await this.createSyncLog({
        sync_id: syncId,
        platform: 'woocommerce',
        shop_domain,
        started_at: startTime,
        status: 'in_progress',
        total_products: 0,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0
      });

      let products: WooCommerceProduct[];

      // If products provided inline, use them
      if (inlineProducts && inlineProducts.length > 0) {
        products = inlineProducts as WooCommerceProduct[];
      } else {
        // Fetch products from WooCommerce API
        products = await this.fetchWooProducts(shop_domain, api_key);
      }

      // Update total count
      await this.updateSyncLog(syncId, {
        total_products: products.length
      });

      // Process products
      let syncedCount = 0;
      let enrichedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const product of products) {
        try {
          // Normalize to internal format
          const normalizedProduct = this.normalizeWooProduct(product);

          // Enrich and save
          await this.enricher.enrichAndSave(normalizedProduct);

          syncedCount++;
          enrichedCount++;

        } catch (error) {
          failedCount++;
          const errorMessage = `Failed to process ${product.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      // Update sync log
      await this.updateSyncLog(syncId, {
        completed_at: new Date().toISOString(),
        status: 'completed',
        synced_count: syncedCount,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined
      });

      return {
        success: true,
        synced_count: syncedCount,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined,
        sync_id: syncId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Mark sync as failed
      await this.updateSyncLog(syncId, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Sync failed']
      });

      return {
        success: false,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed'],
        sync_id: syncId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch products from WooCommerce REST API
   */
  private async fetchWooProducts(shopDomain: string, apiKey: string): Promise<WooCommerceProduct[]> {
    try {
      // Extract consumer key and secret from API key
      // Format: ck_XXXXX:cs_XXXXX
      const [consumerKey, consumerSecret] = apiKey.split(':');

      // WooCommerce REST API endpoint
      const apiUrl = `https://${shopDomain}/wp-json/wc/v3/products`;

      const response = await axios.get(apiUrl, {
        auth: {
          username: consumerKey,
          password: consumerSecret
        },
        params: {
          per_page: 100 // Fetch up to 100 products
        },
        timeout: 30000
      });

      const wooProducts = response.data || [];

      return wooProducts.map((p: any) => ({
        woo_id: p.id,
        name: p.name,
        price: parseFloat(p.price || '0'),
        category: p.categories[0]?.name || 'general',
        image_url: p.images[0]?.src,
        sku: p.sku,
        permalink: p.permalink,
        status: p.status,
        description: p.short_description,
        tags: p.tags?.map((t: any) => t.name) || []
      }));

    } catch (error) {
      console.error('WooCommerce API error:', error);
      throw new Error('Failed to fetch products from WooCommerce');
    }
  }

  /**
   * Normalize WooCommerce product to internal format
   */
  private normalizeWooProduct(product: WooCommerceProduct): any {
    return {
      product_name: product.name,
      brand: this.extractBrand(product),
      category: this.mapCategory(product.category),
      price: product.price,
      region: 'India', // Default, could be inferred from shop
      dimensions: undefined
    };
  }

  /**
   * Extract brand from WooCommerce product
   * Try to get from tags or use a default
   */
  private extractBrand(product: WooCommerceProduct): string {
    // Look for brand in tags
    const brandTag = product.tags?.find(tag =>
      tag.toLowerCase().includes('brand:')
    );

    if (brandTag) {
      return brandTag.split(':')[1]?.trim() || 'Unknown';
    }

    // Default to shop name or unknown
    return 'Unknown';
  }

  /**
   * Map WooCommerce category to internal category
   */
  private mapCategory(wooCategory?: string): string {
    if (!wooCategory) return 'general';

    const categoryMap: Record<string, string> = {
      'Home & Living': 'home-decor',
      'Furniture': 'furniture',
      'Kitchen & Dining': 'tableware',
      'Decor': 'home-decor',
      'Textiles & Rugs': 'textiles',
      'Rugs': 'rugs',
      'Lighting': 'lighting',
      'Storage & Organization': 'storage',
      'Art & Collectibles': 'art',
      'Clothing': 'fashion',
      'Accessories': 'fashion'
    };

    return categoryMap[wooCategory] || wooCategory.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `woo_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create sync log
   */
  private async createSyncLog(log: SyncStatusLog): Promise<void> {
    try {
      await this.supabase
        .from('plugin_sync_logs')
        .insert(log);
    } catch (error) {
      console.error('Failed to create sync log:', error);
    }
  }

  /**
   * Update sync log
   */
  private async updateSyncLog(syncId: string, updates: Partial<SyncStatusLog>): Promise<void> {
    try {
      await this.supabase
        .from('plugin_sync_logs')
        .update(updates)
        .eq('sync_id', syncId);
    } catch (error) {
      console.error('Failed to update sync log:', error);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(syncId: string): Promise<SyncStatusLog | null> {
    try {
      const { data, error } = await this.supabase
        .from('plugin_sync_logs')
        .select('*')
        .eq('sync_id', syncId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as SyncStatusLog;

    } catch (error) {
      console.error('Failed to get sync status:', error);
      return null;
    }
  }
}

/**
 * Create WooCommerce sync handler instance
 */
export function createWooCommerceSyncHandler(
  supabaseUrl: string,
  supabaseKey: string,
  anthropicApiKey: string
): WooCommerceSyncHandler {
  return new WooCommerceSyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
}
