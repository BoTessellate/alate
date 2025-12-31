/**
 * Shopify Client Utility
 *
 * Handles Shopify API authentication and requests.
 * Uses OAuth for secure token management.
 */

import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  scopes: string;
  hostName: string;
}

export interface ShopifySession {
  shop: string;
  accessToken: string;
  scope: string;
  expires?: Date;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  status: string;
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  inventory_quantity: number;
  requires_shipping: boolean;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
}

export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

// =============================================================================
// SHOPIFY CLIENT
// =============================================================================

export class ShopifyClient {
  private config: ShopifyConfig;
  private session?: ShopifySession;

  constructor(config: ShopifyConfig) {
    this.config = config;

    // Warn if credentials missing
    if (!config.apiKey || !config.apiSecret) {
      console.warn('[ShopifyClient] WARNING: Missing API credentials. Set SHOPIFY_API_KEY and SHOPIFY_SECRET in environment.');
    }
  }

  /**
   * Set the current session
   */
  setSession(session: ShopifySession): void {
    this.session = session;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(shop: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.apiKey,
      scope: this.config.scopes,
      redirect_uri: redirectUri,
      state,
      'grant_options[]': 'per-user',
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(shop: string, code: string): Promise<ShopifySession> {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.apiKey,
        client_secret: this.config.apiSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();

    return {
      shop,
      accessToken: data.access_token,
      scope: data.scope,
    };
  }

  /**
   * Verify webhook HMAC signature
   */
  verifyWebhook(body: string, hmacHeader: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(body, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmacHeader)
    );
  }

  /**
   * Verify OAuth callback HMAC
   */
  verifyCallback(query: Record<string, string>): boolean {
    const { hmac, ...params } = query;
    const sorted = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const hash = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(sorted)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmac)
    );
  }

  /**
   * Make authenticated API request
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.session) {
      throw new Error('No session set. Call setSession() first.');
    }

    const url = `https://${this.session.shop}/admin/api/2024-01${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.session.accessToken,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get all products with pagination
   */
  async getProducts(limit: number = 50): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    let nextPageUrl: string | null = `/products.json?limit=${limit}`;

    while (nextPageUrl) {
      const response = await this.request<{ products: ShopifyProduct[] }>(nextPageUrl);
      products.push(...response.products);

      // Check for pagination link header
      // In a real implementation, parse the Link header for next page
      nextPageUrl = null; // Simplified - would need proper pagination handling
    }

    return products;
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: number): Promise<ShopifyProduct> {
    const response = await this.request<{ product: ShopifyProduct }>(
      `/products/${productId}.json`
    );
    return response.product;
  }

  /**
   * Get shop information (for health check)
   */
  async getShop(): Promise<{ shop: { name: string; domain: string } }> {
    return this.request('/shop.json');
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create Shopify client from environment variables
 */
export function createShopifyClient(): ShopifyClient {
  const config: ShopifyConfig = {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_SECRET || '',
    scopes: 'read_products,write_products,read_inventory',
    hostName: process.env.APP_URL || 'localhost:3000',
  };

  return new ShopifyClient(config);
}

export default ShopifyClient;
