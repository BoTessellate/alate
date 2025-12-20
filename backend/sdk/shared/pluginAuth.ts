/**
 * Plugin Authentication for Mood Layer SDK
 *
 * Provides OAuth flows for e-commerce platform integrations:
 * - Shopify OAuth 2.0
 * - WooCommerce REST API authentication
 * - Wix OAuth 2.0
 *
 * Handles token storage, refresh, and secure credential management.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import axios from 'axios';
import { createModuleLogger } from './logger';
import {
  ConfigurationError,
  ExternalServiceError,
  ValidationError,
  UnauthorizedError,
} from './errors';

const logger = createModuleLogger('pluginAuth');

// ============================================================================
// TYPES
// ============================================================================

export type PluginPlatform = 'shopify' | 'woocommerce' | 'wix';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface PluginCredentials {
  id: string;
  userId: string;
  platform: PluginPlatform;
  storeUrl: string;
  storeName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scopes: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthState {
  userId: string;
  platform: PluginPlatform;
  storeUrl: string;
  nonce: string;
  expiresAt: number;
}

export interface PluginAuthConfig {
  supabaseUrl: string;
  supabaseKey: string;
  credentialsTable?: string;
  shopify?: OAuthConfig;
  woocommerce?: {
    consumerKey?: string;
    consumerSecret?: string;
  };
  wix?: OAuthConfig;
  encryptionKey: string;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string, key: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============================================================================
// PLUGIN AUTH SERVICE
// ============================================================================

export class PluginAuthService {
  private supabase: SupabaseClient;
  private credentialsTable: string;
  private shopifyConfig?: OAuthConfig;
  private woocommerceConfig?: { consumerKey?: string; consumerSecret?: string };
  private wixConfig?: OAuthConfig;
  private encryptionKey: string;
  private stateCache: Map<string, OAuthState> = new Map();

  constructor(config: PluginAuthConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.credentialsTable = config.credentialsTable || 'plugin_credentials';
    this.shopifyConfig = config.shopify;
    this.woocommerceConfig = config.woocommerce;
    this.wixConfig = config.wix;
    this.encryptionKey = config.encryptionKey;

    if (!this.encryptionKey || this.encryptionKey.length !== 64) {
      throw new ConfigurationError(
        'Encryption key must be a 64-character hex string (32 bytes)'
      );
    }

    logger.info({
      hasShopify: !!this.shopifyConfig,
      hasWooCommerce: !!this.woocommerceConfig,
      hasWix: !!this.wixConfig,
    }, 'Plugin auth service initialized');
  }

  // ==========================================================================
  // SHOPIFY OAUTH
  // ==========================================================================

  /**
   * Generate Shopify OAuth authorization URL
   */
  generateShopifyAuthUrl(userId: string, storeUrl: string): string {
    if (!this.shopifyConfig) {
      throw new ConfigurationError('Shopify OAuth is not configured');
    }

    // Normalize store URL
    const shop = this.normalizeShopifyStore(storeUrl);

    // Generate state for CSRF protection
    const state = this.generateOAuthState(userId, 'shopify', shop);

    const params = new URLSearchParams({
      client_id: this.shopifyConfig.clientId,
      scope: this.shopifyConfig.scopes.join(','),
      redirect_uri: this.shopifyConfig.redirectUri,
      state,
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle Shopify OAuth callback
   */
  async handleShopifyCallback(
    code: string,
    state: string,
    shop: string
  ): Promise<PluginCredentials> {
    if (!this.shopifyConfig) {
      throw new ConfigurationError('Shopify OAuth is not configured');
    }

    // Verify state
    const oauthState = this.verifyOAuthState(state, 'shopify');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: this.shopifyConfig.clientId,
        client_secret: this.shopifyConfig.clientSecret,
        code,
      }
    );

    const { access_token, scope } = tokenResponse.data;

    // Get shop info
    const shopInfo = await axios.get(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    });

    // Save credentials
    return this.saveCredentials({
      userId: oauthState.userId,
      platform: 'shopify',
      storeUrl: shop,
      storeName: shopInfo.data.shop.name,
      accessToken: access_token,
      scopes: scope.split(','),
    });
  }

  /**
   * Refresh Shopify access token (offline tokens don't expire)
   */
  async refreshShopifyToken(credentialId: string): Promise<PluginCredentials> {
    // Shopify offline access tokens don't expire
    // Just return the existing credentials
    const credentials = await this.getCredentials(credentialId);
    if (!credentials) {
      throw new UnauthorizedError('Credentials not found');
    }
    return credentials;
  }

  // ==========================================================================
  // WOOCOMMERCE AUTHENTICATION
  // ==========================================================================

  /**
   * Generate WooCommerce REST API authorization URL
   */
  generateWooCommerceAuthUrl(userId: string, storeUrl: string): string {
    const normalizedUrl = this.normalizeStoreUrl(storeUrl);

    // Generate state for callback
    const state = this.generateOAuthState(userId, 'woocommerce', normalizedUrl);

    // WooCommerce uses a different approach - REST API keys
    const params = new URLSearchParams({
      app_name: 'Mood Layer',
      scope: 'read',
      user_id: userId,
      return_url: `${process.env.APP_URL}/api/plugins/woocommerce/callback`,
      callback_url: `${process.env.APP_URL}/api/plugins/woocommerce/callback`,
    });

    return `${normalizedUrl}/wc-auth/v1/authorize?${params.toString()}`;
  }

  /**
   * Handle WooCommerce authentication callback
   */
  async handleWooCommerceCallback(
    userId: string,
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<PluginCredentials> {
    const normalizedUrl = this.normalizeStoreUrl(storeUrl);

    // Verify credentials work by making a test request
    try {
      await axios.get(`${normalizedUrl}/wp-json/wc/v3/system_status`, {
        auth: {
          username: consumerKey,
          password: consumerSecret,
        },
      });
    } catch (error: any) {
      throw new ExternalServiceError(
        'WooCommerce',
        'Failed to verify credentials',
        error
      );
    }

    // Save credentials (consumer key + secret as combined token)
    return this.saveCredentials({
      userId,
      platform: 'woocommerce',
      storeUrl: normalizedUrl,
      accessToken: `${consumerKey}:${consumerSecret}`,
      scopes: ['read'],
    });
  }

  /**
   * Get WooCommerce API credentials
   */
  getWooCommerceCredentials(credentials: PluginCredentials): {
    consumerKey: string;
    consumerSecret: string;
  } {
    const [consumerKey, consumerSecret] = credentials.accessToken.split(':');
    return { consumerKey, consumerSecret };
  }

  // ==========================================================================
  // WIX OAUTH
  // ==========================================================================

  /**
   * Generate Wix OAuth authorization URL
   */
  generateWixAuthUrl(userId: string, storeUrl: string): string {
    if (!this.wixConfig) {
      throw new ConfigurationError('Wix OAuth is not configured');
    }

    const state = this.generateOAuthState(userId, 'wix', storeUrl);

    const params = new URLSearchParams({
      client_id: this.wixConfig.clientId,
      redirect_uri: this.wixConfig.redirectUri,
      scope: this.wixConfig.scopes.join(' '),
      response_type: 'code',
      state,
    });

    return `https://www.wix.com/installer/install?${params.toString()}`;
  }

  /**
   * Handle Wix OAuth callback
   */
  async handleWixCallback(code: string, state: string): Promise<PluginCredentials> {
    if (!this.wixConfig) {
      throw new ConfigurationError('Wix OAuth is not configured');
    }

    // Verify state
    const oauthState = this.verifyOAuthState(state, 'wix');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://www.wixapis.com/oauth/access',
      {
        grant_type: 'authorization_code',
        client_id: this.wixConfig.clientId,
        client_secret: this.wixConfig.clientSecret,
        code,
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get site info
    const siteInfo = await axios.get(
      'https://www.wixapis.com/site-properties/v4/properties',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Save credentials
    return this.saveCredentials({
      userId: oauthState.userId,
      platform: 'wix',
      storeUrl: oauthState.storeUrl,
      storeName: siteInfo.data.properties?.siteDisplayName,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: expiresAt,
      scopes: this.wixConfig.scopes,
    });
  }

  /**
   * Refresh Wix access token
   */
  async refreshWixToken(credentialId: string): Promise<PluginCredentials> {
    if (!this.wixConfig) {
      throw new ConfigurationError('Wix OAuth is not configured');
    }

    const credentials = await this.getCredentials(credentialId);
    if (!credentials || !credentials.refreshToken) {
      throw new UnauthorizedError('No refresh token available');
    }

    const tokenResponse = await axios.post(
      'https://www.wixapis.com/oauth/access',
      {
        grant_type: 'refresh_token',
        client_id: this.wixConfig.clientId,
        client_secret: this.wixConfig.clientSecret,
        refresh_token: credentials.refreshToken,
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    return this.updateCredentials(credentialId, {
      accessToken: access_token,
      refreshToken: refresh_token || credentials.refreshToken,
      tokenExpiresAt: expiresAt,
    });
  }

  // ==========================================================================
  // CREDENTIAL MANAGEMENT
  // ==========================================================================

  /**
   * Save encrypted credentials to database
   */
  private async saveCredentials(data: {
    userId: string;
    platform: PluginPlatform;
    storeUrl: string;
    storeName?: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
    scopes: string[];
    metadata?: Record<string, unknown>;
  }): Promise<PluginCredentials> {
    // Encrypt sensitive tokens
    const encryptedAccessToken = encrypt(data.accessToken, this.encryptionKey);
    const encryptedRefreshToken = data.refreshToken
      ? encrypt(data.refreshToken, this.encryptionKey)
      : null;

    const record = {
      user_id: data.userId,
      platform: data.platform,
      store_url: data.storeUrl,
      store_name: data.storeName,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: data.tokenExpiresAt,
      scopes: data.scopes,
      metadata: data.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await this.supabase
      .from(this.credentialsTable)
      .upsert(record, {
        onConflict: 'user_id,platform,store_url',
      })
      .select()
      .single();

    if (error) {
      throw new ExternalServiceError('Supabase', `Failed to save credentials: ${error.message}`);
    }

    logger.info({
      userId: data.userId,
      platform: data.platform,
      storeUrl: data.storeUrl,
    }, 'Plugin credentials saved');

    return this.mapCredentialsFromDb(inserted, true);
  }

  /**
   * Get credentials by ID
   */
  async getCredentials(credentialId: string): Promise<PluginCredentials | null> {
    const { data, error } = await this.supabase
      .from(this.credentialsTable)
      .select()
      .eq('id', credentialId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapCredentialsFromDb(data, true);
  }

  /**
   * Get all credentials for a user
   */
  async getUserCredentials(userId: string): Promise<PluginCredentials[]> {
    const { data, error } = await this.supabase
      .from(this.credentialsTable)
      .select()
      .eq('user_id', userId);

    if (error) {
      throw new ExternalServiceError('Supabase', `Failed to get credentials: ${error.message}`);
    }

    return data.map((row) => this.mapCredentialsFromDb(row, false));
  }

  /**
   * Get credentials for a specific platform/store
   */
  async getCredentialsByStore(
    userId: string,
    platform: PluginPlatform,
    storeUrl: string
  ): Promise<PluginCredentials | null> {
    const normalizedUrl = this.normalizeStoreUrl(storeUrl);

    const { data, error } = await this.supabase
      .from(this.credentialsTable)
      .select()
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('store_url', normalizedUrl)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapCredentialsFromDb(data, true);
  }

  /**
   * Update credentials
   */
  private async updateCredentials(
    credentialId: string,
    updates: Partial<{
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: string;
      storeName: string;
      metadata: Record<string, unknown>;
    }>
  ): Promise<PluginCredentials> {
    const record: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.accessToken) {
      record.access_token = encrypt(updates.accessToken, this.encryptionKey);
    }
    if (updates.refreshToken) {
      record.refresh_token = encrypt(updates.refreshToken, this.encryptionKey);
    }
    if (updates.tokenExpiresAt) {
      record.token_expires_at = updates.tokenExpiresAt;
    }
    if (updates.storeName) {
      record.store_name = updates.storeName;
    }
    if (updates.metadata) {
      record.metadata = updates.metadata;
    }

    const { data, error } = await this.supabase
      .from(this.credentialsTable)
      .update(record)
      .eq('id', credentialId)
      .select()
      .single();

    if (error) {
      throw new ExternalServiceError('Supabase', `Failed to update credentials: ${error.message}`);
    }

    return this.mapCredentialsFromDb(data, true);
  }

  /**
   * Delete credentials
   */
  async deleteCredentials(credentialId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from(this.credentialsTable)
      .delete()
      .eq('id', credentialId)
      .eq('user_id', userId);

    if (error) {
      throw new ExternalServiceError('Supabase', `Failed to delete credentials: ${error.message}`);
    }

    logger.info({ credentialId, userId }, 'Plugin credentials deleted');
    return true;
  }

  /**
   * Check if token needs refresh
   */
  async ensureValidToken(credentialId: string): Promise<PluginCredentials> {
    const credentials = await this.getCredentials(credentialId);
    if (!credentials) {
      throw new UnauthorizedError('Credentials not found');
    }

    // Check if token is expired or about to expire (within 5 minutes)
    if (credentials.tokenExpiresAt) {
      const expiresAt = new Date(credentials.tokenExpiresAt);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

      if (expiresAt <= fiveMinutesFromNow) {
        // Refresh token based on platform
        switch (credentials.platform) {
          case 'wix':
            return this.refreshWixToken(credentialId);
          case 'shopify':
            return this.refreshShopifyToken(credentialId);
          default:
            return credentials;
        }
      }
    }

    return credentials;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Generate OAuth state for CSRF protection
   */
  private generateOAuthState(
    userId: string,
    platform: PluginPlatform,
    storeUrl: string
  ): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const state: OAuthState = {
      userId,
      platform,
      storeUrl,
      nonce,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    // Store state in memory cache
    this.stateCache.set(nonce, state);

    // Clean up expired states
    this.cleanupExpiredStates();

    return nonce;
  }

  /**
   * Verify OAuth state
   */
  private verifyOAuthState(state: string, expectedPlatform: PluginPlatform): OAuthState {
    const oauthState = this.stateCache.get(state);

    if (!oauthState) {
      throw new ValidationError('Invalid or expired OAuth state');
    }

    if (oauthState.expiresAt < Date.now()) {
      this.stateCache.delete(state);
      throw new ValidationError('OAuth state has expired');
    }

    if (oauthState.platform !== expectedPlatform) {
      throw new ValidationError('OAuth state platform mismatch');
    }

    // Remove used state
    this.stateCache.delete(state);

    return oauthState;
  }

  /**
   * Clean up expired OAuth states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [key, state] of this.stateCache) {
      if (state.expiresAt < now) {
        this.stateCache.delete(key);
      }
    }
  }

  /**
   * Normalize Shopify store URL
   */
  private normalizeShopifyStore(storeUrl: string): string {
    let shop = storeUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    return shop;
  }

  /**
   * Normalize store URL
   */
  private normalizeStoreUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith('http')) {
      normalized = `https://${normalized}`;
    }
    return normalized.replace(/\/$/, '');
  }

  /**
   * Map database row to credentials
   */
  private mapCredentialsFromDb(row: any, decryptTokens: boolean): PluginCredentials {
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      storeUrl: row.store_url,
      storeName: row.store_name,
      accessToken: decryptTokens ? decrypt(row.access_token, this.encryptionKey) : '[ENCRYPTED]',
      refreshToken: decryptTokens && row.refresh_token
        ? decrypt(row.refresh_token, this.encryptionKey)
        : undefined,
      tokenExpiresAt: row.token_expires_at,
      scopes: row.scopes || [],
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create plugin auth service with environment variables
 */
export function createPluginAuthService(config?: Partial<PluginAuthConfig>): PluginAuthService {
  return new PluginAuthService({
    supabaseUrl: config?.supabaseUrl || process.env.SUPABASE_URL || '',
    supabaseKey: config?.supabaseKey || process.env.SUPABASE_SERVICE_KEY || '',
    encryptionKey: config?.encryptionKey || process.env.PLUGIN_ENCRYPTION_KEY || '',
    shopify: config?.shopify || (process.env.SHOPIFY_CLIENT_ID ? {
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET || '',
      redirectUri: process.env.SHOPIFY_REDIRECT_URI || '',
      scopes: (process.env.SHOPIFY_SCOPES || 'read_products').split(','),
    } : undefined),
    woocommerce: config?.woocommerce,
    wix: config?.wix || (process.env.WIX_CLIENT_ID ? {
      clientId: process.env.WIX_CLIENT_ID,
      clientSecret: process.env.WIX_CLIENT_SECRET || '',
      redirectUri: process.env.WIX_REDIRECT_URI || '',
      scopes: (process.env.WIX_SCOPES || 'stores.read_products').split(','),
    } : undefined),
  });
}
