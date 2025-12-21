/**
 * Shopify Product Sync
 * Orchestrates fetching, transforming, enriching, and storing products
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createShopifyClient, ShopifyGraphQLClient } from './client';
import { transformShopifyProducts, generateFitTags, TransformedProduct } from './transformer';
import { decryptToken, getShopifyConfig } from './auth';
import type { SyncResult, SyncError, SyncStatus, ShopifySession } from './types';
import { callClaude, parseJSONFromResponse } from '../shared/secureAI';

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get shop session from database
 */
async function getShopSession(
  supabase: SupabaseClient,
  shopDomain: string
): Promise<ShopifySession | null> {
  const { data, error } = await supabase
    .from('shopify_sessions')
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !data) return null;
  return data as ShopifySession;
}

/**
 * Create Shopify client from session
 */
function createClientFromSession(
  session: ShopifySession,
  encryptionKey: string,
  apiVersion: string
): ShopifyGraphQLClient {
  const accessToken = decryptToken(session.access_token, encryptionKey);
  return createShopifyClient({
    shopDomain: session.shop_domain,
    accessToken,
    apiVersion,
  });
}

// ============================================================================
// Product Enrichment
// ============================================================================

interface EnrichmentResult {
  color_palette: string[];
  tags: string[];
  material: string;
  texture: string;
  tone: string;
}

/**
 * Enrich product using Claude AI
 */
async function enrichProduct(product: TransformedProduct): Promise<EnrichmentResult | null> {
  const prompt = `Analyze this product and extract style attributes. Return JSON only.

Product: ${product.product_name}
Brand: ${product.brand}
Category: ${product.category}
Description: ${product._metadata.description || 'No description'}
Tags: ${product._metadata.tags.join(', ') || 'None'}

Return this exact JSON structure:
{
  "color_palette": ["color1", "color2", "color3"],
  "tags": ["style tag 1", "style tag 2", "style tag 3"],
  "material": "primary material",
  "texture": "texture description",
  "tone": "warm/cool/neutral/earthy/etc"
}

For color_palette: List 2-4 colors that describe this product.
For tags: List 3-5 style keywords (e.g., "bohemian", "modern", "minimalist", "rustic").
For material: Infer the primary material if not stated (e.g., "wood", "fabric", "metal").
For texture: Describe the texture (e.g., "smooth", "woven", "matte", "glossy").
For tone: Describe the aesthetic mood.`;

  try {
    const response = await callClaude(prompt, { maxTokens: 300 });
    if (!response.success || !response.text) return null;

    const parsed = parseJSONFromResponse(response.text);
    if (!parsed) return null;

    return {
      color_palette: parsed.color_palette || [],
      tags: parsed.tags || [],
      material: parsed.material || '',
      texture: parsed.texture || '',
      tone: parsed.tone || '',
    };
  } catch (error) {
    console.error('Enrichment failed:', error);
    return null;
  }
}

/**
 * Enrich products in batches
 */
