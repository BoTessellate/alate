/**
 * Shopify Unified API Handler
 * Handles all Shopify routes: /api/shopify?action=auth|callback|status|sync|webhooks|app
 *
 * This consolidates multiple endpoints into one to stay within Vercel's function limits
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  getShopifyConfig,
  buildAuthUrl,
  generateStateNonce,
  exchangeCodeForToken,
  verifyCallbackHmac,
  verifyWebhookHmac,
  encryptToken,
  sanitizeShopDomain,
  isValidShopDomain,
  getShopSyncStatus,
  syncShopProducts,
  handleProductWebhook,
  handleProductDeleteWebhook,
} from '../sdk/shopify';

// Increase function timeout (requires Pro plan for >10s, hobby plan maxes at 10s)
export const config = {
  maxDuration: 60,
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://frontend-ramsaptamis-projects.vercel.app';
const APP_NAME = 'The Mood Layer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string || 'app';

  try {
    switch (action) {
      case 'auth':
        return handleAuth(req, res);
      case 'callback':
        return handleCallback(req, res);
      case 'status':
        return handleStatus(req, res);
      case 'sync':
        return handleSync(req, res);
      case 'webhooks':
        return handleWebhooks(req, res);
      case 'health':
        return handleHealth(req, res);
      case 'test-session':
        return handleTestSession(req, res);
      case 'app':
      default:
        return handleApp(req, res);
    }
  } catch (error) {
    console.error(`Shopify ${action} error:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// Auth Handler
// ============================================================================
async function handleAuth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop } = req.query;

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

  const config = getShopifyConfig();
  const state = generateStateNonce();
  const authUrl = buildAuthUrl(config, shopDomain, state);

  // Store state for verification (in production, use Redis or database)
  res.setHeader('Set-Cookie', `shopify_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

  return res.redirect(302, authUrl);
}

// ============================================================================
// Callback Handler
// ============================================================================
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop, code, state, hmac } = req.query as Record<string, string>;

  if (!shop || !code || !hmac) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'OAuth callback requires shop, code, and hmac parameters',
    });
  }

  const config = getShopifyConfig();
  const shopDomain = sanitizeShopDomain(shop);

  // Verify HMAC
  const queryParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      queryParams[key] = value;
    }
  }

  if (!verifyCallbackHmac(queryParams, config.apiSecret)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  // Exchange code for access token
  const tokenResponse = await exchangeCodeForToken(config, shopDomain, code);

  // Encrypt and store the token
  const encryptedToken = encryptToken(tokenResponse.access_token, config.encryptionKey);

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error: upsertError } = await supabase.from('shopify_sessions').upsert(
    {
      shop_domain: shopDomain,
      access_token: encryptedToken,
      scope: tokenResponse.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'shop_domain' }
  );

  if (upsertError) {
    console.error('Failed to store session:', upsertError);
    return res.status(500).json({ error: 'Failed to store session' });
  }

  // Redirect to the app dashboard
  const appUrl = `${config.appUrl}/api/shopify?action=app&shop=${encodeURIComponent(shopDomain)}`;
  return res.redirect(302, appUrl);
}

// ============================================================================
// Health Check Handler
// ============================================================================
async function handleHealth(req: VercelRequest, res: VercelResponse) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env_vars: {},
    supabase: {},
    sessions: {},
  };

  // Check required env vars (without revealing values)
  const requiredEnvVars = ['SHOPIFY_API_KEY', 'SHOPIFY_SECRET', 'APP_URL', 'SHOPIFY_TOKEN_ENCRYPTION_KEY', 'SUPABASE_URL', 'SUPABASE_KEY'];
  for (const v of requiredEnvVars) {
    const value = process.env[v];
    diagnostics.env_vars[v] = value ? `set (${value.length} chars)` : 'MISSING';
  }

  // Check encryption key format
  const encKey = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
  if (encKey) {
    diagnostics.env_vars.ENCRYPTION_KEY_FORMAT = encKey.length === 64 && /^[a-fA-F0-9]+$/.test(encKey) ? 'valid (64 hex chars)' : `invalid (${encKey.length} chars, expected 64 hex)`;
  }

  // Test Supabase connection
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if we can query the sessions table
    const { data, error, count } = await supabase
      .from('shopify_sessions')
      .select('shop_domain, updated_at', { count: 'exact' })
      .limit(5);

    if (error) {
      diagnostics.supabase.status = 'error';
      diagnostics.supabase.error = error.message;
      diagnostics.supabase.code = error.code;
      diagnostics.supabase.hint = error.hint;
    } else {
      diagnostics.supabase.status = 'connected';
      diagnostics.sessions.total_count = count;
      diagnostics.sessions.recent = data?.map(s => ({
        shop: s.shop_domain,
        updated: s.updated_at,
      }));
    }

    // Also check enriched_products table
    const { count: productCount, error: productError } = await supabase
      .from('enriched_products')
      .select('*', { count: 'exact', head: true });

    if (productError) {
      diagnostics.supabase.products_error = productError.message;
    } else {
      diagnostics.supabase.total_products = productCount;
    }
  } catch (e) {
    diagnostics.supabase.status = 'exception';
    diagnostics.supabase.error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Test Shopify config
  try {
    const config = getShopifyConfig();
    diagnostics.shopify_config = {
      api_key_set: !!config.apiKey,
      api_secret_set: !!config.apiSecret,
      app_url: config.appUrl,
      api_version: config.apiVersion,
      scopes: config.scopes,
    };
  } catch (e) {
    diagnostics.shopify_config = {
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }

  return res.status(200).json(diagnostics);
}

// ============================================================================
// Test Session Handler (for debugging)
// ============================================================================
async function handleTestSession(req: VercelRequest, res: VercelResponse) {
  const shop = req.query.shop as string || 'test-store.myshopify.com';
  const results: Record<string, any> = { shop, steps: [] };

  try {
    // Step 1: Create Supabase client
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    results.steps.push({ step: 'supabase_client', status: 'ok' });

    // Step 2: Generate test session ID
    const crypto = await import('crypto');
    const sessionId = crypto.randomUUID();
    results.steps.push({ step: 'generate_uuid', status: 'ok', id: sessionId });

    // Step 3: Try to insert a test session
    const testShopDomain = `test-${Date.now()}.myshopify.com`;
    const { data: insertData, error: insertError } = await supabase
      .from('shopify_sessions')
      .upsert({
        shop_domain: testShopDomain,
        access_token: 'test-token-encrypted',
        scope: 'read_products',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'shop_domain',
      })
      .select();

    if (insertError) {
      results.steps.push({ step: 'insert_session', status: 'error', error: insertError });
      results.success = false;
    } else {
      results.steps.push({ step: 'insert_session', status: 'ok', data: insertData });

      // Step 4: Delete the test session
      const { error: deleteError } = await supabase
        .from('shopify_sessions')
        .delete()
        .eq('shop_domain', testShopDomain);

      if (deleteError) {
        results.steps.push({ step: 'delete_test_session', status: 'error', error: deleteError });
      } else {
        results.steps.push({ step: 'delete_test_session', status: 'ok' });
      }

      results.success = true;
    }

    // Step 5: Count existing sessions
    const { count } = await supabase
      .from('shopify_sessions')
      .select('*', { count: 'exact', head: true });
    results.existing_sessions = count;

  } catch (e) {
    results.success = false;
    results.error = e instanceof Error ? e.message : 'Unknown error';
    results.stack = e instanceof Error ? e.stack : '';
  }

  return res.status(200).json(results);
}

// ============================================================================
// Status Handler
// ============================================================================
async function handleStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop } = req.query;

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

  const status = await getShopSyncStatus(supabaseUrl, supabaseKey, shopDomain);

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
}

// ============================================================================
// Sync Handler
// ============================================================================
async function handleSync(req: VercelRequest, res: VercelResponse) {
  console.log('[SYNC] Handler started');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop, product_ids, skip_enrichment } = req.body;
  console.log('[SYNC] Request body:', { shop, product_ids, skip_enrichment });

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({
      error: 'Missing shop parameter',
      message: 'Request body must include "shop" field',
    });
  }

  const shopDomain = sanitizeShopDomain(shop);
  console.log('[SYNC] Sanitized shop domain:', shopDomain);

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_KEY!;

  console.log('[SYNC] Checking session...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: session, error: sessionError } = await supabase
    .from('shopify_sessions')
    .select('shop_domain')
    .eq('shop_domain', shopDomain)
    .single();

  console.log('[SYNC] Session check result:', { session, error: sessionError });

  if (!session) {
    return res.status(401).json({
      error: 'Shop not connected',
      message: `No active connection for ${shopDomain}. Please install the app first.`,
    });
  }

  const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log('[SYNC] Created sync ID:', syncId);

  await supabase.from('shopify_sync_logs').insert({
    sync_id: syncId,
    shop_domain: shopDomain,
    status: 'started',
    started_at: new Date().toISOString(),
  });

  console.log('[SYNC] Starting syncShopProducts...');
  const startTime = Date.now();

  const result = await syncShopProducts(shopDomain, {
    supabaseUrl,
    supabaseKey,
    productIds: product_ids,
    skipEnrichment: skip_enrichment,
    onProgress: (stage, current, total) => {
      console.log(`[SYNC] Progress: ${stage} - ${current}/${total}`);
    },
  });

  console.log('[SYNC] syncShopProducts completed in', Date.now() - startTime, 'ms');
  console.log('[SYNC] Result:', result);

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
}

// ============================================================================
// Webhooks Handler
// ============================================================================
async function handleWebhooks(req: VercelRequest, res: VercelResponse) {
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

  const rawBody = JSON.stringify(req.body);
  const config = getShopifyConfig();

  if (!verifyWebhookHmac(rawBody, hmac, config.apiSecret)) {
    console.warn(`Invalid webhook HMAC from ${shopDomain} for topic ${topic}`);
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_KEY!;

  // Return 200 immediately
  res.status(200).json({ received: true, handling: true });

  // Process in background
  try {
    switch (topic) {
      case 'products/create':
      case 'products/update':
        await handleProductWebhook(supabaseUrl, supabaseKey, shopDomain, req.body);
        break;
      case 'products/delete':
        await handleProductDeleteWebhook(supabaseUrl, supabaseKey, shopDomain, req.body.id.toString());
        break;
      case 'inventory_levels/update':
        // Inventory changes - update product stock info
        const { inventory_item_id, available } = req.body;
        console.log(`Inventory update for ${shopDomain}: item ${inventory_item_id} now has ${available} units`);
        // Note: To map inventory_item_id to product, we'd need to query Shopify's API
        // For now, we log it - full sync will catch inventory changes
        break;
      case 'app/uninstalled':
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('shopify_sessions').delete().eq('shop_domain', shopDomain);
        break;
    }
  } catch (error) {
    console.error(`Error processing ${topic} webhook:`, error);
  }
}

// ============================================================================
// App Dashboard Handler
// ============================================================================
async function handleApp(req: VercelRequest, res: VercelResponse) {
  const shop = req.query.shop as string || '';
  const host = req.query.host as string || '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f6f6f7;
      color: #202223;
      line-height: 1.5;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .hero { text-align: center; padding: 40px 24px; }
    .hero-icon {
      width: 64px; height: 64px;
      background: linear-gradient(135deg, #4c7031 0%, #6b8f4a 100%);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .hero-icon svg { width: 32px; height: 32px; color: white; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #6d7175; font-size: 15px; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat { text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .stat-value { font-size: 28px; font-weight: 600; color: #4c7031; }
    .stat-label { font-size: 13px; color: #6d7175; margin-top: 4px; }
    .actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;
      text-decoration: none; cursor: pointer; border: none; transition: all 0.2s;
    }
    .btn-primary { background: #4c7031; color: white; }
    .btn-primary:hover { background: #3d5a27; }
    .btn-secondary { background: white; color: #202223; border: 1px solid #c9cccf; }
    .btn-secondary:hover { background: #f6f6f7; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .message { padding: 12px 16px; border-radius: 8px; margin-top: 16px; display: none; }
    .message.success { background: #e8f0e3; color: #2d5016; }
    .message.error { background: #fbeae5; color: #d72c0d; }
    .progress-container { display: none; margin-top: 20px; text-align: left; }
    .progress-bar-wrapper { background: #e4e5e7; border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 12px; }
    .progress-bar { background: linear-gradient(90deg, #4c7031 0%, #6b8f4a 100%); height: 100%; width: 0%; transition: width 0.3s ease; }
    .progress-steps { list-style: none; }
    .progress-step { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 14px; color: #6d7175; }
    .progress-step.active { color: #202223; font-weight: 500; }
    .progress-step.done { color: #4c7031; }
    .progress-step .icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .progress-step.pending .icon { background: #e4e5e7; }
    .progress-step.active .icon { background: #4c7031; color: white; }
    .progress-step.done .icon { background: #e8f0e3; color: #4c7031; }
    .spinner { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .feature-list { display: grid; gap: 12px; }
    .feature { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f9fafb; border-radius: 8px; }
    .feature-icon {
      width: 40px; height: 40px; background: #e8f0e3; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .feature-icon svg { width: 20px; height: 20px; color: #4c7031; }
    .feature-content h3 { font-size: 14px; font-weight: 500; margin-bottom: 2px; }
    .feature-content p { font-size: 13px; color: #6d7175; }
    @media (max-width: 600px) {
      .stats { grid-template-columns: 1fr; }
      .actions { flex-direction: column; }
      .btn { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card hero">
      <div class="hero-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h1>Welcome to ${APP_NAME}</h1>
      <p class="subtitle">Transform your products into stunning moodboards</p>
      <div class="stats">
        <div class="stat"><div class="stat-value" id="productCount">--</div><div class="stat-label">Products</div></div>
        <div class="stat"><div class="stat-value" id="lastSync">--</div><div class="stat-label">Last Sync</div></div>
        <div class="stat"><div class="stat-value" id="status">--</div><div class="stat-label">Status</div></div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="syncBtn" onclick="syncProducts()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span id="syncText">Sync Products</span>
        </button>
        <a href="${FRONTEND_URL}" target="_blank" class="btn btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open Editor
        </a>
      </div>
      <div class="message" id="message"></div>
      <div class="progress-container" id="progressContainer">
        <div class="progress-bar-wrapper"><div class="progress-bar" id="progressBar"></div></div>
        <ul class="progress-steps" id="progressSteps">
          <li class="progress-step pending" data-step="connect"><span class="icon">1</span>Connecting to Shopify...</li>
          <li class="progress-step pending" data-step="fetch"><span class="icon">2</span>Fetching product catalog...</li>
          <li class="progress-step pending" data-step="process"><span class="icon">3</span>Processing products...</li>
          <li class="progress-step pending" data-step="save"><span class="icon">4</span>Saving to database...</li>
          <li class="progress-step pending" data-step="complete"><span class="icon">5</span>Sync complete!</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <h2 class="section-title">Features</h2>
      <div class="feature-list">
        <div class="feature">
          <div class="feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
          <div class="feature-content"><h3>Create Moodboards</h3><p>Drag and drop products onto beautiful canvases</p></div>
        </div>
        <div class="feature">
          <div class="feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div>
          <div class="feature-content"><h3>AI Enrichment</h3><p>Products auto-tagged with style and mood attributes</p></div>
        </div>
        <div class="feature">
          <div class="feature-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></div>
          <div class="feature-content"><h3>Share Everywhere</h3><p>Export for Instagram, Pinterest, or your website</p></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const shop = '${shop}';
    const apiBase = window.location.origin;
    async function loadStats() {
      try {
        const r = await fetch(apiBase + '/api/shopify?action=status&shop=' + encodeURIComponent(shop));
        const d = await r.json();
        document.getElementById('productCount').textContent = d.products_count || 0;
        document.getElementById('lastSync').textContent = d.last_sync ? formatTime(new Date(d.last_sync)) : 'Never';
        document.getElementById('status').textContent = d.connected ? 'Connected' : 'Not connected';
      } catch (e) { console.error(e); }
    }
    const steps = ['connect', 'fetch', 'process', 'save', 'complete'];
    let currentStep = 0;

    function updateProgress(stepName, status, detail) {
      const container = document.getElementById('progressContainer');
      const bar = document.getElementById('progressBar');
      const stepEl = document.querySelector('[data-step="' + stepName + '"]');

      container.style.display = 'block';

      // Update step status
      if (stepEl) {
        stepEl.className = 'progress-step ' + status;
        if (detail) {
          stepEl.innerHTML = '<span class="icon">' + (status === 'active' ? '<span class="spinner">↻</span>' : status === 'done' ? '✓' : (steps.indexOf(stepName) + 1)) + '</span>' + detail;
        }
      }

      // Update progress bar
      const stepIndex = steps.indexOf(stepName);
      const progress = status === 'done' ? ((stepIndex + 1) / steps.length) * 100 : (stepIndex / steps.length) * 100;
      bar.style.width = progress + '%';
    }

    function resetProgress() {
      steps.forEach((s, i) => {
        const el = document.querySelector('[data-step="' + s + '"]');
        if (el) {
          el.className = 'progress-step pending';
          const labels = ['Connecting to Shopify...', 'Fetching product catalog...', 'Processing products...', 'Saving to database...', 'Sync complete!'];
          el.innerHTML = '<span class="icon">' + (i + 1) + '</span>' + labels[i];
        }
      });
      document.getElementById('progressBar').style.width = '0%';
    }

    async function syncProducts() {
      const btn = document.getElementById('syncBtn');
      const text = document.getElementById('syncText');
      const msg = document.getElementById('message');
      btn.disabled = true;
      text.textContent = 'Syncing...';
      msg.style.display = 'none';
      resetProgress();

      try {
        // Step 1: Connect
        updateProgress('connect', 'active', 'Connecting to Shopify...');
        await new Promise(r => setTimeout(r, 500));
        updateProgress('connect', 'done', 'Connected to Shopify');

        // Step 2: Fetch
        updateProgress('fetch', 'active', 'Fetching product catalog...');

        const r = await fetch(apiBase + '/api/shopify?action=sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop: shop, skip_enrichment: true })
        });
        const d = await r.json();

        if (d.success) {
          updateProgress('fetch', 'done', 'Found ' + d.products_synced + ' products');

          // Step 3: Process
          updateProgress('process', 'active', 'Processing ' + d.products_synced + ' products...');
          await new Promise(r => setTimeout(r, 300));
          updateProgress('process', 'done', 'Processed ' + d.products_synced + ' products');

          // Step 4: Save
          updateProgress('save', 'active', 'Saving to database...');
          await new Promise(r => setTimeout(r, 300));
          updateProgress('save', 'done', 'Saved to database');

          // Step 5: Complete
          updateProgress('complete', 'done', 'Sync complete! ' + d.products_synced + ' products ready');

          msg.className = 'message success';
          msg.textContent = 'Successfully synced ' + d.products_synced + ' products in ' + (d.duration_ms / 1000).toFixed(1) + 's';
          loadStats();
        } else {
          throw new Error(d.message || d.error || 'Sync failed');
        }
      } catch (e) {
        msg.className = 'message error';
        msg.textContent = 'Error: ' + e.message;
        document.getElementById('progressContainer').style.display = 'none';
      }
      msg.style.display = 'block';
      btn.disabled = false;
      text.textContent = 'Sync Products';
    }
    function formatTime(d) {
      const s = Math.floor((new Date() - d) / 1000);
      if (s < 60) return 'Just now';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      return Math.floor(s / 86400) + 'd ago';
    }
    if (shop) loadStats();
  </script>
</body>
</html>`.trim();

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
