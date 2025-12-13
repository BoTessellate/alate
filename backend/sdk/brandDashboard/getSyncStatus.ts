/**
 * Sync Status Retrieval
 * Get plugin sync history and status for brand dashboard
 */

import { createClient } from '@supabase/supabase-js';

export interface SyncHistoryRequest {
  brand_id: string;
  platform?: 'shopify' | 'woocommerce' | 'wix' | 'csv';
  limit?: number;
  offset?: number;
  status_filter?: 'active' | 'completed' | 'failed' | 'pending';
}

export interface SyncHistoryResponse {
  success: boolean;
  syncs: SyncRecord[];
  total_count: number;
  active_syncs: number;
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface SyncRecord {
  sync_id: string;
  platform: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_products: number;
  processed_products: number;
  enriched_products: number;
  failed_products: number;
  error_message?: string;
  sync_config: {
    shop_domain?: string;
    auto_enrich?: boolean;
    sync_frequency?: string;
  };
  duration_ms?: number;
}

export interface SyncStatistics {
  brand_id: string;
  total_syncs: number;
  active_syncs: number;
  completed_syncs: number;
  failed_syncs: number;
  total_products_synced: number;
  platforms: {
    shopify: number;
    woocommerce: number;
    wix: number;
    csv: number;
  };
  last_sync: {
    platform: string;
    completed_at: string;
    status: string;
    products_synced: number;
  } | null;
  avg_sync_duration_ms: number;
  success_rate: number;
}

/**
 * Sync Status Service
 */
export class SyncStatusService {
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
   * Get sync history for a brand
   */
  async getSyncHistory(request: SyncHistoryRequest): Promise<SyncHistoryResponse> {
    try {
      const {
        brand_id,
        platform,
        limit = 20,
        offset = 0,
        status_filter
      } = request;

      // Build query
      let query = this.supabase
        .from('plugin_syncs')
        .select('*', { count: 'exact' })
        .eq('brand_id', brand_id)
        .order('started_at', { ascending: false });

      // Apply filters
      if (platform) {
        query = query.eq('platform', platform);
      }

      if (status_filter) {
        query = query.eq('status', status_filter);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Get active syncs count
      const { count: activeCount } = await this.supabase
        .from('plugin_syncs')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand_id)
        .eq('status', 'active');

      // Map to SyncRecord format
      const syncs: SyncRecord[] = (data || []).map(sync => ({
        sync_id: sync.id,
        platform: sync.platform,
        status: sync.status,
        started_at: sync.started_at,
        completed_at: sync.completed_at,
        total_products: sync.total_products || 0,
        processed_products: sync.processed_products || 0,
        enriched_products: sync.enriched_products || 0,
        failed_products: sync.failed_products || 0,
        error_message: sync.error_message,
        sync_config: sync.sync_config || {},
        duration_ms: sync.completed_at
          ? new Date(sync.completed_at).getTime() - new Date(sync.started_at).getTime()
          : undefined
      }));

      return {
        success: true,
        syncs,
        total_count: count || 0,
        active_syncs: activeCount || 0,
        pagination: {
          limit,
          offset,
          has_more: (count || 0) > offset + limit
        }
      };
    } catch (error) {
      console.error('Get sync history error:', error);
      return {
        success: false,
        syncs: [],
        total_count: 0,
        active_syncs: 0,
        pagination: {
          limit: request.limit || 20,
          offset: request.offset || 0,
          has_more: false
        }
      };
    }
  }

