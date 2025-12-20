/**
 * Sync Schedule Management
 * Allows brands to set their preferred sync frequency for Shopify/WooCommerce integrations
 *
 * Options:
 * - Manual: Only sync when triggered by user
 * - Daily: Automatic sync at 00:00 UTC
 * - Weekly: Automatic sync on Monday at 00:00 UTC
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sync schedule options
 */
export type SyncScheduleType = 'manual' | 'daily' | 'weekly';

/**
 * Sync schedule configuration
 */
export interface SyncScheduleConfig {
  schedule_type: SyncScheduleType;
  /** UTC hour for sync (0-23), default 0 */
  sync_hour?: number;
  /** Day of week for weekly sync (0=Sunday, 1=Monday, etc.), default 1 (Monday) */
  sync_day?: number;
  /** Whether schedule is currently active */
  is_active: boolean;
  /** Timezone for display purposes (syncs always run at UTC) */
  display_timezone?: string;
}

/**
 * Request to set sync schedule
 */
export interface SetSyncScheduleRequest {
  brand_id: string;
  platform: 'shopify' | 'woocommerce' | 'wix';
  schedule: SyncScheduleConfig;
}

/**
 * Response from setting sync schedule
 */
export interface SetSyncScheduleResponse {
  success: boolean;
  schedule?: SyncScheduleConfig;
  next_sync_at?: string;
  error?: string;
}

/**
 * Brand integration record from database
 */
