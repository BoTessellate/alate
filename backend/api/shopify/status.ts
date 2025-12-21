/**
 * Shopify Integration Status Endpoint
 * GET /api/shopify/status?shop=store.myshopify.com
 *
 * Returns connection and sync status for a shop
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getShopSyncStatus, sanitizeShopDomain, isValidShopDomain } from '../../sdk/shopify';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shop } = req.query;

    // Validate shop parameter
    if (!shop || typeof shop !== 'string') {
      return res.status(400).json({
        error: 'Missing shop parameter',
        message: 'Please provide ?shop=your-store.myshopify.com',
      });
    }

    const shopDomain = sanitizeShopDomain(shop);
    if (!isValidShopDomain(shopDomain)) {
      return res.status(400).json({
        error: 'Invalid shop domain',
        message: 'Shop domain must be in format: store-name.myshopify.com',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    // Get sync status
    const status = await getShopSyncStatus(supabaseUrl, supabaseKey, shopDomain);

    // Get recent sync history
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: recentSyncs } = await supabase
      .from('shopify_sync_logs')
      .select('sync_id, status, products_synced, started_at, completed_at, duration_ms')
      .eq('shop_domain', shopDomain)
      .order('started_at', { ascending: false })
      .limit(5);

    return res.status(200).json({
      ...status,
      recent_syncs: recentSyncs || [],
    });
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      error: 'Status check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
