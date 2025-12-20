/**
 * Health Check Scheduler
 *
 * Scheduled function that runs every 12 hours to check the health
 * of all brand integrations.
 *
 * Cron: 0 */12 * * * (every 12 hours at minute 0)
 *
 * Checks:
 * - Shopify token ping
 * - WooCommerce auth check
 * - Wix token validation
 * - Recent webhook activity
 *
 * Updates brand_integrations with:
 * - status: ok | warning | disconnected
 * - status_notes: Human-readable description
 * - last_success / last_failure timestamps
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

type HealthStatus = 'ok' | 'warning' | 'disconnected';

interface HealthCheckResult {
  integration_id: string;
  brand_id: string;
  platform: string;
  status: HealthStatus;
  status_notes: string;
  last_success?: string;
  last_failure?: string;
}

interface SchedulerResult {
  run_at: string;
  total_checked: number;
  ok_count: number;
  warning_count: number;
  disconnected_count: number;
  errors: string[];
}

interface Integration {
  id: string;
  brand_id: string;
  platform: string;
  shop_domain?: string;
  access_token?: string;
  is_connected: boolean;
  last_sync_at?: string;
}

// =============================================================================
// HEALTH CHECK SCHEDULER
// =============================================================================

/**
 * Health Check Scheduler
 * Runs on cron: 0 */12 * * *
 */
export class HealthCheckScheduler {
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
   * Run the scheduled health check
   */
  async run(): Promise<SchedulerResult> {
    const runAt = new Date().toISOString();
    const errors: string[] = [];
    const results: HealthCheckResult[] = [];

    console.log(`[HealthCheckScheduler] Starting health check run at ${runAt}`);

    try {
      // Get all connected integrations
      const { data: integrations, error } = await this.supabase
        .from('brand_integrations')
        .select('id, brand_id, platform, shop_domain, access_token, is_connected, last_sync_at')
        .eq('is_connected', true);

      if (error) {
        console.error('[HealthCheckScheduler] Query error:', error);
        errors.push(`Database query failed: ${error.message}`);
        return this.createResult(runAt, 0, 0, 0, 0, errors);
      }

      const integrationList = integrations || [];
      console.log(`[HealthCheckScheduler] Found ${integrationList.length} connected integrations`);

      // Check each integration
      for (const integration of integrationList) {
        try {
          const result = await this.checkIntegration(integration);
          results.push(result);

          // Update database
          await this.updateIntegrationStatus(result);
        } catch (err: any) {
          console.error(`[HealthCheckScheduler] Error checking ${integration.id}:`, err.message);
          errors.push(`Integration ${integration.id}: ${err.message}`);
        }
      }

      // Calculate counts
      const okCount = results.filter((r) => r.status === 'ok').length;
      const warningCount = results.filter((r) => r.status === 'warning').length;
      const disconnectedCount = results.filter((r) => r.status === 'disconnected').length;

      console.log(
        `[HealthCheckScheduler] Complete: ${okCount} ok, ${warningCount} warning, ${disconnectedCount} disconnected`
      );

      // Log health check run
      await this.logHealthCheckRun(runAt, results.length, okCount, warningCount, disconnectedCount);

      return this.createResult(runAt, results.length, okCount, warningCount, disconnectedCount, errors);
    } catch (err: any) {
      console.error('[HealthCheckScheduler] Fatal error:', err.message);
      errors.push(`Fatal error: ${err.message}`);
      return this.createResult(runAt, 0, 0, 0, 0, errors);
    }
  }

  /**
   * Check health of a single integration
   */
  private async checkIntegration(integration: Integration): Promise<HealthCheckResult> {
    const { id, brand_id, platform, shop_domain, access_token, last_sync_at } = integration;
    const checkedAt = new Date().toISOString();

    // Platform-specific health check
    let isHealthy = false;
    let statusNotes = '';

    switch (platform) {
      case 'shopify':
        const shopifyResult = await this.checkShopify(shop_domain, access_token);
        isHealthy = shopifyResult.healthy;
        statusNotes = shopifyResult.notes;
        break;

      case 'woocommerce':
        const wooResult = await this.checkWooCommerce(shop_domain, access_token);
        isHealthy = wooResult.healthy;
        statusNotes = wooResult.notes;
        break;

      case 'wix':
        const wixResult = await this.checkWix(shop_domain, access_token);
        isHealthy = wixResult.healthy;
        statusNotes = wixResult.notes;
        break;

      default:
        statusNotes = `Unknown platform: ${platform}`;
    }

    // Check for recent activity (warning if no sync in 7 days)
    const hasRecentActivity = this.hasRecentActivity(last_sync_at, 7);

    // Determine final status
    let status: HealthStatus;
    if (!isHealthy) {
      status = 'disconnected';
    } else if (!hasRecentActivity) {
      status = 'warning';
      statusNotes = statusNotes || 'No sync activity in the last 7 days';
    } else {
      status = 'ok';
      statusNotes = statusNotes || 'Connection healthy';
    }

    return {
      integration_id: id,
      brand_id,
      platform,
      status,
      status_notes: statusNotes,
      last_success: status === 'ok' ? checkedAt : undefined,
      last_failure: status === 'disconnected' ? checkedAt : undefined,
    };
  }

