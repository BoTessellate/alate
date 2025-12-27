/**
 * Brand Authentication
 * Handles brand login and session management
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

export interface BrandCredentials {
  email: string;
  password: string;
}

export interface BrandRegistration extends BrandCredentials {
  brand_name: string;
  website?: string;
  industry?: string;
}

export interface BrandSession {
  success: boolean;
  brand_id?: string;
  brand_name?: string;
  email?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  error?: string;
}

export interface BrandProfile {
  brand_id: string;
  brand_name: string;
  email: string;
  website?: string;
  industry?: string;
  created_at: string;
  total_products: number;
  active_syncs: number;
}

/**
 * Brand authentication service
 */
export class BrandAuthenticator {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Login brand with email and password
   */
  async login(credentials: BrandCredentials): Promise<BrandSession> {
    try {
      const { email, password } = credentials;

      // Validate input
      if (!email || !password) {
        return {
          success: false,
          error: 'Email and password are required'
        };
      }

      // Find brand by email
      const { data: brand, error: findError } = await this.supabase
        .from('brands')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (findError || !brand) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, brand.password_hash);
      if (!passwordMatch) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check if brand is active
      if (brand.status !== 'active') {
        return {
          success: false,
          error: 'Brand account is not active. Please contact support.'
        };
      }

      // Create session using Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email: brand.email,
        password: password
      });

      if (authError) {
        // Fallback: create custom session token
        const sessionToken = await this.createCustomSession(brand.id);
        return {
          success: true,
          brand_id: brand.id,
          brand_name: brand.brand_name,
          email: brand.email,
          access_token: sessionToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };
      }

      // Update last login
      await this.supabase
        .from('brands')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', brand.id);

      return {
        success: true,
        brand_id: brand.id,
        brand_name: brand.brand_name,
        email: brand.email,
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at ? String(authData.session.expires_at) : undefined
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Register new brand
   */
  async register(registration: BrandRegistration): Promise<BrandSession> {
    try {
      const { email, password, brand_name, website, industry } = registration;

      // Validate input
      if (!email || !password || !brand_name) {
        return {
          success: false,
          error: 'Email, password, and brand name are required'
        };
      }

      // Check if email already exists
      const { data: existing } = await this.supabase
        .from('brands')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existing) {
        return {
          success: false,
          error: 'Email already registered'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create brand record
      const { data: brand, error: createError } = await this.supabase
        .from('brands')
        .insert({
          email: email.toLowerCase(),
          password_hash: passwordHash,
          brand_name,
          website,
          industry,
          status: 'active',
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError || !brand) {
        return {
          success: false,
          error: 'Failed to create brand account'
        };
      }

      // Try to create Supabase Auth user
      const { data: authData, error: authError } = await this.supabase.auth.signUp({
        email: brand.email,
        password: password
      });

      if (authError) {
        // Fallback: create custom session token
        const sessionToken = await this.createCustomSession(brand.id);
        return {
          success: true,
          brand_id: brand.id,
          brand_name: brand.brand_name,
          email: brand.email,
          access_token: sessionToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
      }

      return {
        success: true,
        brand_id: brand.id,
        brand_name: brand.brand_name,
        email: brand.email,
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at ? String(authData.session.expires_at) : undefined
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Logout brand
   */
  async logout(accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        console.warn('Logout warning:', error);
      }

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get brand profile
   */
  async getProfile(brandId: string): Promise<BrandProfile | null> {
    try {
      // Get brand data
      const { data: brand, error: brandError } = await this.supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (brandError || !brand) {
        return null;
      }

      // Get product count
      const { count: productCount } = await this.supabase
        .from('enriched_products')
        .select('*', { count: 'exact', head: true })
        .eq('brand', brand.brand_name);

      // Get active sync count
      const { count: syncCount } = await this.supabase
        .from('plugin_syncs')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('status', 'active');

      return {
        brand_id: brand.id,
        brand_name: brand.brand_name,
        email: brand.email,
        website: brand.website,
        industry: brand.industry,
        created_at: brand.created_at,
        total_products: productCount || 0,
        active_syncs: syncCount || 0
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  /**
   * Verify session token
   */
  async verifyToken(accessToken: string): Promise<{ valid: boolean; brand_id?: string }> {
    try {
      const { data, error } = await this.supabase.auth.getUser(accessToken);

      if (error || !data.user) {
        // Try custom token verification
        return await this.verifyCustomToken(accessToken);
      }

      // Find brand by email
      const { data: brand } = await this.supabase
        .from('brands')
        .select('id')
        .eq('email', data.user.email)
        .single();

      return {
        valid: true,
        brand_id: brand?.id
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Create custom session token (fallback)
   */
  private async createCustomSession(brandId: string): Promise<string> {
    const token = `brand_${brandId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Store session in database
    await this.supabase
      .from('brand_sessions')
      .insert({
        brand_id: brandId,
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      });

    return token;
  }

  /**
   * Verify custom session token (fallback)
   */
  private async verifyCustomToken(token: string): Promise<{ valid: boolean; brand_id?: string }> {
    try {
      const { data: session, error } = await this.supabase
        .from('brand_sessions')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !session) {
        return { valid: false };
      }

      return {
        valid: true,
        brand_id: session.brand_id
      };
    } catch (error) {
      return { valid: false };
    }
  }
}

/**
 * Create brand authenticator instance
 */
export function createBrandAuthenticator(): BrandAuthenticator {
  return new BrandAuthenticator();
}
