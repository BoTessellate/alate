/**
 * Health Check & Status Monitoring
 *
 * Monitors the health of brand integrations:
 * - Shopify token ping
 * - WooCommerce auth check
 * - Recent webhook activity
 *
 * Cron: Every 12 hours - cron(0 star-slash-12 star star star)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Integration health status
 */
export type HealthStatus = 'ok' | 'warning' | 'disconnected';

/**
 * Health check result for a single integration
 */
export interface HealthCheckResult {
  brand_id: string;
  platform: string;
  status: HealthStatus;
  status_notes: string;
  last_success?: string;
  last_failure?: string;
  checked_at: string;
}

/**
 * Integration record with health fields
 */
export interface IntegrationHealth {
  id: string;
  brand_id: string;
  platform: string;
  shop_domain?: string;
  access_token?: string;
  is_connected: boolean;
  status: HealthStatus;
  status_notes?: string;
  last_success?: string;
  last_failure?: string;
  last_sync_at?: string;
}

/**
 * Health check summary
 */
export interface HealthCheckSummary {
  run_at: string;
  total_checked: number;
  ok_count: number;
  warning_count: number;
  disconnected_count: number;
  results: HealthCheckResult[];
}

/**
 * Request to get health status
 */
export interface GetHealthStatusRequest {
  brand_id: string;
  platform?: 'shopify' | 'woocommerce' | 'wix';
}

/**
 * Response with health status
 */
export interface GetHealthStatusResponse {
  success: boolean;
  integrations: IntegrationHealth[];
  error?: string;
}

// =============================================================================
// HEALTH CHECK SERVICE
// =============================================================================

/**
 * Health Check Service
 * Monitors and updates integration health status
 */
export class HealthCheckService {
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
   * Run health check for all integrations
   */
  async runHealthCheck(): Promise<HealthCheckSummary> {
    const results: HealthCheckResult[] = [];
    const checkedAt = new Date().toISOString();

    try {
      // Get all connected integrations
      const { data: integrations, error } = await this.supabase
        .from('brand_integrations')
        .select('*')
        .eq('is_connected', true);

      if (error) {
        console.error('[HealthCheckService] Query error:', error);
        return {
          run_at: checkedAt,
          total_checked: 0,
          ok_count: 0,
          warning_count: 0,
          disconnected_count: 0,
          results: [],
        };
      }

      // Check each integration
      for (const integration of integrations || []) {
        const result = await this.checkIntegration(integration);
        results.push(result);

        // Update status in database
        await this.updateIntegrationStatus(integration.id, result);
      }

      // Calculate summary
      const okCount = results.filter((r) => r.status === 'ok').length;
      const warningCount = results.filter((r) => r.status === 'warning').length;
      const disconnectedCount = results.filter((r) => r.status === 'disconnected').length;

      console.log(
        `[HealthCheckService] Check complete: ${okCount} ok, ${warningCount} warning, ${disconnectedCount} disconnected`
      );

      return {
        run_at: checkedAt,
        total_checked: results.length,
        ok_count: okCount,
        warning_count: warningCount,
        disconnected_count: disconnectedCount,
        results,
      };
    } catch (error: any) {
      console.error('[HealthCheckService] runHealthCheck error:', error.message);
      return {
        run_at: checkedAt,
        total_checked: 0,
        ok_count: 0,
        warning_count: 0,
        disconnected_count: 0,
        results: [],
      };
    }
  }

