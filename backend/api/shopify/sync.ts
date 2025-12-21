/**
 * Shopify Product Sync Endpoint
 * POST /api/shopify/sync
 *
 * Triggers manual product sync for a connected shop
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { syncShopProducts, sanitizeShopDomain } from '../../sdk/shopify';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shop, product_ids, skip_enrichment } = req.body;

    // Validate shop parameter
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        error: 'Missing shop parameter',
        message: 'Request body must include "shop" field',
      });
    }

    const shopDomain = sanitizeShopDomain(shop);
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    // Verify shop is connected
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: session } = await supabase
      .from('shopify_sessions')
      .select('shop_domain')
      .eq('shop_domain', shopDomain)
      .single();

    if (!session) {
      return res.status(401).json({
        error: 'Shop not connected',
        message: `No active connection for ${shopDomain}. Please install the app first.`,
      });
    }

    // Log sync start
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('shopify_sync_logs').insert({
      sync_id: syncId,
      shop_domain: shopDomain,
      status: 'started',
      started_at: new Date().toISOString(),
    });

    // Start sync (this may take a while for large catalogs)
    const result = await syncShopProducts(shopDomain, {
      supabaseUrl,
      supabaseKey,
      productIds: product_ids,
      skipEnrichment: skip_enrichment,
      onProgress: (stage, current, total) => {
        console.log(`Sync ${syncId}: ${stage} - ${current}/${total}`);
      },
    });

    // Update sync log
    await supabase
      .from('shopify_sync_logs')
      .update({
        status: result.success ? 'completed' : 'failed',
        products_synced: result.products_synced,
        products_enriched: result.products_enriched,
        products_failed: result.products_failed,
        error_details: result.errors.length > 0 ? { errors: result.errors } : null,
        completed_at: result.completed_at,
        duration_ms: result.duration_ms,
      })
      .eq('sync_id', syncId);

    return res.status(200).json({
      success: result.success,
      sync_id: result.sync_id,
      shop_domain: result.shop_domain,
      products_synced: result.products_synced,
      products_enriched: result.products_enriched,
      products_failed: result.products_failed,
      duration_ms: result.duration_ms,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
