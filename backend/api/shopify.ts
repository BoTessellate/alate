/**
 * Shopify Unified API Handler
 * Handles all Shopify routes: /api/shopify?action=auth|callback|status|sync|webhooks|app
 *
 * This consolidates multiple endpoints into one to stay within Vercel's function limits
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getShopifyConfig,
  buildAuthUrl,
  generateStateNonce,
  exchangeCodeForToken,
  verifyCallbackHmac,
  verifyWebhookHmac,
  encryptToken,
  decryptToken,
  sanitizeShopDomain,
  isValidShopDomain,
  getShopSyncStatus,
  syncShopProducts,
  updateLastSyncTime,
  handleProductWebhook,
  handleProductDeleteWebhook,
  getISTTimestamp,
} from '../sdk/shopify';

// Increase function timeout (requires Pro plan for >10s, hobby plan maxes at 10s)
export const config = {
  maxDuration: 60,
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://frontend-ramsaptamis-projects.vercel.app';
const APP_NAME = 'The Mood Layer';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================================
// Helpers
// ============================================================================

// Cached Supabase client for performance (reused across invocations in warm functions)
let _supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;
    _supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return _supabaseClient;
}

/**
 * Set security headers on response
 * Note: X-Frame-Options is NOT set here because Shopify embedded apps
 * must be loaded in an iframe from admin.shopify.com
 */
