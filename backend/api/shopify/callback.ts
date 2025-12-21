/**
 * Shopify OAuth Callback Endpoint
 * GET /api/shopify/callback?code=...&shop=...&state=...&hmac=...
 *
 * Completes OAuth flow, stores access token, and triggers initial sync
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  verifyCallbackHmac,
  exchangeCodeForToken,
  encryptToken,
  sanitizeShopDomain,
  getShopifyConfig,
  createShopifyClient,
} from '../../sdk/shopify';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, shop, state, hmac } = req.query;

    // Validate required parameters
    if (!code || !shop || !state || !hmac) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'OAuth callback requires code, shop, state, and hmac',
      });
    }

    const shopDomain = sanitizeShopDomain(shop as string);
    const config = getShopifyConfig();

    // Verify HMAC
    const queryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        queryParams[key] = value;
      }
    }

    if (!verifyCallbackHmac(queryParams, config.apiSecret)) {
      return res.status(401).json({
        error: 'Invalid HMAC',
        message: 'OAuth callback verification failed',
      });
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );

    // Verify state matches stored nonce
    const { data: session, error: sessionError } = await supabase
      .from('shopify_sessions')
      .select('state_nonce')
      .eq('shop_domain', shopDomain)
      .single();

    if (sessionError || !session) {
      return res.status(401).json({
        error: 'Invalid session',
        message: 'No pending OAuth session found for this shop',
      });
    }

    if (session.state_nonce !== state) {
      return res.status(401).json({
        error: 'Invalid state',
        message: 'OAuth state mismatch - possible CSRF attack',
      });
    }

    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(
      config,
      shopDomain,
      code as string
    );

    // Encrypt and store access token
    const encryptedToken = encryptToken(tokenResponse.access_token, config.encryptionKey);

    const { error: updateError } = await supabase
      .from('shopify_sessions')
      .update({
        access_token: encryptedToken,
        scope: tokenResponse.scope,
        is_online: !!tokenResponse.associated_user,
        expires_at: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
          : null,
        associated_user: tokenResponse.associated_user || null,
        state_nonce: null, // Clear state after successful auth
        updated_at: new Date().toISOString(),
      })
      .eq('shop_domain', shopDomain);

    if (updateError) {
      console.error('Failed to store session:', updateError);
      return res.status(500).json({ error: 'Failed to store session' });
    }

    // Register webhooks
    try {
      const client = createShopifyClient({
        shopDomain,
        accessToken: tokenResponse.access_token,
        apiVersion: config.apiVersion,
      });

      const webhookUrl = `${config.appUrl}/api/shopify/webhooks`;

      // Register product webhooks
      await client.registerWebhook('products/create', webhookUrl);
      await client.registerWebhook('products/update', webhookUrl);
      await client.registerWebhook('products/delete', webhookUrl);
      await client.registerWebhook('app/uninstalled', webhookUrl);

      console.log(`Webhooks registered for ${shopDomain}`);
    } catch (webhookError) {
      console.error('Failed to register webhooks:', webhookError);
      // Don't fail the OAuth - webhooks can be registered later
    }

    // Redirect to success page
    const successUrl = `${config.appUrl}/shopify/success?shop=${encodeURIComponent(shopDomain)}`;

    // For now, return JSON with success (frontend can handle redirect)
    return res.status(200).json({
      success: true,
      shop_domain: shopDomain,
      message: 'Successfully connected to Shopify',
      redirect_url: successUrl,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      error: 'OAuth callback failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
