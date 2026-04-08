/**
 * Sync Brands Scheduler
 *
 * Cloud function run via scheduled cron jobs.
 * Checks each brand's sync settings and triggers webhook pulls for due syncs.
 *
 * Cron Setup (Supabase):
 * - Daily:  cron(0 0 * * *)   - runs at 00:00 UTC every day
 * - Weekly: cron(0 0 * * 1)   - runs at 00:00 UTC every Monday
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

interface SyncScheduleConfig {
  schedule_type: 'manual' | 'daily' | 'weekly';
  sync_hour?: number;
  sync_day?: number;
  is_active: boolean;
}

interface BrandIntegration {
  id: string;
  brand_id: string;
  platform: string;
  shop_domain?: string;
  access_token?: string;
  sync_schedule: SyncScheduleConfig;
  sync_mode: 'auto' | 'manual';
  next_sync_at?: string;
  is_connected: boolean;
}

interface SyncJobResult {
  brand_id: string;
  platform: string;
  success: boolean;
  sync_id?: string;
  error?: string;
  duration_ms?: number;
}

interface SchedulerResult {
  schedule_type: 'daily' | 'weekly';
  run_at: string;
  brands_checked: number;
  syncs_triggered: number;
  syncs_failed: number;
  results: SyncJobResult[];
}

// =============================================================================
// SCHEDULER CLASS
// =============================================================================

/**
 * Sync Brands Scheduler
 * Orchestrates scheduled sync jobs for all brands
 */