  /**
   * Check Shopify store health
   */
  private async checkShopify(
    shopDomain?: string,
    accessToken?: string
  ): Promise<{ healthy: boolean; notes: string }> {
    if (!shopDomain || !accessToken) {
      return { healthy: false, notes: 'Missing shop domain or access token' };
    }

    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { healthy: true, notes: 'Shopify connection verified' };
      } else if (response.status === 401) {
        return { healthy: false, notes: 'Shopify access token expired or invalid' };
      } else {
        return { healthy: false, notes: `Shopify API error: ${response.status}` };
      }
    } catch (err: any) {
      return { healthy: false, notes: `Shopify ping failed: ${err.message}` };
    }
  }

  /**
   * Check WooCommerce store health
   */
  private async checkWooCommerce(
    shopDomain?: string,
    accessToken?: string
  ): Promise<{ healthy: boolean; notes: string }> {
    if (!shopDomain || !accessToken) {
      return { healthy: false, notes: 'Missing shop domain or credentials' };
    }

    try {
      const response = await fetch(`https://${shopDomain}/wp-json/wc/v3/system_status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { healthy: true, notes: 'WooCommerce connection verified' };
      } else if (response.status === 401) {
        return { healthy: false, notes: 'WooCommerce credentials expired or invalid' };
      } else {
        return { healthy: false, notes: `WooCommerce API error: ${response.status}` };
      }
    } catch (err: any) {
      return { healthy: false, notes: `WooCommerce ping failed: ${err.message}` };
    }
  }

  /**
   * Check Wix store health
   */
  private async checkWix(
    shopDomain?: string,
    accessToken?: string
  ): Promise<{ healthy: boolean; notes: string }> {
    if (!shopDomain || !accessToken) {
      return { healthy: false, notes: 'Missing shop domain or access token' };
    }

    try {
      const response = await fetch('https://www.wixapis.com/stores/v1/products/query', {
        method: 'POST',
        headers: {
          Authorization: accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: { paging: { limit: 1 } } }),
      });

      if (response.ok) {
        return { healthy: true, notes: 'Wix connection verified' };
      } else if (response.status === 401) {
        return { healthy: false, notes: 'Wix access token expired or invalid' };
      } else {
        return { healthy: false, notes: `Wix API error: ${response.status}` };
      }
    } catch (err: any) {
      return { healthy: false, notes: `Wix ping failed: ${err.message}` };
    }
  }

  /**
   * Check if there's recent activity within threshold
   */
  private hasRecentActivity(lastSyncAt?: string, daysThreshold: number = 7): boolean {
    if (!lastSyncAt) return false;

    const lastSync = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays <= daysThreshold;
  }

  /**
   * Update integration status in database
   */
  private async updateIntegrationStatus(result: HealthCheckResult): Promise<void> {
    const updateData: Record<string, any> = {
      status: result.status,
      status_notes: result.status_notes,
      updated_at: new Date().toISOString(),
    };

    if (result.last_success) {
      updateData.last_success = result.last_success;
    }
    if (result.last_failure) {
      updateData.last_failure = result.last_failure;
    }

    // Mark as disconnected if health check failed
    if (result.status === 'disconnected') {
      updateData.is_connected = false;
    }

    await this.supabase
      .from('brand_integrations')
      .update(updateData)
      .eq('id', result.integration_id);
  }

  /**
   * Log health check run to database
   */
  private async logHealthCheckRun(
    runAt: string,
    totalChecked: number,
    okCount: number,
    warningCount: number,
    disconnectedCount: number
  ): Promise<void> {
    try {
      await this.supabase.from('sync_logs').insert({
        type: 'health_check',
        status: 'completed',
        message: `Health check complete: ${okCount} ok, ${warningCount} warning, ${disconnectedCount} disconnected`,
        details: {
          run_at: runAt,
          total_checked: totalChecked,
          ok_count: okCount,
          warning_count: warningCount,
          disconnected_count: disconnectedCount,
        },
        created_at: runAt,
      });
    } catch (err: any) {
      console.error('[HealthCheckScheduler] Failed to log run:', err.message);
    }
  }

  /**
   * Create result object
   */
  private createResult(
    runAt: string,
    totalChecked: number,
    okCount: number,
    warningCount: number,
    disconnectedCount: number,
    errors: string[]
  ): SchedulerResult {
    return {
      run_at: runAt,
      total_checked: totalChecked,
      ok_count: okCount,
      warning_count: warningCount,
      disconnected_count: disconnectedCount,
      errors,
    };
  }
}

// =============================================================================
// ENTRY POINT
// =============================================================================

/**
 * Main entry point for cron job
 * Cron expression: 0 */12 * * * (every 12 hours)
 */
export async function runHealthCheckScheduler(): Promise<SchedulerResult> {
  const scheduler = new HealthCheckScheduler();
  return scheduler.run();
}

// Export for Edge Function usage
export default runHealthCheckScheduler;
