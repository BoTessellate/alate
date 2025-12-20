/**
 * Supabase Client Factory
 *
 * Centralized, secure Supabase client creation with environment validation.
 *
 * SECURITY ARCHITECTURE:
 * - Production: Use SecureApiClient (Edge Function) for all operations
 * - Development: Direct Supabase client with service role key
 *
 * Environment Variables:
 * - SUPABASE_URL: Required in all environments
 * - SUPABASE_KEY: Service role key (NEVER expose to frontend)
 * - NODE_ENV: 'production' | 'development'
 *
 * Usage:
 * ```typescript
 * import { getSupabaseClient, isProduction } from './supabaseClient';
 *
 * // Get configured client
 * const supabase = getSupabaseClient();
 *
 * // Check environment
 * if (isProduction()) {
 *   // Use SecureApiClient instead
 * }
 * ```
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface SupabaseConfig {
  url: string;
  key: string;
}

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return !isProduction();
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate Supabase configuration
 * @throws Error if configuration is missing or invalid
 */
export function validateSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url) {
    throw new Error(
      'SUPABASE_URL is not configured. ' +
      'Set it in your environment variables or .env file.'
    );
  }

  if (!key) {
    throw new Error(
      'SUPABASE_KEY is not configured. ' +
      (isProduction()
        ? 'Set it in your hosting platform environment variables (Vercel, etc.).'
        : 'Set it in your .env file for local development.')
    );
  }

  // Validate URL format
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    throw new Error(
      'SUPABASE_URL appears invalid. Expected format: https://your-project.supabase.co'
    );
  }

  // Warn if service role key is used in production without Edge Function
  if (isProduction() && key.includes('service_role')) {
    console.warn(
      '[SECURITY WARNING] Using service_role key directly in production. ' +
      'Consider routing through SecureApiClient (Edge Function) instead.'
    );
  }

  return { url, key };
}

// =============================================================================
// CLIENT SINGLETON
// =============================================================================

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get a singleton Supabase client instance
 *
 * @returns Configured SupabaseClient
 * @throws Error if configuration is missing
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const config = validateSupabaseConfig();
    supabaseInstance = createClient(config.url, config.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseInstance;
}

/**
 * Create a new Supabase client instance (non-singleton)
 * Use when you need isolated client instances
 *
 * @returns New SupabaseClient instance
 */
export function createSupabaseClient(): SupabaseClient {
  const config = validateSupabaseConfig();
  return createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create Supabase client with custom config
 * For cases where you need to override defaults
 */
export function createSupabaseClientWithConfig(
  url: string,
  key: string
): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Get Supabase URL (safe to expose)
 */
export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('SUPABASE_URL is not configured');
  }
  return url;
}

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  try {
    validateSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get masked key for logging (shows first/last 4 chars)
 */
export function getMaskedKey(): string {
  const key = process.env.SUPABASE_KEY || '';
  if (key.length < 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default getSupabaseClient;
