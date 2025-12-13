/**
 * Plugin Sync API Endpoint
 * POST /api/pluginSync
 * GET /api/pluginSync/status/:syncId
 */

import { Request, Response } from 'express';
import { createShopifySyncHandler } from '../../syncShopify';
import { createWooCommerceSyncHandler } from '../../syncWoo';
import { createCSVSyncHandler } from '../../syncCSV';
import { SyncRequest } from '../../types';

/**
 * POST /api/pluginSync
 */
export async function pluginSyncHandler(req: Request, res: Response) {
  try {
    const syncRequest: SyncRequest = req.body;
    const { source, brand, products } = syncRequest;

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

    let result;

    switch (source) {
      case 'shopify':
        const shopifyHandler = createShopifySyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
        result = await shopifyHandler.syncProducts({
          platform: 'shopify',
          shop_domain: (req.body as any).shop_domain,
          api_key: (req.body as any).api_key,
          products
        });
        break;

      case 'woocommerce':
        const wooHandler = createWooCommerceSyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
        result = await wooHandler.syncProducts({
          platform: 'woocommerce',
          shop_domain: (req.body as any).shop_domain,
          api_key: (req.body as any).api_key,
          products
        });
        break;

      case 'csv':
      case 'manual':
        const csvHandler = createCSVSyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
        result = await csvHandler.syncFromProducts(products, brand);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported sync source: ${source}`
        });
    }

    res.json(result);

  } catch (error) {
    console.error('Plugin sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    });
  }
}

/**
 * GET /api/pluginSync/status/:syncId
 */
export async function getSyncStatusHandler(req: Request, res: Response) {
  try {
    const { syncId } = req.params;
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('plugin_sync_logs')
      .select('*')
      .eq('sync_id', syncId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Sync not found'
      });
    }

    res.json({
      success: true,
      status: data
    });

  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
}

/**
 * Setup plugin sync routes
 */
export function setupPluginSyncRoutes(app: any) {
  app.post('/api/pluginSync', pluginSyncHandler);
  app.get('/api/pluginSync/status/:syncId', getSyncStatusHandler);
}
