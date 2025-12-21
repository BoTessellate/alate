/**
 * Shopify OAuth Initiate Endpoint
 * GET /api/shopify/auth?shop=store.myshopify.com
 *
 * Starts the OAuth flow by redirecting to Shopify's authorization page
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  isValidShopDomain,
  generateStateNonce,
  buildAuthUrl,
  sanitizeShopDomain,
  getShopifyConfig,
} from '../../sdk/shopify';

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

    // Sanitize and validate shop domain
    const shopDomain = sanitizeShopDomain(shop);
    if (!isValidShopDomain(shopDomain)) {
      return res.status(400).json({
        error: 'Invalid shop domain',
        message: 'Shop domain must be in format: store-name.myshopify.com',
      });
    }

    // Get Shopify config
    const config = getShopifyConfig();

    // Generate state nonce for CSRF protection
    const state = generateStateNonce();

    // Store state temporarily in Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );

    // Upsert state (in case shop is re-authenticating)
    const { error: stateError } = await supabase
      .from('shopify_sessions')
      .upsert(
        {
          shop_domain: shopDomain,
          state_nonce: state,
          access_token: '', // Will be filled on callback
          scope: '',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'shop_domain',
        }
      );

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError);
      return res.status(500).json({ error: 'Failed to initialize OAuth' });
    }

    // Build authorization URL
    const authUrl = buildAuthUrl(config, shopDomain, state);

    // Redirect to Shopify
    return res.redirect(302, authUrl);
  } catch (error) {
    console.error('OAuth init error:', error);
    return res.status(500).json({
      error: 'OAuth initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