  /**
   * Get sync statistics for a brand
   */
  async getSyncStatistics(brandId: string): Promise<SyncStatistics> {
    try {
      // Get all syncs
      const { data: allSyncs, error } = await this.supabase
        .from('plugin_syncs')
        .select('*')
        .eq('brand_id', brandId);

      if (error || !allSyncs) {
        throw error;
      }

      // Calculate statistics
      const stats: SyncStatistics = {
        brand_id: brandId,
        total_syncs: allSyncs.length,
        active_syncs: allSyncs.filter(s => s.status === 'active').length,
        completed_syncs: allSyncs.filter(s => s.status === 'completed').length,
        failed_syncs: allSyncs.filter(s => s.status === 'failed').length,
        total_products_synced: allSyncs.reduce((sum, s) => sum + (s.processed_products || 0), 0),
        platforms: {
          shopify: allSyncs.filter(s => s.platform === 'shopify').length,
          woocommerce: allSyncs.filter(s => s.platform === 'woocommerce').length,
          wix: allSyncs.filter(s => s.platform === 'wix').length,
          csv: allSyncs.filter(s => s.platform === 'csv').length
        },
        last_sync: null,
        avg_sync_duration_ms: 0,
        success_rate: 0
      };

      // Get last sync
      const completedSyncs = allSyncs
        .filter(s => s.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());

      if (completedSyncs.length > 0) {
        const lastSync = completedSyncs[0];
        stats.last_sync = {
          platform: lastSync.platform,
          completed_at: lastSync.completed_at!,
          status: lastSync.status,
          products_synced: lastSync.processed_products || 0
        };
      }

      // Calculate average duration
      const completedWithDuration = completedSyncs.filter(s => s.started_at && s.completed_at);
      if (completedWithDuration.length > 0) {
        const totalDuration = completedWithDuration.reduce((sum, s) => {
          const duration = new Date(s.completed_at!).getTime() - new Date(s.started_at).getTime();
          return sum + duration;
        }, 0);
        stats.avg_sync_duration_ms = Math.round(totalDuration / completedWithDuration.length);
      }

      // Calculate success rate
      const finishedSyncs = stats.completed_syncs + stats.failed_syncs;
      if (finishedSyncs > 0) {
        stats.success_rate = Math.round((stats.completed_syncs / finishedSyncs) * 100);
      }

      return stats;
    } catch (error) {
      console.error('Get sync statistics error:', error);
      return {
        brand_id: brandId,
        total_syncs: 0,
        active_syncs: 0,
        completed_syncs: 0,
        failed_syncs: 0,
        total_products_synced: 0,
        platforms: { shopify: 0, woocommerce: 0, wix: 0, csv: 0 },
        last_sync: null,
        avg_sync_duration_ms: 0,
        success_rate: 0
      };
    }
  }

  /**
   * Get sync details by ID
   */
  async getSyncDetails(syncId: string): Promise<SyncRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('plugin_syncs')
        .select('*')
        .eq('id', syncId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        sync_id: data.id,
        platform: data.platform,
        status: data.status,
        started_at: data.started_at,
        completed_at: data.completed_at,
        total_products: data.total_products || 0,
        processed_products: data.processed_products || 0,
        enriched_products: data.enriched_products || 0,
        failed_products: data.failed_products || 0,
        error_message: data.error_message,
        sync_config: data.sync_config || {},
        duration_ms: data.completed_at
          ? new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()
          : undefined
      };
    } catch (error) {
      console.error('Get sync details error:', error);
      return null;
    }
  }

  /**
   * Get active syncs for a brand
   */
  async getActiveSyncs(brandId: string): Promise<SyncRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('plugin_syncs')
        .select('*')
        .eq('brand_id', brandId)
        .eq('status', 'active')
        .order('started_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map(sync => ({
        sync_id: sync.id,
        platform: sync.platform,
        status: sync.status,
        started_at: sync.started_at,
        completed_at: sync.completed_at,
        total_products: sync.total_products || 0,
        processed_products: sync.processed_products || 0,
        enriched_products: sync.enriched_products || 0,
        failed_products: sync.failed_products || 0,
        error_message: sync.error_message,
        sync_config: sync.sync_config || {}
      }));
    } catch (error) {
      console.error('Get active syncs error:', error);
      return [];
    }
  }

  /**
   * Cancel an active sync
   */
  async cancelSync(syncId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('plugin_syncs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: 'Cancelled by user'
        })
        .eq('id', syncId)
        .eq('status', 'active');

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Cancel sync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get sync errors for troubleshooting
   */
  async getSyncErrors(syncId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('sync_errors')
        .select('*')
        .eq('sync_id', syncId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get sync errors error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get sync errors error:', error);
      return [];
    }
  }

  /**
   * Retry a failed sync
   */
  async retrySync(syncId: string): Promise<{ success: boolean; new_sync_id?: string; error?: string }> {
    try {
      // Get original sync config
      const { data: originalSync, error: fetchError } = await this.supabase
        .from('plugin_syncs')
        .select('*')
        .eq('id', syncId)
        .single();

      if (fetchError || !originalSync) {
        return {
          success: false,
          error: 'Sync not found'
        };
      }

      // Create new sync with same config
      const { data: newSync, error: createError } = await this.supabase
        .from('plugin_syncs')
        .insert({
          brand_id: originalSync.brand_id,
          platform: originalSync.platform,
          status: 'pending',
          sync_config: originalSync.sync_config,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError || !newSync) {
        return {
          success: false,
          error: 'Failed to create retry sync'
        };
      }

      return {
        success: true,
        new_sync_id: newSync.id
      };
    } catch (error) {
      console.error('Retry sync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Create sync status service instance
 */
export function createSyncStatusService(): SyncStatusService {
  return new SyncStatusService();
}