  /**
   * Check health of a single integration
   */
  private async checkIntegration(integration: any): Promise<HealthCheckResult> {
    const { brand_id, platform, shop_domain, access_token, last_sync_at } = integration;
    const checkedAt = new Date().toISOString();

    try {
      // Platform-specific health check
      let isHealthy = false;
      let statusNotes = '';

      switch (platform) {
        case 'shopify':
          const shopifyResult = await this.checkShopifyHealth(shop_domain, access_token);
          isHealthy = shopifyResult.healthy;
          statusNotes = shopifyResult.notes;
          break;

        case 'woocommerce':
          const wooResult = await this.checkWooCommerceHealth(shop_domain, access_token);
          isHealthy = wooResult.healthy;
          statusNotes = wooResult.notes;
          break;

        case 'wix':
          const wixResult = await this.checkWixHealth(shop_domain, access_token);
          isHealthy = wixResult.healthy;
          statusNotes = wixResult.notes;
          break;

        default:
          statusNotes = `Unknown platform: ${platform}`;
      }

      // Check for recent webhook activity (warning if no sync in 7 days)
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
        brand_id,
        platform,
        status,
        status_notes: statusNotes,
        last_success: status === 'ok' ? checkedAt : undefined,
        last_failure: status === 'disconnected' ? checkedAt : undefined,
        checked_at: checkedAt,
      };
    } catch (error: any) {
      return {
        brand_id,
        platform,
        status: 'disconnected',
        status_notes: `Health check failed: ${error.message}`,
        last_failure: checkedAt,
        checked_at: checkedAt,
      };
    }
  }

  /**
   * Check Shopify store health
   */
  private async checkShopifyHealth(
    shopDomain?: string,
    accessToken?: string
  ): Promise<{ healthy: boolean; notes: string }> {
    if (!shopDomain || !accessToken) {
      return { healthy: false, notes: 'Missing shop domain or access token' };
    }

    try {
      // Ping Shopify API to verify token
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
    } catch (error: any) {
      return { healthy: false, notes: `Shopify ping failed: ${error.message}` };
    }
  }

  /**
   * Check WooCommerce store health
   */
  private async checkWooCommerceHealth(
    shopDomain?: string,
    accessToken?: string
  ): Promise<{ healthy: boolean; notes: string }> {
    if (!shopDomain || !accessToken) {
      return { healthy: false, notes: 'Missing shop domain or credentials' };
    }

    try {
      // Ping WooCommerce REST API
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
    } catch (error: any) {
      return { healthy: false, notes: `WooCommerce ping failed: ${error.message}` };
    }
  }

  /**
   * Check Wix store health
   */
  private async checkWixHealth(
    shopDomain?: string,
    accessToken?: string
  ): Promise<{ healthy: boolean; notes: string }> {
    if (!shopDomain || !accessToken) {
      return { healthy: false, notes: 'Missing shop domain or access token' };
    }

    try {
      // Ping Wix API
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
    } catch (error: any) {
      return { healthy: false, notes: `Wix ping failed: ${error.message}` };
    }
  }

  /**
   * Check if there's recent activity within the specified days
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
  private async updateIntegrationStatus(
    integrationId: string,
    result: HealthCheckResult
  ): Promise<void> {
    try {
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
        .eq('id', integrationId);
    } catch (error: any) {
      console.error('[HealthCheckService] updateIntegrationStatus error:', error.message);
    }
  }

  /**
   * Get health status for a brand's integrations
   */
  async getHealthStatus(request: GetHealthStatusRequest): Promise<GetHealthStatusResponse> {
    try {
      const { brand_id, platform } = request;

      let query = this.supabase
        .from('brand_integrations')
        .select('id, brand_id, platform, shop_domain, is_connected, status, status_notes, last_success, last_failure, last_sync_at')
        .eq('brand_id', brand_id);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[HealthCheckService] getHealthStatus error:', error);
        return { success: false, integrations: [], error: 'Failed to get health status' };
      }

      const integrations: IntegrationHealth[] = (data || []).map((item) => ({
        id: item.id,
        brand_id: item.brand_id,
        platform: item.platform,
        shop_domain: item.shop_domain,
        is_connected: item.is_connected,
        status: item.status || 'disconnected',
        status_notes: item.status_notes,
        last_success: item.last_success,
        last_failure: item.last_failure,
        last_sync_at: item.last_sync_at,
      }));

      return { success: true, integrations };
    } catch (error: any) {
      console.error('[HealthCheckService] getHealthStatus error:', error.message);
      return { success: false, integrations: [], error: error.message };
    }
  }

  /**
   * Mark integration as reconnected (after user re-authenticates)
   */
  async markReconnected(brandId: string, platform: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('brand_integrations')
        .update({
          is_connected: true,
          status: 'ok',
          status_notes: 'Reconnected by user',
          last_success: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('brand_id', brandId)
        .eq('platform', platform);

      return !error;
    } catch (error) {
      return false;
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create health check service instance
 */
export function createHealthCheckService(): HealthCheckService {
  return new HealthCheckService();
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Run health check for all integrations
 */
export async function runHealthCheck(): Promise<HealthCheckSummary> {
  const service = createHealthCheckService();
  return service.runHealthCheck();
}

/**
 * Get health status for a brand
 */
export async function getHealthStatus(
  request: GetHealthStatusRequest
): Promise<GetHealthStatusResponse> {
  const service = createHealthCheckService();
  return service.getHealthStatus(request);
}

/**
 * Mark integration as reconnected
 */
export async function markReconnected(brandId: string, platform: string): Promise<boolean> {
  const service = createHealthCheckService();
  return service.markReconnected(brandId, platform);
}