async function enrichProductBatch(
  products: TransformedProduct[],
  batchSize: number = 5
): Promise<Map<string, EnrichmentResult>> {
  const results = new Map<string, EnrichmentResult>();

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    // Process batch in parallel
    const enrichments = await Promise.all(
      batch.map(async (product) => {
        const enrichment = await enrichProduct(product);
        return { id: product.external_id, enrichment };
      })
    );

    for (const { id, enrichment } of enrichments) {
      if (enrichment) {
        results.set(id, enrichment);
      }
    }

    // Rate limiting: wait between batches
    if (i + batchSize < products.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return results;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Upsert products to database
 */
async function upsertProducts(
  supabase: SupabaseClient,
  products: TransformedProduct[],
  enrichments: Map<string, EnrichmentResult>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const product of products) {
    const enrichment = enrichments.get(product.external_id);
    const fitTags = generateFitTags(product);

    const dbProduct = {
      product_name: product.product_name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      currency: product.currency,
      image_url: product.image_url,
      external_id: product.external_id,
      platform: product.platform,
      shop_domain: product.shop_domain,
      variants: product.variants,
      product_dimensions: product.product_dimensions,
      fit_tags: fitTags,
      // Enriched fields
      color_palette: enrichment?.color_palette || [],
      tags: enrichment?.tags || [],
      material: enrichment?.material || null,
      texture: enrichment?.texture || null,
      tone: enrichment?.tone || null,
      // Metadata
      enriched_at: enrichment ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('enriched_products')
      .upsert(dbProduct, {
        onConflict: 'shop_domain,external_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`Failed to upsert product ${product.external_id}:`, error);
      failed++;
    } else {
      success++;
    }
  }

  return { success, failed };
}

/**
 * Delete product from database
 */
async function deleteProduct(
  supabase: SupabaseClient,
  shopDomain: string,
  externalId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('enriched_products')
    .delete()
    .eq('shop_domain', shopDomain)
    .eq('external_id', externalId);

  return !error;
}

// ============================================================================
// Main Sync Functions
// ============================================================================

export interface SyncOptions {
  supabaseUrl: string;
  supabaseKey: string;
  productIds?: string[];
  skipEnrichment?: boolean;
  onProgress?: (stage: string, current: number, total: number) => void;
}

/**
 * Sync products from a Shopify store
 */
export async function syncShopProducts(
  shopDomain: string,
  options: SyncOptions
): Promise<SyncResult> {
  const startTime = Date.now();
  const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const errors: SyncError[] = [];

  const supabase = createClient(options.supabaseUrl, options.supabaseKey);
  const config = getShopifyConfig();

  // Get shop session
  const session = await getShopSession(supabase, shopDomain);
  if (!session) {
    return {
      success: false,
      sync_id: syncId,
      shop_domain: shopDomain,
      products_synced: 0,
      products_enriched: 0,
      products_failed: 0,
      errors: [{ product_id: '', error: 'Shop not connected', stage: 'fetch' }],
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    };
  }

  const client = createClientFromSession(session, config.encryptionKey, config.apiVersion);

  // Fetch products
  options.onProgress?.('fetch', 0, 100);
  let shopifyProducts;
  try {
    if (options.productIds?.length) {
      // Fetch specific products
      shopifyProducts = await Promise.all(
        options.productIds.map((id) => client.getProductById(id))
      );
      shopifyProducts = shopifyProducts.filter((p) => p !== null);
    } else {
      // Fetch all products
      shopifyProducts = await client.getAllProducts((fetched, total) => {
        options.onProgress?.('fetch', fetched, total);
      });
    }
  } catch (error) {
    return {
      success: false,
      sync_id: syncId,
      shop_domain: shopDomain,
      products_synced: 0,
      products_enriched: 0,
      products_failed: 0,
      errors: [
        {
          product_id: '',
          error: error instanceof Error ? error.message : 'Failed to fetch products',
          stage: 'fetch',
        },
      ],
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    };
  }

  // Transform products
  options.onProgress?.('transform', 0, shopifyProducts.length);
  const transformed = transformShopifyProducts(shopifyProducts as any, {
    shopDomain,
    includeVariants: true,
    includeDimensions: true,
  });
  options.onProgress?.('transform', transformed.length, shopifyProducts.length);

  // Enrich products (unless skipped)
  let enrichments = new Map<string, EnrichmentResult>();
  if (!options.skipEnrichment) {
    options.onProgress?.('enrich', 0, transformed.length);
    enrichments = await enrichProductBatch(transformed, 5);
    options.onProgress?.('enrich', enrichments.size, transformed.length);
  }

  // Save to database
  options.onProgress?.('save', 0, transformed.length);
  const { success, failed } = await upsertProducts(supabase, transformed, enrichments);
  options.onProgress?.('save', success, transformed.length);

  return {
    success: failed === 0,
    sync_id: syncId,
    shop_domain: shopDomain,
    products_synced: success,
    products_enriched: enrichments.size,
    products_failed: failed,
    errors,
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
  };
}

/**
 * Get sync status for a shop
 */
export async function getShopSyncStatus(
  supabaseUrl: string,
  supabaseKey: string,
  shopDomain: string
): Promise<SyncStatus> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check session exists
  const session = await getShopSession(supabase, shopDomain);

  // Count synced products
  const { count: syncedCount } = await supabase
    .from('enriched_products')
    .select('*', { count: 'exact', head: true })
    .eq('shop_domain', shopDomain);

  return {
    shop_domain: shopDomain,
    is_connected: !!session,
    total_products: syncedCount || 0,
    synced_products: syncedCount || 0,
    pending_sync: false,
  };
}

/**
 * Handle product webhook (create/update)
 */
export async function handleProductWebhook(
  supabaseUrl: string,
  supabaseKey: string,
  shopDomain: string,
  productData: any
): Promise<void> {
  // Sync the single product
  const productId = productData.admin_graphql_api_id || `gid://shopify/Product/${productData.id}`;

  await syncShopProducts(shopDomain, {
    supabaseUrl,
    supabaseKey,
    productIds: [productId],
  });
}

/**
 * Handle product delete webhook
 */
export async function handleProductDeleteWebhook(
  supabaseUrl: string,
  supabaseKey: string,
  shopDomain: string,
  productId: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  await deleteProduct(supabase, shopDomain, productId.toString());
}
