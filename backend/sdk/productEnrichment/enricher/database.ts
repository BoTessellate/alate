/**
 * Database Operations for Enriched Products
 * Handles saving enriched products to Supabase
 *
 * Extracted from backend/api/ai.ts (lines 874-919)
 */

import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../../shared/logger';
import type { EnrichedProduct } from './types';

const log = createModuleLogger('enricher-db');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

/**
 * Save enriched product to Supabase enriched_products table
 * Returns the saved product's database ID
 */
export async function saveEnrichedProduct(product: EnrichedProduct): Promise<{ id: string } | null> {
  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase not configured, skipping database save');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map to database schema
    const dbProduct = {
      product_name: product.name,
      brand: product.brand || null,
      category: product.category || 'general',
      price: product.price || null,
      color_palette: product.color_palette || [],
      tags: product.tags || [],
      texture: product.texture || null,
      material: product.material || null,
      tone: product.tone || null,
      vibe_layer: product.vibe_layer || null,
      pairs_with: product.pairs_with || [],
      image_url: product.image_url || null,
      source_url: product.source_url || null,
      enriched_at: product.enriched_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('enriched_products')
      .insert(dbProduct)
      .select('id')
      .single();

    if (error) {
      log.error({ error, product: product.name }, 'Failed to save to database');
      return null;
    }

    log.info({ id: data.id, product: product.name }, 'Product saved to enriched_products');
    return data;
  } catch (err) {
    log.error({ error: err }, 'Database save error');
    return null;
  }
}