export interface BrandIntegration {
  id: string;
  brand_id: string;
  platform: string;
  shop_domain?: string;
  access_token?: string;
  sync_schedule: SyncScheduleConfig;
  last_sync_at?: string;
  next_sync_at?: string;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request to get current schedule
 */
export interface GetSyncScheduleRequest {
  brand_id: string;
  platform?: 'shopify' | 'woocommerce' | 'wix';
}

/**
 * Response with current schedule(s)
 */
export interface GetSyncScheduleResponse {
  success: boolean;
  schedules: Array<{
    platform: string;
    schedule: SyncScheduleConfig;
    next_sync_at?: string;
    last_sync_at?: string;
  }>;
  error?: string;
}

// =============================================================================
// SYNC SCHEDULE SERVICE
// =============================================================================

/**
 * Sync Schedule Service
 * Manages sync schedule settings for brand integrations
 */
export class SyncScheduleService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Set sync schedule for a brand's integration
   */
  async setSyncSchedule(request: SetSyncScheduleRequest): Promise<SetSyncScheduleResponse> {
    try {
      const { brand_id, platform, schedule } = request;

      // Validate schedule
      const validationError = this.validateSchedule(schedule);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Calculate next sync time
      const next_sync_at = this.calculateNextSyncTime(schedule);

      // Update or insert brand integration
      const { data, error } = await this.supabase
        .from('brand_integrations')
        .upsert(
          {
            brand_id,
            platform,
            sync_schedule: schedule,
            next_sync_at: next_sync_at?.toISOString() || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'brand_id,platform',
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[SyncScheduleService] Update error:', error);
        return { success: false, error: 'Failed to update sync schedule' };
      }

      return {
        success: true,
        schedule: data.sync_schedule,
        next_sync_at: data.next_sync_at,
      };
    } catch (error: any) {
      console.error('[SyncScheduleService] setSyncSchedule error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync schedule for a brand
   */
  async getSyncSchedule(request: GetSyncScheduleRequest): Promise<GetSyncScheduleResponse> {
    try {
      const { brand_id, platform } = request;

      let query = this.supabase
        .from('brand_integrations')
        .select('platform, sync_schedule, next_sync_at, last_sync_at')
        .eq('brand_id', brand_id);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SyncScheduleService] Get error:', error);
        return { success: false, schedules: [], error: 'Failed to get sync schedule' };
      }

      const schedules = (data || []).map((integration) => ({
        platform: integration.platform,
        schedule: integration.sync_schedule || this.getDefaultSchedule(),
        next_sync_at: integration.next_sync_at,
        last_sync_at: integration.last_sync_at,
      }));

      return { success: true, schedules };
    } catch (error: any) {
      console.error('[SyncScheduleService] getSyncSchedule error:', error.message);
      return { success: false, schedules: [], error: error.message };
    }
  }

  /**
   * Get all brands due for sync at a given time
   */
  async getBrandsDueForSync(scheduleType: 'daily' | 'weekly'): Promise<BrandIntegration[]> {
    try {
      const now = new Date();

      // Query brands with matching schedule type and next_sync_at <= now
      const { data, error } = await this.supabase
        .from('brand_integrations')
        .select('*')
        .eq('sync_schedule->>schedule_type', scheduleType)
        .eq('sync_schedule->>is_active', true)
        .lte('next_sync_at', now.toISOString())
        .eq('is_connected', true);

      if (error) {
        console.error('[SyncScheduleService] getBrandsDueForSync error:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('[SyncScheduleService] getBrandsDueForSync error:', error.message);
      return [];
    }
  }

  /**
   * Mark a brand as synced and calculate next sync time
   */
  async markSynced(brandId: string, platform: string): Promise<void> {
    try {
      // Get current schedule
      const { data: integration } = await this.supabase
        .from('brand_integrations')
        .select('sync_schedule')
        .eq('brand_id', brandId)
        .eq('platform', platform)
        .single();

      if (!integration) return;

      const schedule = integration.sync_schedule as SyncScheduleConfig;
      const next_sync_at = this.calculateNextSyncTime(schedule);

      await this.supabase
        .from('brand_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          next_sync_at: next_sync_at?.toISOString() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('brand_id', brandId)
        .eq('platform', platform);
    } catch (error: any) {
      console.error('[SyncScheduleService] markSynced error:', error.message);
    }
  }

  /**
   * Trigger a manual sync for a brand
   */
  async triggerManualSync(
    brandId: string,
    platform: string
  ): Promise<{ success: boolean; sync_id?: string; error?: string }> {
    try {
      // Create a new sync record
      const { data, error } = await this.supabase
        .from('plugin_syncs')
        .insert({
          brand_id: brandId,
          platform,
          status: 'pending',
          started_at: new Date().toISOString(),
          sync_config: {
            trigger: 'manual',
            triggered_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) {
        console.error('[SyncScheduleService] triggerManualSync error:', error);
        return { success: false, error: 'Failed to create sync job' };
      }

      return { success: true, sync_id: data.id };
    } catch (error: any) {
      console.error('[SyncScheduleService] triggerManualSync error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Validate schedule configuration
   */
  private validateSchedule(schedule: SyncScheduleConfig): string | null {
    const validTypes: SyncScheduleType[] = ['manual', 'daily', 'weekly'];
    if (!validTypes.includes(schedule.schedule_type)) {
      return `Invalid schedule type. Must be one of: ${validTypes.join(', ')}`;
    }

    if (schedule.sync_hour !== undefined) {
      if (schedule.sync_hour < 0 || schedule.sync_hour > 23) {
        return 'Sync hour must be between 0 and 23';
      }
    }

    if (schedule.sync_day !== undefined) {
      if (schedule.sync_day < 0 || schedule.sync_day > 6) {
        return 'Sync day must be between 0 (Sunday) and 6 (Saturday)';
      }
    }

    return null;
  }

  /**
   * Calculate next sync time based on schedule
   */
  private calculateNextSyncTime(schedule: SyncScheduleConfig): Date | null {
    if (schedule.schedule_type === 'manual' || !schedule.is_active) {
      return null;
    }

    const now = new Date();
    const syncHour = schedule.sync_hour ?? 0;

    if (schedule.schedule_type === 'daily') {
      // Next occurrence at syncHour UTC
      const next = new Date(now);
      next.setUTCHours(syncHour, 0, 0, 0);

      // If past today's time, move to tomorrow
      if (next <= now) {
        next.setUTCDate(next.getUTCDate() + 1);
      }

      return next;
    }

    if (schedule.schedule_type === 'weekly') {
      // Next occurrence on syncDay at syncHour UTC
      const syncDay = schedule.sync_day ?? 1; // Default Monday
      const next = new Date(now);
      next.setUTCHours(syncHour, 0, 0, 0);

      // Find next occurrence of syncDay
      const currentDay = next.getUTCDay();
      let daysUntilSync = syncDay - currentDay;

      if (daysUntilSync < 0 || (daysUntilSync === 0 && next <= now)) {
        daysUntilSync += 7;
      }

      next.setUTCDate(next.getUTCDate() + daysUntilSync);

      return next;
    }

    return null;
  }

  /**
   * Get default schedule (manual)
   */
  private getDefaultSchedule(): SyncScheduleConfig {
    return {
      schedule_type: 'manual',
      is_active: true,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create sync schedule service instance
 */
export function createSyncScheduleService(): SyncScheduleService {
  return new SyncScheduleService();
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Set sync schedule for a brand (convenience function)
 */
export async function setSyncSchedule(
  request: SetSyncScheduleRequest
): Promise<SetSyncScheduleResponse> {
  const service = createSyncScheduleService();
  return service.setSyncSchedule(request);
}

/**
 * Get sync schedule for a brand (convenience function)
 */
export async function getSyncSchedule(
  request: GetSyncScheduleRequest
): Promise<GetSyncScheduleResponse> {
  const service = createSyncScheduleService();
  return service.getSyncSchedule(request);
}

/**
 * Trigger manual sync for a brand (convenience function)
 */
export async function triggerManualSync(
  brandId: string,
  platform: string
): Promise<{ success: boolean; sync_id?: string; error?: string }> {
  const service = createSyncScheduleService();
  return service.triggerManualSync(brandId, platform);
}
