/**
 * Shopify Authentication Utilities
 * OAuth flow, token encryption, HMAC verification
 */

import * as crypto from 'crypto';
import type { ShopifyConfig, OAuthTokenResponse, ShopifySession } from './types';

// ============================================================================
// Token Encryption
// ============================================================================

/**
 * Encrypt access token using AES-256-GCM
 */
export function encryptToken(token: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(encryptionKey, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt access token
 */
export function decryptToken(encryptedToken: string, encryptionKey: string): string {
  const [ivHex, authTagHex, data] = encryptedToken.split(':');
  if (!ivHex || !authTagHex || !data) {
    throw new Error('Invalid encrypted token format');
  }

  const key = Buffer.from(encryptionKey, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// OAuth Flow
// ============================================================================

/**
 * Validate Shopify shop domain format
 */
export function isValidShopDomain(shop: string): boolean {
  if (!shop) return false;
  // Must be: store-name.myshopify.com
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
}

/**
 * Generate OAuth state nonce for CSRF protection
 */
export function generateStateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build Shopify OAuth authorization URL
 */
export function buildAuthUrl(config: ShopifyConfig, shop: string, state: string): string {
  const { apiKey, scopes, appUrl } = config;
  const cleanAppUrl = appUrl.trim();
  const redirectUri = `${cleanAppUrl}/api/shopify-callback`;

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes.join(','),
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  config: ShopifyConfig,
  shop: string,
  code: string
): Promise<OAuthTokenResponse> {
  const { apiKey, apiSecret } = config;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

// ============================================================================
// HMAC Verification
// ============================================================================

/**
 * Verify Shopify OAuth callback HMAC
 */
export function verifyCallbackHmac(
  query: Record<string, string>,
  apiSecret: string
): boolean {
  const { hmac, ...params } = query;
  if (!hmac) return false;

  // Sort params and create message
  const sortedKeys = Object.keys(params).sort();
  const message = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Calculate HMAC
  const calculatedHmac = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(calculatedHmac)
  );
}

/**
 * Verify Shopify webhook HMAC
 */
export function verifyWebhookHmac(
  rawBody: string,
  hmacHeader: string,
  apiSecret: string
): boolean {
  if (!hmacHeader) return false;

  const calculatedHmac = crypto
    .createHmac('sha256', apiSecret)
    .update(rawBody, 'utf8')
    .digest('base64');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(calculatedHmac)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Session Helpers
// ============================================================================

/**
 * Check if session token is expired
 */
export function isSessionExpired(session: ShopifySession): boolean {
  if (!session.expires_at) return false; // Offline tokens don't expire
  return new Date(session.expires_at) < new Date();
}

/**
 * Sanitize shop domain (ensure consistent format)
 */
export function sanitizeShopDomain(shop: string): string {
  let sanitized = shop.toLowerCase().trim();

  // Remove protocol if present
  sanitized = sanitized.replace(/^https?:\/\//, '');

  // Remove trailing slash
  sanitized = sanitized.replace(/\/$/, '');

  // Add .myshopify.com if not present
  if (!sanitized.includes('.myshopify.com')) {
    sanitized = `${sanitized}.myshopify.com`;
  }

  return sanitized;
}

// ============================================================================
// Config Helper
// ============================================================================

/**
 * Get Shopify config from environment variables
 */
export function getShopifyConfig(): ShopifyConfig {
  const apiKey = process.env.SHOPIFY_API_KEY?.trim();
  const apiSecret = process.env.SHOPIFY_SECRET?.trim();
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || '2024-01';
  const scopes = (process.env.SHOPIFY_SCOPES || 'read_products,read_product_listings,read_inventory').split(',').map(s => s.trim());
  const appUrl = process.env.APP_URL?.trim();
  const encryptionKey = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();

  if (!apiKey || !apiSecret || !appUrl || !encryptionKey) {
    throw new Error(
      'Missing required Shopify environment variables: SHOPIFY_API_KEY, SHOPIFY_SECRET, APP_URL, SHOPIFY_TOKEN_ENCRYPTION_KEY'
    );
  }

  return {
    apiKey,
    apiSecret,
    apiVersion,
    scopes,
    appUrl,
    encryptionKey,
  };
}
