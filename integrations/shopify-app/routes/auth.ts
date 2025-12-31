/**
 * Shopify OAuth Authentication Routes
 *
 * Handles the OAuth flow for Shopify app installation:
 * 1. /auth - Initiates OAuth flow
 * 2. /auth/callback - Handles OAuth callback
 * 3. /auth/verify - Verifies session validity
 */

import crypto from 'crypto';
import { createShopifyClient, ShopifySession } from '../utils/shopifyClient';

// =============================================================================
// TYPES
// =============================================================================

interface AuthRequest {
  shop: string;
}

interface CallbackQuery {
  shop: string;
  code: string;
  state: string;
  hmac: string;
  timestamp: string;
}

interface AuthResponse {
  success: boolean;
  redirectUrl?: string;
  session?: ShopifySession;
  error?: string;
}

// In-memory state store (use Redis/DB in production)
const stateStore = new Map<string, { shop: string; expires: number }>();

// =============================================================================
// AUTH HANDLERS
// =============================================================================

/**
 * Initiate OAuth flow
 * GET /auth?shop=store.myshopify.com
 */
export async function initiateAuth(request: AuthRequest): Promise<AuthResponse> {
  const { shop } = request;

  // Validate shop domain
  if (!shop || !isValidShopDomain(shop)) {
    return {
      success: false,
      error: 'Invalid shop domain. Must be a .myshopify.com domain.',
    };
  }

  const client = createShopifyClient();

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state with expiry (10 minutes)
  stateStore.set(state, {
    shop,
    expires: Date.now() + 10 * 60 * 1000,
  });

  // Generate redirect URL
  const redirectUri = `${process.env.APP_URL}/auth/callback`;
  const authUrl = client.getAuthUrl(shop, redirectUri, state);

  console.log(`[ShopifyAuth] Initiating OAuth for shop: ${shop}`);

  return {
    success: true,
    redirectUrl: authUrl,
  };
}

/**
 * Handle OAuth callback
 * GET /auth/callback?shop=...&code=...&state=...&hmac=...
 */
export async function handleCallback(query: CallbackQuery): Promise<AuthResponse> {
  const { shop, code, state, hmac } = query;

  // Validate state
  const storedState = stateStore.get(state);
  if (!storedState || storedState.shop !== shop || storedState.expires < Date.now()) {
    return {
      success: false,
      error: 'Invalid or expired state. Please try again.',
    };
  }

  // Clean up state
  stateStore.delete(state);

  const client = createShopifyClient();

  // Verify HMAC
  if (!client.verifyCallback(query as unknown as Record<string, string>)) {
    console.error('[ShopifyAuth] HMAC verification failed');
    return {
      success: false,
      error: 'Request verification failed.',
    };
  }

  try {
    // Exchange code for access token
    const session = await client.getAccessToken(shop, code);

    console.log(`[ShopifyAuth] Successfully authenticated shop: ${shop}`);

    // Store session in database (integrate with your backend)
    await storeSession(session);

    return {
      success: true,
      session,
      redirectUrl: `${process.env.APP_URL}/dashboard?shop=${shop}`,
    };
  } catch (error: any) {
    console.error('[ShopifyAuth] Token exchange failed:', error.message);
    return {
      success: false,
      error: 'Failed to complete authentication.',
    };
  }
}

/**
 * Verify current session
 * GET /auth/verify
 */
export async function verifySession(shop: string, accessToken: string): Promise<AuthResponse> {
  const client = createShopifyClient();

  try {
    client.setSession({ shop, accessToken, scope: '' });
    await client.getShop();

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('[ShopifyAuth] Session verification failed:', error.message);
    return {
      success: false,
      error: 'Session is invalid or expired.',
    };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Validate Shopify shop domain
 */
function isValidShopDomain(shop: string): boolean {
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
}

/**
 * Store session in database
 * This should integrate with your Supabase backend
 */
async function storeSession(session: ShopifySession): Promise<void> {
  // TODO: Integrate with Supabase
  // Example:
  // const { error } = await supabase
  //   .from('brand_integrations')
  //   .upsert({
  //     platform: 'shopify',
  //     shop_domain: session.shop,
  //     access_token: session.accessToken,
  //     scope: session.scope,
  //     is_connected: true,
  //     updated_at: new Date().toISOString(),
  //   }, { onConflict: 'shop_domain' });

  console.log(`[ShopifyAuth] Session stored for: ${session.shop}`);
}

// =============================================================================
// ROUTE HANDLERS (Express-style)
// =============================================================================

/**
 * Express route handlers
 */
export const authRoutes = {
  /**
   * GET /auth
   */
  initiate: async (req: any, res: any) => {
    const shop = req.query.shop as string;
    const result = await initiateAuth({ shop });

    if (result.success && result.redirectUrl) {
      res.redirect(result.redirectUrl);
    } else {
      res.status(400).json({ error: result.error });
    }
  },

  /**
   * GET /auth/callback
   */
  callback: async (req: any, res: any) => {
    const result = await handleCallback(req.query);

    if (result.success && result.redirectUrl) {
      res.redirect(result.redirectUrl);
    } else {
      res.status(400).json({ error: result.error });
    }
  },

  /**
   * GET /auth/verify
   */
  verify: async (req: any, res: any) => {
    const { shop, token } = req.query;
    const result = await verifySession(shop, token);
    res.json(result);
  },
};

export default authRoutes;
