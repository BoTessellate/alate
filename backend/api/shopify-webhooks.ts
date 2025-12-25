/**
 * Shopify Webhooks Handler
 * Separate endpoint required because Shopify doesn't allow query params in webhook URLs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  getShopifyConfig,
  verifyWebhookHmac,
  handleProductWebhook,
  handleProductDeleteWebhook,
} from '../sdk/shopify';

// Disable body parsing to get raw body for HMAC verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
  const rawBody = await getRawBody(req);
  const config = getShopifyConfig();

  if (!verifyWebhookHmac(rawBody, hmac, config.apiSecret)) {
    console.warn(`Invalid webhook HMAC from ${shopDomain} for topic ${topic}`);
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  // Parse the body now that HMAC is verified
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_KEY!;

  // Process webhook BEFORE returning (serverless functions terminate after response)
  try {
    switch (topic) {
      case 'products/create':
      case 'products/update':
        await handleProductWebhook(supabaseUrl, supabaseKey, shopDomain, body);
        break;
      case 'products/delete':
        await handleProductDeleteWebhook(supabaseUrl, supabaseKey, shopDomain, body.id.toString());
        break;
      case 'inventory_levels/update':
        // Inventory changes - log for now, full sync will catch them
        console.log(`Inventory update for ${shopDomain}: item ${body.inventory_item_id} now has ${body.available} units`);
        break;
      case 'app/uninstalled':
        // TEMPORARILY DISABLED: Session deletion was causing race conditions
        // The uninstall webhook often arrives after reinstall, deleting the new session
        // TODO: Re-enable with longer grace period or different approach once OAuth is stable
        console.log(`App uninstalled webhook for ${shopDomain} - session deletion DISABLED for debugging`);
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }
    return res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error(`Error processing ${topic} webhook:`, error);
    return res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
  }
}
