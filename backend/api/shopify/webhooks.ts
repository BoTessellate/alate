/**
 * Shopify Webhooks Endpoint
 * POST /api/shopify/webhooks
 *
 * Receives and processes Shopify webhooks for product changes
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  verifyWebhookHmac,
  getShopifyConfig,
  handleProductWebhook,
  handleProductDeleteWebhook,
} from '../../sdk/shopify';

// Webhook topic handlers
type WebhookHandler = (
  shopDomain: string,
  data: any,
  supabaseUrl: string,
  supabaseKey: string
) => Promise<void>;

const webhookHandlers: Record<string, WebhookHandler> = {
  'products/create': async (shopDomain, data, supabaseUrl, supabaseKey) => {
    console.log(`Product created in ${shopDomain}: ${data.id}`);
    await handleProductWebhook(supabaseUrl, supabaseKey, shopDomain, data);
  },

  'products/update': async (shopDomain, data, supabaseUrl, supabaseKey) => {
    console.log(`Product updated in ${shopDomain}: ${data.id}`);
    await handleProductWebhook(supabaseUrl, supabaseKey, shopDomain, data);
  },

  'products/delete': async (shopDomain, data, supabaseUrl, supabaseKey) => {
    console.log(`Product deleted in ${shopDomain}: ${data.id}`);
    await handleProductDeleteWebhook(supabaseUrl, supabaseKey, shopDomain, data.id.toString());
  },

  'app/uninstalled': async (shopDomain, _data, supabaseUrl, supabaseKey) => {
    console.log(`App uninstalled from ${shopDomain}`);
    // Clean up shop data
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete session
    await supabase.from('shopify_sessions').delete().eq('shop_domain', shopDomain);

    // Optionally: Delete or mark products as orphaned
    // For now, we keep products but they won't sync anymore
    console.log(`Cleaned up session for ${shopDomain}`);
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get webhook headers
    const topic = req.headers['x-shopify-topic'] as string;
    const hmac = req.headers['x-shopify-hmac-sha256'] as string;
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;

    if (!topic || !hmac || !shopDomain) {
      return res.status(400).json({
        error: 'Missing webhook headers',
        message: 'Required: x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain',
      });
    }

    // Get raw body for HMAC verification
    // Note: Vercel parses JSON automatically, so we need to stringify it back
    const rawBody = JSON.stringify(req.body);

    // Verify HMAC
    const config = getShopifyConfig();
    if (!verifyWebhookHmac(rawBody, hmac, config.apiSecret)) {
      console.warn(`Invalid webhook HMAC from ${shopDomain} for topic ${topic}`);
      return res.status(401).json({ error: 'Invalid HMAC' });
    }

    // Get handler for this topic
    const handler = webhookHandlers[topic];
    if (!handler) {
      console.log(`Unhandled webhook topic: ${topic}`);
      // Return 200 to acknowledge receipt (prevents retries)
      return res.status(200).json({ received: true, handled: false });
    }

    // Process webhook asynchronously
    // Return 200 immediately to prevent Shopify from retrying
    res.status(200).json({ received: true, handling: true });

    // Process in background
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    handler(shopDomain, req.body, supabaseUrl, supabaseKey).catch((error) => {
      console.error(`Error processing ${topic} webhook:`, error);
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retries for malformed requests
    return res.status(200).json({
      received: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Disable body parsing to get raw body for HMAC verification
export const config = {
  api: {
    bodyParser: true, // We'll handle raw body ourselves
  },
};
