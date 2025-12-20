/**
 * Sync Mode Management
 *
 * Allows brands to toggle between automatic and manual syncing.
 * This is a simpler toggle that works alongside the schedule settings.
 *
 * - "auto": Syncs happen automatically based on schedule (daily/weekly)
 * - "manual": Syncs only happen when user triggers them
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sync mode options
 */
export type SyncMode = 'auto' | 'manual';

/**
 * Request to set sync mode
 */
export interface SetSyncModeRequest {
  brand_id: string;
  platform: 'shopify' | 'woocommerce' | 'wix';
  sync_mode: SyncMode;
}

/**
 * Response from setting sync mode
 */
export interface SetSyncModeResponse {
  success: boolean;
  sync_mode?: SyncMode;
  error?: string;
}

/**
 * Request to get sync mode
 */
export interface GetSyncModeRequest {
  brand_id: string;
  platform?: 'shopify' | 'woocommerce' | 'wix';
}

/**
 * Response with sync mode(s)
 */
export interface GetSyncModeResponse {
  success: boolean;
  modes: Array<{
    platform: string;
    sync_mode: SyncMode;
  }>;
  error?: string;
}

// =============================================================================
// SYNC MODE SERVICE
// =============================================================================

/**
 * Sync Mode Service
 * Manages auto/manual sync mode for brand integrations
 */
export class SyncModeService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Set sync mode for a brand's integration
   */
  async setSyncMode(request: SetSyncModeRequest): Promise<SetSyncModeResponse> {
    try {
      const { brand_id, platform, sync_mode } = request;

      // Validate sync mode
      if (!['auto', 'manual'].includes(sync_mode)) {
        return { success: false, error: 'Invalid sync mode. Must be "auto" or "manual"' };
      }

      // Update brand integration
      const { data, error } = await this.supabase
        .from('brand_integrations')
        .update({
          sync_mode,
          updated_at: new Date().toISOString(),
        })
        .eq('brand_id', brand_id)
        .eq('platform', platform)
        .select('sync_mode')
        .single();

      if (error) {
        // If no row exists, try to insert
        if (error.code === 'PGRST116') {
          const { data: insertData, error: insertError } = await this.supabase
            .from('brand_integrations')
            .insert({
              brand_id,
              platform,
              sync_mode,
              is_connected: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('sync_mode')
            .single();

          if (insertError) {
            console.error('[SyncModeService] Insert error:', insertError);
            return { success: false, error: 'Failed to set sync mode' };
          }

          return { success: true, sync_mode: insertData.sync_mode };
        }

        console.error('[SyncModeService] Update error:', error);
        return { success: false, error: 'Failed to update sync mode' };
      }

      return { success: true, sync_mode: data.sync_mode };
    } catch (error: any) {
      console.error('[SyncModeService] setSyncMode error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync mode for a brand
   */
  async getSyncMode(request: GetSyncModeRequest): Promise<GetSyncModeResponse> {
    try {
      const { brand_id, platform } = request;

      let query = this.supabase
        .from('brand_integrations')
        .select('platform, sync_mode')
        .eq('brand_id', brand_id);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SyncModeService] Get error:', error);
        return { success: false, modes: [], error: 'Failed to get sync mode' };
      }

      const modes = (data || []).map((integration) => ({
        platform: integration.platform,
        sync_mode: (integration.sync_mode as SyncMode) || 'manual', // Default to manual
      }));

      return { success: true, modes };
    } catch (error: any) {
      console.error('[SyncModeService] getSyncMode error:', error.message);
      return { success: false, modes: [], error: error.message };
    }
  }

  /**
   * Check if a brand should be auto-synced
   */
  async shouldAutoSync(brandId: string, platform: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('brand_integrations')
        .select('sync_mode, is_connected')
        .eq('brand_id', brandId)
        .eq('platform', platform)
        .single();

      if (error || !data) {
        return false;
      }

      // Only auto-sync if mode is "auto" and integration is connected
      return data.sync_mode === 'auto' && data.is_connected === true;
    } catch (error) {
      return false;
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create sync mode service instance
 */
export function createSyncModeService(): SyncModeService {
  return new SyncModeService();
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Set sync mode for a brand (convenience function)
 */
export async function setSyncMode(
  request: SetSyncModeRequest
): Promise<SetSyncModeResponse> {
  const service = createSyncModeService();
  return service.setSyncMode(request);
}

/**
 * Get sync mode for a brand (convenience function)
 */
export async function getSyncMode(
  request: GetSyncModeRequest
): Promise<GetSyncModeResponse> {
  const service = createSyncModeService();
  return service.getSyncMode(request);
}

/**
 * Check if brand should auto-sync (convenience function)
 */
export async function shouldAutoSync(
  brandId: string,
  platform: string
): Promise<boolean> {
  const service = createSyncModeService();
  return service.shouldAutoSync(brandId, platform);
}
