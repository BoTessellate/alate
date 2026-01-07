/**
 * Plugin Authentication Module
 * Validates API tokens and credentials for external platforms
 *
 * ============================================================================
 * INTEGRATION STATUS: NOT WIRED TO FRONTEND
 * ============================================================================
 * Database Tables Used:
 * - `plugin_credentials` table: Encrypted API keys for platforms
 * - `plugin_syncs` table: Sync job records
 * - `plugin_sync_logs` table: Detailed sync logs
 * - `sync_errors` table: Error tracking
 *
 * Supported Platforms:
 * - Canva (see `canva/canvaSearch.ts`, `canva/canvaInsert.ts`)
 * - WooCommerce (see `commerce/wooSync.ts`)
 * - Shopify (see `commerce/shopifySync.ts`)
 *
 * To Wire Up:
 * 1. Create plugin settings page in frontend
 * 2. Implement credential input forms
 * 3. Add sync status dashboard
 * 4. Connect to plugin-specific flows
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PluginPlatform, PluginAuthCredentials, PluginAuthResult } from './types';

/**
 * Plugin Authenticator Class
 */
export class PluginAuthenticator {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Authenticate plugin credentials
   */
  async authenticate(credentials: PluginAuthCredentials): Promise<PluginAuthResult> {
    const { platform, api_key, access_token, shop_domain, user_id } = credentials;

    try {
      // For development/testing, allow simple API key validation
      if (api_key) {
        const isValid = await this.validateApiKey(api_key, platform);
        if (isValid) {
          return {
            authenticated: true,
            platform,
            user_id: user_id || this.extractUserIdFromKey(api_key)
          };
        }
      }

      // Platform-specific authentication
      switch (platform) {
        case 'shopify':
          return await this.authenticateShopify(shop_domain!, access_token!);

        case 'woocommerce':
          return await this.authenticateWooCommerce(shop_domain!, api_key!);

        case 'canva':
          return await this.authenticateCanva(access_token!);

        default:
          return {
            authenticated: false,
            platform,
            error: `Platform ${platform} not supported`
          };
      }
    } catch (error) {
      return {
        authenticated: false,
        platform,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Validate API key against database
   */
  private async validateApiKey(apiKey: string, platform: PluginPlatform): Promise<boolean> {
    // Check if API key exists in plugin_credentials table
    const { data, error } = await this.supabase
      .from('plugin_credentials')
      .select('*')
      .eq('api_key', apiKey)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // For development, accept test keys
      return apiKey.startsWith('test_') || apiKey.startsWith('dev_');
    }

    return true;
  }

  /**
   * Authenticate Shopify credentials
   */
  private async authenticateShopify(shopDomain: string, accessToken: string): Promise<PluginAuthResult> {
    // Validate shop domain format
    if (!shopDomain || !shopDomain.includes('.myshopify.com')) {
      return {
        authenticated: false,
        platform: 'shopify',
        error: 'Invalid shop domain format'
      };
    }

    // In production, verify with Shopify API
    // For now, accept valid format + token
    if (accessToken && accessToken.length > 10) {
      return {
        authenticated: true,
        platform: 'shopify',
        user_id: shopDomain.split('.')[0]
      };
    }

    return {
      authenticated: false,
      platform: 'shopify',
      error: 'Invalid access token'
    };
  }

  /**
   * Authenticate WooCommerce credentials
   */
  private async authenticateWooCommerce(shopDomain: string, apiKey: string): Promise<PluginAuthResult> {
    // Validate domain and API key
    if (!shopDomain || !apiKey) {
      return {
        authenticated: false,
        platform: 'woocommerce',
        error: 'Missing shop domain or API key'
      };
    }

    // In production, verify with WooCommerce REST API
    // For now, accept valid format
    if (apiKey.startsWith('ck_') || apiKey.startsWith('test_')) {
      return {
        authenticated: true,
        platform: 'woocommerce',
        user_id: this.extractDomainName(shopDomain)
      };
    }

    return {
      authenticated: false,
      platform: 'woocommerce',
      error: 'Invalid API key format'
    };
  }

  /**
   * Authenticate Canva credentials
   */
  private async authenticateCanva(accessToken: string): Promise<PluginAuthResult> {
    // For Canva, we typically use OAuth tokens
    if (!accessToken) {
      return {
        authenticated: false,
        platform: 'canva',
        error: 'Missing access token'
      };
    }

    // In production, verify with Canva API
    // For now, accept valid token format
    if (accessToken.length > 20) {
      return {
        authenticated: true,
        platform: 'canva',
        user_id: 'canva_user'
      };
    }

    return {
      authenticated: false,
      platform: 'canva',
      error: 'Invalid access token'
    };
  }

  /**
   * Extract user ID from API key
   */
  private extractUserIdFromKey(apiKey: string): string {
    // Simple extraction logic
    return apiKey.split('_')[1] || 'unknown';
  }

  /**
   * Extract domain name from URL
   */
  private extractDomainName(domain: string): string {
    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      const hostname = new URL(url).hostname;
      return hostname.split('.')[0];
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Express middleware for plugin authentication
 */
export function createPluginAuthMiddleware(supabaseUrl: string, supabaseKey: string) {
  const authenticator = new PluginAuthenticator(supabaseUrl, supabaseKey);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract credentials from request
      const authHeader = req.headers.authorization;
      const platform = (req.headers['x-plugin-platform'] as PluginPlatform) || 'canva';
      const shopDomain = req.headers['x-shop-domain'] as string;

      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: 'Missing authorization header'
        });
      }

      // Parse authorization header
      const token = authHeader.replace('Bearer ', '');

      const credentials: PluginAuthCredentials = {
        platform,
        api_key: token.startsWith('test_') || token.startsWith('dev_') ? token : undefined,
        access_token: !token.startsWith('test_') && !token.startsWith('dev_') ? token : undefined,
        shop_domain: shopDomain
      };

      // Authenticate
      const authResult = await authenticator.authenticate(credentials);

      if (!authResult.authenticated) {
        return res.status(401).json({
          success: false,
          error: authResult.error || 'Authentication failed'
        });
      }

      // Attach auth info to request
      (req as any).pluginAuth = authResult;

      next();
    } catch (error) {
      console.error('Plugin auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authentication error'
      });
    }
  };
}

/**
 * Create plugin authenticator instance
 */
export function createPluginAuthenticator(
  supabaseUrl: string,
  supabaseKey: string
): PluginAuthenticator {
  return new PluginAuthenticator(supabaseUrl, supabaseKey);
}
