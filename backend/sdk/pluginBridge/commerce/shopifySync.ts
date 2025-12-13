/**
 * Shopify Sync Module
 * Syncs products from Shopify stores
 */

import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductEnricher } from '../../productEnrichment/enrichProduct';
import { CommerceSyncRequest, CommerceSyncResponse, ShopifyProduct, SyncStatusLog } from '../types';

/**
 * Shopify Sync Handler
 */
export class ShopifySyncHandler {
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
   * Sync products from Shopify
   */
  async syncProducts(request: CommerceSyncRequest): Promise<CommerceSyncResponse> {
    const syncId = this.generateSyncId();
    const startTime = new Date().toISOString();

    try {
      const { shop_domain, api_key, products: inlineProducts } = request;

      // Create sync log
      await this.createSyncLog({
        sync_id: syncId,
        platform: 'shopify',
        shop_domain,
        started_at: startTime,
        status: 'in_progress',
        total_products: 0,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0
      });

      let products: ShopifyProduct[];

      // If products provided inline, use them
      if (inlineProducts && inlineProducts.length > 0) {
        products = inlineProducts as ShopifyProduct[];
      } else {
        // Fetch products from Shopify API
        products = await this.fetchShopifyProducts(shop_domain, api_key);
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
          const normalizedProduct = this.normalizeShopifyProduct(product);

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
   * Fetch products from Shopify API
   */
  private async fetchShopifyProducts(shopDomain: string, apiKey: string): Promise<ShopifyProduct[]> {
    try {
      // Shopify Admin API endpoint
      const apiUrl = `https://${shopDomain}/admin/api/2024-01/products.json`;

      const response = await axios.get(apiUrl, {
        headers: {
          'X-Shopify-Access-Token': apiKey
        },
        timeout: 30000
      });

      const shopifyProducts = response.data.products || [];

      return shopifyProducts.map((p: any) => ({
        shopify_id: p.id.toString(),
        handle: p.handle,
        name: p.title,
        price: parseFloat(p.variants[0]?.price || '0'),
        category: p.product_type || 'general',
        image_url: p.images[0]?.src,
        product_type: p.product_type,
        vendor: p.vendor,
        tags: p.tags ? p.tags.split(',').map((t: string) => t.trim()) : [],
        variants: p.variants
      }));

    } catch (error) {
      console.error('Shopify API error:', error);
      throw new Error('Failed to fetch products from Shopify');
    }
  }

  /**
   * Normalize Shopify product to internal format
   */
  private normalizeShopifyProduct(product: ShopifyProduct): any {
    return {
      product_name: product.name,
      brand: product.vendor || 'Unknown',
      category: this.mapCategory(product.category || product.product_type),
      price: product.price,
      region: 'India', // Default, could be inferred from shop
      dimensions: undefined
    };
  }

  /**
   * Map Shopify category to internal category
   */
  private mapCategory(shopifyCategory?: string): string {
    if (!shopifyCategory) return 'general';

    const categoryMap: Record<string, string> = {
      'Home & Garden': 'home-decor',
      'Furniture': 'furniture',
      'Kitchen': 'tableware',
      'Decor': 'home-decor',
      'Textiles': 'textiles',
      'Rugs': 'rugs',
      'Lighting': 'lighting',
      'Storage': 'storage',
      'Art': 'art',
      'Fashion': 'fashion'
    };

    return categoryMap[shopifyCategory] || shopifyCategory.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `shopify_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
 * Create Shopify sync handler instance
 */
export function createShopifySyncHandler(
  supabaseUrl: string,
  supabaseKey: string,
  anthropicApiKey: string
): ShopifySyncHandler {
  return new ShopifySyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
}
