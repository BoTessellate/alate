/**
 * Shopify-Specific Batch Enrichment
 * Enriches Shopify products with shop-specific queries
 *
 * Extracted from backend/api/shopify.ts (lines 708-1042)
 */

import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../../shared/logger';
import { enrichProduct } from './index';
import type { RawProduct } from './types';

const log = createModuleLogger('shopify-batch-enricher');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

export interface ShopifyProduct {
  id: string;
  product_name: string;
  brand?: string;
  category?: string;
  price?: number;
  image_url?: string;
  external_id?: string;
  shop_domain: string;
}

export interface ShopifyEnrichmentResult {
  success: boolean;
  message?: string;
  enriched_count: number;
  failed_count: number;
  enriched: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Enrich products for a specific Shopify shop
 * Sequential processing to respect rate limits
 */
export async function enrichShopifyProducts(
  shopDomain: string,
  options?: {
    limit?: number;
    productIds?: string[];
  }
): Promise<ShopifyEnrichmentResult> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const limit = options?.limit || 10;
  const productIds = options?.productIds;

  // Find products that need enrichment
  let query = supabase
    .from('enriched_products')
    .select('id, product_name, brand, category, price, image_url, external_id, shop_domain')
    .eq('shop_domain', shopDomain)
    .is('enriched_at', null)
    .limit(limit);

  if (productIds && Array.isArray(productIds) && productIds.length > 0) {
    query = supabase
      .from('enriched_products')
      .select('id, product_name, brand, category, price, image_url, external_id, shop_domain')
      .eq('shop_domain', shopDomain)
      .in('external_id', productIds)
      .limit(limit);
  }

  const { data: products, error: fetchError } = await query;

  if (fetchError) {
    log.error({ error: fetchError, shopDomain }, 'Failed to fetch products');
    throw new Error('Failed to fetch products');
  }

  if (!products || products.length === 0) {
    return {
      success: true,
      message: 'No products need enrichment',
      enriched_count: 0,
      failed_count: 0,
      enriched: [],
      failed: []
    };
  }

  log.info({ shopDomain, productCount: products.length }, 'Starting Shopify product enrichment');

  const enriched: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Process each product sequentially (rate limit protection)
  for (const product of products as ShopifyProduct[]) {
    try {
      log.info({ productId: product.id, productName: product.product_name }, 'Enriching product');

      // Use SDK enricher
      const enrichedProduct = await enrichProduct({
        name: product.product_name,
        brand: product.brand,
        price: product.price,
        image_url: product.image_url
      } as RawProduct);

      // Update in database
      const { error: updateError } = await supabase
        .from('enriched_products')
        .update({
          tags: enrichedProduct.tags || [],
          color_palette: enrichedProduct.color_palette || [],
          texture: enrichedProduct.texture || null,
          material: enrichedProduct.material || null,
          tone: enrichedProduct.tone || null,
          enriched_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      enriched.push(product.id);
      log.info({ productId: product.id }, 'Product enriched successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push({ id: product.id, error: errorMessage });
      log.error({ productId: product.id, error }, 'Failed to enrich product');
    }
  }

  log.info({
    shopDomain,
    enrichedCount: enriched.length,
    failedCount: failed.length
  }, 'Shopify enrichment complete');

  return {
    success: true,
    enriched_count: enriched.length,
    failed_count: failed.length,
    enriched,
    failed
  };
}

/**
 * Enrich products across all Shopify shops
 * Finds all shops with pending products and enriches them
 */
export async function enrichAllShopifyProducts(options?: {
  limit?: number;
}): Promise<{
  success: boolean;
  shops_processed: number;
  total_enriched: number;
  total_failed: number;
  details: Array<{ shop: string; enriched: number; failed: number }>;
}> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const limit = options?.limit || 10;

  // Find all shops with unenriched products
  const { data: shopsWithPending, error: shopsError } = await supabase
    .from('enriched_products')
    .select('shop_domain')
    .eq('platform', 'shopify')
    .is('enriched_at', null)
    .not('shop_domain', 'is', null);

  if (shopsError) {
    log.error({ error: shopsError }, 'Failed to query shops');
    throw new Error('Failed to query shops');
  }

  // Get unique shop domains
  const uniqueShops = [...new Set(shopsWithPending?.map(p => p.shop_domain) || [])];

  if (uniqueShops.length === 0) {
    log.info('No shops have products needing enrichment');
    return {
      success: true,
      shops_processed: 0,
      total_enriched: 0,
      total_failed: 0,
      details: []
    };
  }

  log.info({ shopCount: uniqueShops.length, shops: uniqueShops }, 'Found shops with pending products');

  const results: Array<{ shop: string; enriched: number; failed: number }> = [];
  let totalEnriched = 0;
  let totalFailed = 0;

  // Process each shop (sequential to avoid overwhelming the system)
  for (const shopDomain of uniqueShops) {
    try {
      const result = await enrichShopifyProducts(shopDomain, { limit });

      results.push({
        shop: shopDomain,
        enriched: result.enriched_count,
        failed: result.failed_count
      });

      totalEnriched += result.enriched_count;
      totalFailed += result.failed_count;
    } catch (error) {
      log.error({ shopDomain, error }, 'Failed to process shop');
      results.push({
        shop: shopDomain,
        enriched: 0,
        failed: limit
      });
      totalFailed += limit;
    }
  }

  log.info({
    shopsProcessed: uniqueShops.length,
    totalEnriched,
    totalFailed
  }, 'All shops enrichment complete');

  return {
    success: true,
    shops_processed: uniqueShops.length,
    total_enriched: totalEnriched,
    total_failed: totalFailed,
    details: results
  };
}
