/**
 * Shopify OAuth Callback Handler
 * Separate endpoint required because Shopify doesn't allow query params in redirect URLs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import {
  getShopifyConfig,
  exchangeCodeForToken,
  verifyCallbackHmac,
  encryptToken,
  sanitizeShopDomain,
  getISTTimestamp,
} from '../sdk/shopify';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[CALLBACK] Handler started');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shop, code, state, hmac } = req.query as Record<string, string>;
    console.log('[CALLBACK] Params:', { shop, hasCode: !!code, hasHmac: !!hmac });

    if (!shop || !code || !hmac) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'OAuth callback requires shop, code, and hmac parameters',
      });
    }

    const config = getShopifyConfig();
    const shopDomain = sanitizeShopDomain(shop);
    console.log('[CALLBACK] Shop domain:', shopDomain);

    // Verify HMAC
    const queryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        queryParams[key] = value;
      }
    }

    if (!verifyCallbackHmac(queryParams, config.apiSecret)) {
      console.error('[CALLBACK] HMAC verification failed');
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }
    console.log('[CALLBACK] HMAC verified');

    // Exchange code for access token
    console.log('[CALLBACK] Exchanging code for token...');
    const tokenResponse = await exchangeCodeForToken(config, shopDomain, code);
    console.log('[CALLBACK] Got token, scope:', tokenResponse.scope);

    // Encrypt and store the token
    const encryptedToken = encryptToken(tokenResponse.access_token, config.encryptionKey);
    console.log('[CALLBACK] Token encrypted');

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[CALLBACK] Saving session to database...');

    // Use upsert to handle both new and existing sessions
    const { error: insertError, data: insertData } = await supabase
      .from('shopify_sessions')
      .upsert({
        shop_domain: shopDomain,
        access_token: encryptedToken,
        scope: tokenResponse.scope,
        updated_at: getISTTimestamp(),
      }, {
        onConflict: 'shop_domain',
      })
      .select();

    console.log('[CALLBACK] Insert result:', { error: insertError, data: insertData });
    const upsertError = insertError;
    const upsertData = insertData;

    if (upsertError) {
      console.error('[CALLBACK] Failed to store session:', upsertError);
      return res.status(500).json({ error: 'Failed to store session', details: upsertError });
    }

    console.log('[CALLBACK] Session saved successfully!');

    // Show debug info if debug=1 query param, otherwise redirect
    if (req.query.debug === '1') {
      return res.status(200).send(`
        <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>✅ OAuth Callback Successful!</h1>
          <p><strong>Shop:</strong> ${shopDomain}</p>
          <p><strong>Scope:</strong> ${tokenResponse.scope}</p>
          <p><strong>Session saved:</strong> Yes</p>
          <p><a href="${config.appUrl.trim()}/api/shopify?shop=${encodeURIComponent(shopDomain)}">Continue to App →</a></p>
        </body>
        </html>
      `);
    }

    // Redirect to the embedded app in Shopify admin
    // Extract store name from shop domain (e.g., "store-1-2352745" from "store-1-2352745.myshopify.com")
    const storeName = shopDomain.replace('.myshopify.com', '');
    const embeddedAppUrl = `https://admin.shopify.com/store/${storeName}/apps/the-mood-layer`;
    console.log('[CALLBACK] Redirecting to embedded app:', embeddedAppUrl);
    return res.redirect(302, embeddedAppUrl);
  } catch (error) {
    console.error('[CALLBACK] Error:', error);
    // Show error details in HTML for easier debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    return res.status(500).send(`
      <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h1>❌ OAuth Callback Failed</h1>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${errorStack}</pre>
      </body>
      </html>
    `);
  }
}