function setSecurityHeaders(res: VercelResponse, allowShopifyFrame: boolean = false): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (allowShopifyFrame) {
    // Allow Shopify admin to embed this page in an iframe
    res.setHeader('Content-Security-Policy', "frame-ancestors https://*.myshopify.com https://admin.shopify.com");
  } else {
    // For non-embedded endpoints, deny framing
    res.setHeader('X-Frame-Options', 'DENY');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string || 'app';

  // Set security headers - allow Shopify iframe for 'app' action
  const allowShopifyFrame = action === 'app';
  setSecurityHeaders(res, allowShopifyFrame);

  // Handle CORS preflight for all actions
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

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
      case 'sync-redirect':
        return handleSyncRedirect(req, res);
      case 'enrich':
        return handleEnrich(req, res);
      case 'webhooks':
        return handleWebhooks(req, res);
      case 'health':
        // Health check allowed in all environments
        return handleHealth(req, res);
      case 'test-session':
      case 'test-product':
      case 'debug-sessions':
        // Debug endpoints disabled in production for security
        if (IS_PRODUCTION) {
          return res.status(404).json({ error: 'Not found' });
        }
        if (action === 'test-session') return handleTestSession(req, res);
        if (action === 'test-product') return handleTestProduct(req, res);
        return handleDebugSessions(req, res);
      case 'app':
      default:
        return handleApp(req, res);
    }
  } catch (error) {
    console.error(`Shopify ${action} error:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      // Don't expose error details in production
      message: IS_PRODUCTION ? 'An error occurred' : (error instanceof Error ? error.message : 'Unknown error'),
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

  const supabase = getSupabase();

  const { error: upsertError } = await supabase.from('shopify_sessions').upsert(
    {
      shop_domain: shopDomain,
      access_token: encryptedToken,
      scope: tokenResponse.scope,
      updated_at: getISTTimestamp(),
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
    const supabase = getSupabase();

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
    const supabase = getSupabase();
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
        updated_at: getISTTimestamp(),
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
// Debug Sessions Handler (list all sessions)
// ============================================================================
async function handleDebugSessions(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();
  const config = getShopifyConfig();

  const { data: sessions, error } = await supabase
    .from('shopify_sessions')
    .select('shop_domain, access_token, scope, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Test decrypt and API call for first session
  let tokenTest = null;
  if (sessions && sessions.length > 0) {
    const session = sessions[0];
    try {
      const decryptedToken = decryptToken(session.access_token, config.encryptionKey);
      // Test a simple API call
      const testResponse = await fetch(`https://${session.shop_domain}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': decryptedToken,
          'Content-Type': 'application/json',
        },
      });
      tokenTest = {
        shop: session.shop_domain,
        decrypted: true,
        tokenPreview: decryptedToken.substring(0, 10) + '...',
        apiTest: {
          status: testResponse.status,
          ok: testResponse.ok,
          body: !testResponse.ok ? await testResponse.text() : undefined,
        },
      };
    } catch (e) {
      tokenTest = {
        shop: session.shop_domain,
        decrypted: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  return res.status(200).json({
    count: sessions?.length || 0,
    sessions: sessions?.map(s => ({
      shop_domain: s.shop_domain,
      scope: s.scope,
      created_at: s.created_at,
      updated_at: s.updated_at,
      token_format: s.access_token?.includes(':') ? 'encrypted' : 'plain',
    })) || [],
    tokenTest,
    encryptionKeyConfigured: !!config.encryptionKey,
  });
}

// ============================================================================
// Test Product Insert Handler
// ============================================================================
async function handleTestProduct(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, any> = { steps: [] };

  const supabaseKey = process.env.SUPABASE_KEY!;

  // Check what type of key we're using
  const keyType = supabaseKey.startsWith('eyJ') ? 'JWT (anon/user)' :
                  supabaseKey.includes('service_role') ? 'service_role' :
                  'unknown (length: ' + supabaseKey.length + ')';
  results.key_info = { type: keyType, prefix: supabaseKey.substring(0, 10) + '...' };

  const supabase = getSupabase();

  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testExternalId = `test-${Date.now()}`;

  // Test inserting a minimal product with user_id
  const testProduct = {
    user_id: testUserId,
    product_name: 'TEST PRODUCT - DELETE ME',
    brand: 'Test Brand',
    category: 'Test',
    price: 1.00,
    image_url: 'https://example.com/test.jpg',
    external_id: testExternalId,
    platform: 'shopify',
    shop_domain: 'test.myshopify.com',
    updated_at: getISTTimestamp(),
  };

  results.test_product = testProduct;
  results.steps.push({ step: 'created_test_product', data: testProduct });

  // Method 1: Standard insert
  const { data, error } = await supabase
    .from('enriched_products')
    .insert(testProduct)
    .select();

  if (error) {
    results.steps.push({ step: 'insert_failed', error: error });
    results.success = false;
    results.error = `${error.code}: ${error.message} - ${error.details || ''}`;

    // Method 2: Try raw SQL via rpc if standard insert fails
    results.steps.push({ step: 'trying_raw_sql' });
    const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', {
      sql: `INSERT INTO enriched_products (user_id, product_name, brand, category, price, external_id, platform, shop_domain, updated_at)
            VALUES ('${testUserId}', 'TEST RAW SQL', 'Test', 'Test', 1.00, '${testExternalId}-raw', 'shopify', 'test.myshopify.com', NOW())
            RETURNING id, user_id;`
    });

    if (rpcError) {
      results.steps.push({ step: 'raw_sql_failed', error: rpcError.message });
    } else {
      results.steps.push({ step: 'raw_sql_success', data: rpcData });
    }
  } else {
    results.steps.push({ step: 'insert_success', data: data });
    results.success = true;

    // Verify what was actually inserted
    const { data: verifyData } = await supabase
      .from('enriched_products')
      .select('id, user_id, product_name')
      .eq('external_id', testExternalId)
      .single();

    results.steps.push({ step: 'verify_inserted', data: verifyData });
    results.user_id_check = {
      sent: testUserId,
      received: verifyData?.user_id,
      match: verifyData?.user_id === testUserId
    };

    // Clean up - delete the test product
    const { error: deleteError } = await supabase
      .from('enriched_products')
      .delete()
      .eq('external_id', testExternalId);

    results.steps.push({ step: 'cleanup', deleted: !deleteError });
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

  const supabase = getSupabase();
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
  console.log('[SYNC] Handler started, method:', req.method);

  // Add CORS headers for embedded app requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
  const supabase = getSupabase();
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
    started_at: getISTTimestamp(),
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
// Sync Redirect Handler (for embedded apps - bypasses CSP)
// ============================================================================
async function handleSyncRedirect(req: VercelRequest, res: VercelResponse) {
  console.log('[SYNC-REDIRECT] Handler started');

  const shop = req.query.shop as string;
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const shopDomain = sanitizeShopDomain(shop);
  const config = getShopifyConfig();
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_KEY!;

  // Check session exists
  const supabase = getSupabase();
  const { data: session } = await supabase
    .from('shopify_sessions')
    .select('shop_domain')
    .eq('shop_domain', shopDomain)
    .single();

  if (!session) {
    return res.redirect(302, `${config.appUrl}/api/shopify?action=auth&shop=${encodeURIComponent(shopDomain)}`);
  }

  // Do the sync
  console.log('[SYNC-REDIRECT] Starting sync for:', shopDomain);
  const result = await syncShopProducts(shopDomain, {
    supabaseUrl,
    supabaseKey,
    skipEnrichment: true,
  });

  console.log('[SYNC-REDIRECT] Sync complete:', result.success, result.products_synced, 'products');

  // Update last sync time
  if (result.success) {
    await updateLastSyncTime(supabaseUrl, supabaseKey, shopDomain);
  }

  // Redirect back to embedded app with results
  const storeName = shopDomain.replace('.myshopify.com', '');
  const resultParams = new URLSearchParams({
    synced: result.products_synced.toString(),
    success: result.success.toString(),
    duration: result.duration_ms.toString(),
  });

  // Redirect back to Shopify admin embedded app
  const redirectUrl = `https://admin.shopify.com/store/${storeName}/apps/the-mood-layer?${resultParams.toString()}`;
  console.log('[SYNC-REDIRECT] Redirecting to:', redirectUrl);

  return res.redirect(302, redirectUrl);
}

// ============================================================================
// Enrich Handler - Enriches existing products with AI-generated attributes
// ============================================================================
async function handleEnrich(req: VercelRequest, res: VercelResponse) {
  console.log('[ENRICH] Handler started, method:', req.method);

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shop = (req.method === 'POST' ? req.body?.shop : req.query.shop) as string;
  const limit = parseInt((req.method === 'POST' ? req.body?.limit : req.query.limit) as string || '10', 10);
  const productIds = req.method === 'POST' ? req.body?.product_ids : undefined;

  if (!shop || typeof shop !== 'string') {
    return res.status(400).json({
      error: 'Missing shop parameter',
      message: 'Request must include "shop" field',
    });
  }

  const shopDomain = sanitizeShopDomain(shop);
  const supabase = getSupabase();

  // Check session exists
  const { data: session } = await supabase
    .from('shopify_sessions')
    .select('shop_domain')
    .eq('shop_domain', shopDomain)
    .single();

  if (!session) {
    return res.status(401).json({
      error: 'Shop not connected',
      message: `No active connection for ${shopDomain}`,
    });
  }

  // Find products that need enrichment (no enriched_at timestamp or specific IDs)
  let query = supabase
    .from('enriched_products')
    .select('id, product_name, brand, category, price, image_url, external_id, shop_domain')
    .eq('shop_domain', shopDomain)
    .is('enriched_at', null)
    .limit(limit);

  if (productIds && Array.isArray(productIds) && productIds.length > 0) {
    query = supabase
      .from('enriched_products')
      .select('id, product_name, brand, category, price, image_url, external_id, shop_domain')
      .eq('shop_domain', shopDomain)
      .in('external_id', productIds)
      .limit(limit);
  }

  const { data: products, error: fetchError } = await query;

  if (fetchError) {
    console.error('[ENRICH] Failed to fetch products:', fetchError);
    return res.status(500).json({ error: 'Failed to fetch products', details: fetchError.message });
  }

  if (!products || products.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No products need enrichment',
      enriched_count: 0,
    });
  }

  console.log('[ENRICH] Found', products.length, 'products to enrich');

  // Import the enrichment function from sync
  const { callClaude, parseJSONFromResponse } = await import('../sdk/shared/secureAI');

  const enriched: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const product of products) {
    try {
      console.log('[ENRICH] Enriching:', product.product_name);

      const prompt = `Analyze this product and extract style attributes. Return JSON only.

Product: ${product.product_name}
Brand: ${product.brand || 'Unknown'}
Category: ${product.category || 'General'}
Price: ${product.price || 'N/A'}

Return this exact JSON structure:
{
  "color_palette": ["color1", "color2", "color3"],
  "tags": ["style1", "style2", "style3"],
  "texture": "texture_type",
  "material": "material_type",
  "tone": "aesthetic_mood",
  "flags": ["special_attribute"],
  "fit_tags": ["layout_hint"]
}`;

      const response = await callClaude(prompt, { maxTokens: 512 });

      if (!response.success || !response.text) {
        throw new Error(response.error || 'Claude call failed');
      }

      const enrichment = parseJSONFromResponse(response.text);
      if (!enrichment) {
        throw new Error('Failed to parse enrichment response');
      }

      // Update the product with enrichment data
      const { error: updateError } = await supabase
        .from('enriched_products')
        .update({
          color_palette: enrichment.color_palette,
          tags: enrichment.tags,
          texture: enrichment.texture,
          material: enrichment.material,
          tone: enrichment.tone,
          flags: enrichment.flags,
          fit_tags: enrichment.fit_tags,
          canonical_tags: enrichment.tags, // Use tags as canonical for now
          enriched_at: getISTTimestamp(),
        })
        .eq('id', product.id);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      enriched.push(product.external_id);
      console.log('[ENRICH] Successfully enriched:', product.product_name);
    } catch (error) {
      console.error('[ENRICH] Failed to enrich', product.product_name, error);
      failed.push({
        id: product.external_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(200).json({
    success: true,
    shop_domain: shopDomain,
    total_found: products.length,
    enriched_count: enriched.length,
    failed_count: failed.length,
    enriched_ids: enriched,
    failed: failed.length > 0 ? failed : undefined,
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
        await getSupabase().from('shopify_sessions').delete().eq('shop_domain', shopDomain);
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
  const idToken = req.query.id_token as string || '';

  // If no shop provided, show error
  if (!shop) {
    return res.status(400).send(`
      <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1>Missing Shop Parameter</h1>
        <p>This app must be accessed from your Shopify admin.</p>
      </body></html>
    `);
  }

  const shopDomain = sanitizeShopDomain(shop);
  const config = getShopifyConfig();
  console.log('[APP] Loading app for shop:', shopDomain, 'hasIdToken:', !!idToken);

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_KEY!;
  const supabase = getSupabase();

  // If we have an id_token (embedded app session token), exchange it for an access token
  if (idToken) {
    console.log('[APP] Exchanging session token for access token...');
    try {
      // Token exchange: exchange the session token for an offline access token
      const tokenExchangeResponse = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.apiKey,
          client_secret: config.apiSecret,
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: idToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
          requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
          scope: config.scopes.join(' '),
        }),
      });

      const tokenResponseText = await tokenExchangeResponse.text();
      console.log('[APP] Token exchange response:', tokenExchangeResponse.status, tokenResponseText.substring(0, 200));

      if (tokenExchangeResponse.ok) {
        const tokenData = JSON.parse(tokenResponseText);
        console.log('[APP] Token exchange successful, scope:', tokenData.scope, 'token_type:', tokenData.token_type);

        // Store the new access token
        const encryptedToken = encryptToken(tokenData.access_token, config.encryptionKey);
        const { error: upsertError } = await supabase.from('shopify_sessions').upsert(
          {
            shop_domain: shopDomain,
            access_token: encryptedToken,
            scope: tokenData.scope,
            updated_at: getISTTimestamp(),
          },
          { onConflict: 'shop_domain' }
        );

        if (upsertError) {
          console.error('[APP] Failed to store exchanged token:', upsertError);
        } else {
          console.log('[APP] Exchanged token stored successfully');
        }
      } else {
        // tokenResponseText already contains the error response body
        console.error('[APP] Token exchange failed:', tokenExchangeResponse.status, tokenResponseText);
      }
    } catch (e) {
      console.error('[APP] Token exchange error:', e);
    }
  }

  // Check if we have a valid session for this shop
  const { data: session, error: sessionError } = await supabase
    .from('shopify_sessions')
    .select('shop_domain, scope, updated_at')
    .eq('shop_domain', shopDomain)
    .single();

  console.log('[APP] Session lookup result:', { hasSession: !!session, error: sessionError?.message });

  // If no session, redirect to OAuth
  if (!session || sessionError) {
    console.log('[APP] No session found, redirecting to OAuth...');
    const state = generateStateNonce();
    const authUrl = buildAuthUrl(config, shopDomain, state);

    // Store state for verification
    res.setHeader('Set-Cookie', `shopify_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

    return res.redirect(302, authUrl);
  }

  console.log('[APP] Session found, rendering dashboard');

  // Fetch stats server-side
  const status = await getShopSyncStatus(supabaseUrl, supabaseKey, shopDomain);
  const productCount = status.total_products || 0;
  const lastSyncFormatted = status.last_sync_at ? formatLastSync(new Date(status.last_sync_at)) : 'Never';
  const connectionStatus = status.is_connected ? 'Connected' : 'Not connected';

  function formatLastSync(d: Date): string {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 172800) return 'Yesterday';
    // Show IST date for older syncs
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --color-sage: #8b9a7d;
      --color-sage-dark: #6b7a5d;
      --color-sage-light: #c5cebf;
      --color-cream: #faf9f7;
      --color-warm: #f5f3ef;
      --color-charcoal: #2c2c2c;
      --color-stone: #8c8c8c;
      --color-success: #7d9a6b;
      --color-error: #c17b7b;
      --font-serif: 'Playfair Display', Georgia, serif;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    body {
      font-family: var(--font-sans);
      background: linear-gradient(180deg, var(--color-cream) 0%, var(--color-warm) 100%);
      min-height: 100vh;
      color: var(--color-charcoal);
      line-height: 1.6;
      padding: 24px;
    }

    .container { max-width: 720px; margin: 0 auto; }

    .card {
      background: white;
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
      border: 1px solid rgba(0,0,0,0.04);
    }

    .hero { text-align: center; padding: 48px 32px; position: relative; overflow: hidden; }

    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 20%, rgba(139, 154, 125, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 70% 80%, rgba(139, 154, 125, 0.05) 0%, transparent 40%);
      pointer-events: none;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: var(--color-warm);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-sage-dark);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 24px;
    }

    .hero-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      background: var(--color-sage);
      border-radius: 50%;
    }

    h1 {
      font-family: var(--font-serif);
      font-size: 32px;
      font-weight: 500;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
      color: var(--color-charcoal);
    }

    .subtitle {
      color: var(--color-stone);
      font-size: 15px;
      margin-bottom: 36px;
      font-weight: 400;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 36px;
    }

    .stat {
      text-align: center;
      padding: 20px 16px;
      background: linear-gradient(135deg, var(--color-warm) 0%, rgba(255,255,255,0.5) 100%);
      border-radius: 16px;
      border: 1px solid rgba(139, 154, 125, 0.1);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .stat:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }

    .stat-value {
      font-family: var(--font-serif);
      font-size: 26px;
      font-weight: 600;
      color: var(--color-sage-dark);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 11px;
      color: var(--color-stone);
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 500;
    }

    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--color-sage) 0%, var(--color-sage-dark) 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(139, 154, 125, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(139, 154, 125, 0.4);
    }

    .btn-primary:active { transform: translateY(0); }

    .btn-secondary {
      background: white;
      color: var(--color-charcoal);
      border: 1.5px solid var(--color-sage-light);
    }

    .btn-secondary:hover {
      background: var(--color-warm);
      border-color: var(--color-sage);
    }

    .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }

    .message {
      padding: 16px 20px;
      border-radius: 12px;
      margin-top: 24px;
      display: none;
      font-size: 14px;
      font-weight: 500;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.success {
      background: linear-gradient(135deg, rgba(125, 154, 107, 0.12) 0%, rgba(125, 154, 107, 0.06) 100%);
      color: var(--color-sage-dark);
      border: 1px solid rgba(125, 154, 107, 0.2);
    }

    .message.error {
      background: linear-gradient(135deg, rgba(193, 123, 123, 0.12) 0%, rgba(193, 123, 123, 0.06) 100%);
      color: #8b5555;
      border: 1px solid rgba(193, 123, 123, 0.2);
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--color-sage-light) 50%, transparent 100%);
      margin: 32px 0;
      opacity: 0.5;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .section-title {
      font-family: var(--font-serif);
      font-size: 18px;
      font-weight: 500;
      color: var(--color-charcoal);
    }

    .section-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--color-sage-light) 0%, transparent 100%);
    }

    .feature-list { display: grid; gap: 16px; }

    .feature {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px;
      background: linear-gradient(135deg, var(--color-warm) 0%, rgba(255,255,255,0.8) 100%);
      border-radius: 16px;
      border: 1px solid rgba(139, 154, 125, 0.08);
      transition: all 0.25s ease;
    }

    .feature:hover {
      background: linear-gradient(135deg, rgba(139, 154, 125, 0.08) 0%, var(--color-warm) 100%);
      border-color: rgba(139, 154, 125, 0.15);
    }

    .feature-icon {
      width: 44px;
      height: 44px;
      background: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .feature-icon svg {
      width: 22px;
      height: 22px;
      color: var(--color-sage);
    }

    .feature-content h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--color-charcoal);
    }

    .feature-content p {
      font-size: 13px;
      color: var(--color-stone);
      line-height: 1.5;
    }

    .footer-note {
      text-align: center;
      font-size: 12px;
      color: var(--color-stone);
      margin-top: 24px;
      opacity: 0.7;
    }

    @media (max-width: 600px) {
      body { padding: 16px; }
      .card { padding: 24px; border-radius: 16px; }
      .hero { padding: 32px 20px; }
      h1 { font-size: 26px; }
      .stats { grid-template-columns: 1fr; gap: 10px; }
      .stat { padding: 16px; }
      .stat-value { font-size: 22px; }
      .actions { flex-direction: column; }
      .btn { width: 100%; justify-content: center; padding: 16px 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card hero">
      <div class="hero-badge">${status.is_connected ? 'Shopify Connected' : 'Setup Required'}</div>
      <h1>${APP_NAME}</h1>
      <p class="subtitle">Transform your products into stunning visual stories</p>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${productCount}</div>
          <div class="stat-label">Products</div>
        </div>
        <div class="stat">
          <div class="stat-value">${lastSyncFormatted}</div>
          <div class="stat-label">Last Sync</div>
        </div>
        <div class="stat">
          <div class="stat-value">${connectionStatus}</div>
          <div class="stat-label">Status</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" id="syncBtn" onclick="syncProducts()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span id="syncText">Sync Products</span>
        </button>
        <button class="btn btn-secondary" id="enrichBtn" onclick="enrichProducts()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span id="enrichText">Enrich with AI</span>
        </button>
        <a href="${FRONTEND_URL}" target="_blank" class="btn btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Open Editor
        </a>
      </div>

      <div class="message" id="message"></div>
    </div>

    <div class="card">
      <div class="section-header">
        <h2 class="section-title">What you can do</h2>
        <div class="section-line"></div>
      </div>

      <div class="feature-list">
        <div class="feature">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="feature-content">
            <h3>Create Moodboards</h3>
            <p>Drag and drop your products onto beautiful canvases with intuitive controls</p>
          </div>
        </div>

        <div class="feature">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>
          <div class="feature-content">
            <h3>AI-Powered Enrichment</h3>
            <p>Products are automatically tagged with style, mood, and aesthetic attributes</p>
          </div>
        </div>

        <div class="feature">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </div>
          <div class="feature-content">
            <h3>Share Everywhere</h3>
            <p>Export your creations for Instagram, Pinterest, or embed on your website</p>
          </div>
        </div>
      </div>
    </div>

    <p class="footer-note">Crafted for creative merchants</p>
  </div>
  <script>
    const shop = '${shopDomain}';
    const apiBase = '${config.appUrl}';

    function syncProducts() {
      window.top.location.href = apiBase + '/api/shopify?action=sync-redirect&shop=' + encodeURIComponent(shop);
    }

    async function enrichProducts() {
      const btn = document.getElementById('enrichBtn');
      const text = document.getElementById('enrichText');
      const msg = document.getElementById('message');

      btn.disabled = true;
      text.textContent = 'Enriching...';
      msg.style.display = 'none';

      try {
        const response = await fetch(apiBase + '/api/shopify?action=enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop: shop, limit: 20 })
        });

        const result = await response.json();

        if (result.success) {
          msg.className = 'message success';
          if (result.enriched_count === 0) {
            msg.textContent = 'All products are already enriched';
          } else {
            msg.textContent = 'Enriched ' + result.enriched_count + ' product' + (result.enriched_count !== 1 ? 's' : '') + ' with AI';
          }
        } else {
          msg.className = 'message error';
          msg.textContent = result.error || 'Enrichment failed';
        }
        msg.style.display = 'block';
      } catch (error) {
        msg.className = 'message error';
        msg.textContent = 'Failed to enrich products';
        msg.style.display = 'block';
      } finally {
        btn.disabled = false;
        text.textContent = 'Enrich with AI';
      }
    }

    // Check for sync results in URL
    const urlParams = new URLSearchParams(window.location.search);
    const synced = urlParams.get('synced');
    const syncSuccess = urlParams.get('success');
    const syncDuration = urlParams.get('duration');

    if (synced !== null) {
      const msg = document.getElementById('message');
      const count = parseInt(synced);
      if (syncSuccess === 'true') {
        msg.className = 'message success';
        if (count === 0) {
          msg.textContent = 'Your catalog is up to date — no changes detected';
        } else {
          msg.textContent = 'Synced ' + count + ' product' + (count !== 1 ? 's' : '') + (syncDuration ? ' in ' + (parseInt(syncDuration) / 1000).toFixed(1) + 's' : '');
        }
      } else {
        msg.className = 'message error';
        msg.textContent = 'Sync failed. Please try again.';
      }
      msg.style.display = 'block';

      // Clear URL params so message doesn't show on refresh
      const cleanUrl = window.location.pathname + '?shop=' + encodeURIComponent(shop);
      window.history.replaceState({}, '', cleanUrl);
    }
  </script>
</body>
</html>`.trim();

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send(html);
}