export class SyncBrandsScheduler {
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
   * Run scheduled sync for a specific schedule type
   *
   * @param scheduleType - 'daily' or 'weekly'
   */
  async runScheduledSync(scheduleType: 'daily' | 'weekly'): Promise<SchedulerResult> {
    const startTime = Date.now();
    const results: SyncJobResult[] = [];

    console.log(`[SyncBrandsScheduler] Starting ${scheduleType} sync run at ${new Date().toISOString()}`);

    try {
      // Get all brands due for sync
      const brandsDue = await this.getBrandsDueForSync(scheduleType);

      console.log(`[SyncBrandsScheduler] Found ${brandsDue.length} brands due for ${scheduleType} sync`);

      // Process each brand
      for (const integration of brandsDue) {
        const result = await this.processBrandSync(integration);
        results.push(result);

        // Log individual result
        if (result.success) {
          console.log(`[SyncBrandsScheduler] Triggered sync for ${integration.brand_id}/${integration.platform}`);
        } else {
          console.error(`[SyncBrandsScheduler] Failed sync for ${integration.brand_id}/${integration.platform}: ${result.error}`);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      console.log(`[SyncBrandsScheduler] ${scheduleType} run complete. Success: ${successCount}, Failed: ${failCount}`);

      return {
        schedule_type: scheduleType,
        run_at: new Date().toISOString(),
        brands_checked: brandsDue.length,
        syncs_triggered: successCount,
        syncs_failed: failCount,
        results,
      };
    } catch (error: any) {
      console.error(`[SyncBrandsScheduler] Scheduler error:`, error.message);

      return {
        schedule_type: scheduleType,
        run_at: new Date().toISOString(),
        brands_checked: 0,
        syncs_triggered: 0,
        syncs_failed: 1,
        results: [
          {
            brand_id: 'scheduler',
            platform: 'system',
            success: false,
            error: error.message,
          },
        ],
      };
    }
  }

  /**
   * Get all brands due for sync
   */
  private async getBrandsDueForSync(scheduleType: 'daily' | 'weekly'): Promise<BrandIntegration[]> {
    try {
      const now = new Date();

      // Query brands with matching schedule type that are due
      const { data, error } = await this.supabase
        .from('brand_integrations')
        .select('*')
        .eq('is_connected', true)
        .not('sync_schedule', 'is', null);

      if (error) {
        console.error('[SyncBrandsScheduler] Query error:', error);
        return [];
      }

      // Filter in application code for more complex logic
      const dueBrands = (data || []).filter((integration) => {
        const schedule = integration.sync_schedule as SyncScheduleConfig;

        // Skip if sync_mode is "manual" - only auto syncs are processed by scheduler
        const syncMode = integration.sync_mode || 'manual';
        if (syncMode === 'manual') {
          return false;
        }

        // Must match schedule type and be active
        if (schedule.schedule_type !== scheduleType || !schedule.is_active) {
          return false;
        }

        // Check if next_sync_at is due
        if (integration.next_sync_at) {
          const nextSync = new Date(integration.next_sync_at);
          return nextSync <= now;
        }

        // If no next_sync_at set, consider it due
        return true;
      });

      return dueBrands;
    } catch (error: any) {
      console.error('[SyncBrandsScheduler] getBrandsDueForSync error:', error.message);
      return [];
    }
  }

  /**
   * Process sync for a single brand integration
   */
  private async processBrandSync(integration: BrandIntegration): Promise<SyncJobResult> {
    const startTime = Date.now();

    try {
      // Create sync job record
      const { data: syncJob, error: createError } = await this.supabase
        .from('plugin_syncs')
        .insert({
          brand_id: integration.brand_id,
          platform: integration.platform,
          status: 'pending',
          started_at: new Date().toISOString(),
          sync_config: {
            trigger: 'scheduled',
            schedule_type: integration.sync_schedule.schedule_type,
            shop_domain: integration.shop_domain,
          },
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create sync job: ${createError.message}`);
      }

      // Trigger the actual sync (platform-specific)
      await this.triggerPlatformSync(integration, syncJob.id);

      // Update next_sync_at for this integration
      await this.updateNextSyncTime(integration);

      return {
        brand_id: integration.brand_id,
        platform: integration.platform,
        success: true,
        sync_id: syncJob.id,
        duration_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      // Log error to sync_errors table
      await this.logSyncError(integration.brand_id, integration.platform, error.message);

      return {
        brand_id: integration.brand_id,
        platform: integration.platform,
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Trigger platform-specific sync
   */
  private async triggerPlatformSync(integration: BrandIntegration, syncId: string): Promise<void> {
    const { platform, shop_domain, access_token } = integration;

    // Update sync status to active
    await this.supabase
      .from('plugin_syncs')
      .update({ status: 'active' })
      .eq('id', syncId);

    // Platform-specific sync logic would go here
    // For now, we simulate by calling the appropriate webhook endpoint
    switch (platform) {
      case 'shopify':
        await this.syncShopify(integration, syncId);
        break;
      case 'woocommerce':
        await this.syncWooCommerce(integration, syncId);
        break;
      case 'wix':
        await this.syncWix(integration, syncId);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Sync Shopify store
   */
  private async syncShopify(integration: BrandIntegration, syncId: string): Promise<void> {
    // In production, this would:
    // 1. Use Shopify Admin API to fetch products
    // 2. Process and enrich products
    // 3. Update sync status

    console.log(`[SyncBrandsScheduler] Syncing Shopify store: ${integration.shop_domain}`);

    // Placeholder - would call actual sync service
    // await shopifySync.syncProducts(integration, syncId);
  }

  /**
   * Sync WooCommerce store
   */
  private async syncWooCommerce(integration: BrandIntegration, syncId: string): Promise<void> {
    console.log(`[SyncBrandsScheduler] Syncing WooCommerce store: ${integration.shop_domain}`);

    // Placeholder - would call actual sync service
    // await wooCommerceSync.syncProducts(integration, syncId);
  }

  /**
   * Sync Wix store
   */
  private async syncWix(integration: BrandIntegration, syncId: string): Promise<void> {
    console.log(`[SyncBrandsScheduler] Syncing Wix store: ${integration.shop_domain}`);

    // Placeholder - would call actual sync service
    // await wixSync.syncProducts(integration, syncId);
  }

  /**
   * Update next sync time for an integration
   */
  private async updateNextSyncTime(integration: BrandIntegration): Promise<void> {
    try {
      const schedule = integration.sync_schedule;
      const nextSync = this.calculateNextSyncTime(schedule);

      await this.supabase
        .from('brand_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          next_sync_at: nextSync?.toISOString() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);
    } catch (error: any) {
      console.error('[SyncBrandsScheduler] updateNextSyncTime error:', error.message);
    }
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
      const next = new Date(now);
      next.setUTCHours(syncHour, 0, 0, 0);
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    }

    if (schedule.schedule_type === 'weekly') {
      const syncDay = schedule.sync_day ?? 1;
      const next = new Date(now);
      next.setUTCHours(syncHour, 0, 0, 0);

      const currentDay = next.getUTCDay();
      let daysUntilSync = syncDay - currentDay;
      if (daysUntilSync <= 0) daysUntilSync += 7;

      next.setUTCDate(next.getUTCDate() + daysUntilSync);
      return next;
    }

    return null;
  }

  /**
   * Log sync error
   */
  private async logSyncError(brandId: string, platform: string, error: string): Promise<void> {
    try {
      await this.supabase.from('sync_errors').insert({
        brand_id: brandId,
        platform,
        error_message: error,
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[SyncBrandsScheduler] Failed to log error:', err.message);
    }
  }
}

// =============================================================================
// HANDLER FUNCTIONS (for Supabase Edge Functions)
// =============================================================================

/**
 * Handler for daily sync cron job
 * Trigger: cron(0 0 * * *)
 */
export async function handleDailySync(): Promise<SchedulerResult> {
  const scheduler = new SyncBrandsScheduler();
  return scheduler.runScheduledSync('daily');
}

/**
 * Handler for weekly sync cron job
 * Trigger: cron(0 0 * * 1)
 */
export async function handleWeeklySync(): Promise<SchedulerResult> {
  const scheduler = new SyncBrandsScheduler();
  return scheduler.runScheduledSync('weekly');
}

/**
 * Supabase Edge Function entry point
 */
export async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const scheduleType = url.searchParams.get('type') as 'daily' | 'weekly';

    if (!scheduleType || !['daily', 'weekly'].includes(scheduleType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid schedule type. Use ?type=daily or ?type=weekly' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result =
      scheduleType === 'daily' ? await handleDailySync() : await handleWeeklySync();

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[syncBrandsScheduler] Handler error:', error.message);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Export for Deno (Supabase Edge Functions)
export default handler;
