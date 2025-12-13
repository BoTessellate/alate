/**
 * CSV Sync Module
 * Processes CSV uploads for product import
 */

import { parse } from 'csv-parse/sync';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductEnricher } from '../productEnrichment/enrichProduct';
import { CSVProductRow, NormalizedProductInput, SyncResponse } from './types';

/**
 * CSV Sync Handler
 */
export class CSVSyncHandler {
  private supabase: SupabaseClient;
  private enricher: ProductEnricher;

  constructor(supabaseUrl: string, supabaseKey: string, anthropicApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.enricher = new ProductEnricher({
      anthropicApiKey,
      supabaseUrl,
      supabaseKey
    });
  }

  /**
   * Parse and sync products from CSV content
   */
  async syncFromCSV(csvContent: string, brand: string): Promise<SyncResponse> {
    const syncId = this.generateSyncId();
    const startTime = new Date().toISOString();

    try {
      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as CSVProductRow[];

      // Validate required columns
      if (records.length === 0) {
        throw new Error('CSV file is empty');
      }

      this.validateCSVHeaders(records[0]);

      // Create sync log
      await this.createSyncLog({
        sync_id: syncId,
        source: 'csv',
        brand,
        started_at: startTime,
        status: 'in_progress',
        total_products: records.length,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0
      });

      // Process products
      let syncedCount = 0;
      let enrichedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const row of records) {
        try {
          // Normalize CSV row
          const normalized = this.normalizeCSVRow(row, brand);

          // Enrich and save
          await this.enricher.enrichAndSave(normalized);

          syncedCount++;
          enrichedCount++;

        } catch (error) {
          failedCount++;
          const errorMessage = `Failed to process ${row.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      // Update sync log
      await this.updateSyncLog(syncId, {
        completed_at: new Date().toISOString(),
        status: 'completed',
        synced_count: syncedCount,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined
      });

      return {
        success: true,
        sync_id: syncId,
        total_products: records.length,
        synced_count: syncedCount,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Mark sync as failed
      await this.updateSyncLog(syncId, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'CSV sync failed']
      });

      return {
        success: false,
        sync_id: syncId,
        total_products: 0,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0,
        errors: [error instanceof Error ? error.message : 'CSV sync failed'],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate CSV headers
   */
  private validateCSVHeaders(firstRow: CSVProductRow): void {
    const requiredFields = ['name', 'brand', 'category', 'price'];

    for (const field of requiredFields) {
      if (!(field in firstRow)) {
        throw new Error(`Missing required CSV column: ${field}`);
      }
    }
  }

  /**
   * Normalize CSV row to internal format
   */
  private normalizeCSVRow(row: CSVProductRow, brandOverride?: string): any {
    return {
      product_name: row.name,
      brand: brandOverride || row.brand,
      category: this.normalizeCategory(row.category),
      price: typeof row.price === 'string' ? parseFloat(row.price) : row.price,
      region: row.region || 'India',
      dimensions: undefined
    };
  }

  /**
   * Normalize category name
   */
  private normalizeCategory(category: string): string {
    return category.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Sync from normalized products array
   */
  async syncFromProducts(products: NormalizedProductInput[], brand: string): Promise<SyncResponse> {
    const syncId = this.generateSyncId();
    const startTime = new Date().toISOString();

    try {
      // Create sync log
      await this.createSyncLog({
        sync_id: syncId,
        source: 'manual',
        brand,
        started_at: startTime,
        status: 'in_progress',
        total_products: products.length,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0
      });

      // Process products
      let syncedCount = 0;
      let enrichedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const product of products) {
        try {
          // Convert to enrichment format
          const productInput = {
            product_name: product.name,
            brand: product.brand,
            category: product.category,
            price: product.price,
            region: product.region || 'India',
            dimensions: undefined
          };

          // Enrich and save
          await this.enricher.enrichAndSave(productInput);

          syncedCount++;
          enrichedCount++;

        } catch (error) {
          failedCount++;
          const errorMessage = `Failed to process ${product.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      // Update sync log
      await this.updateSyncLog(syncId, {
        completed_at: new Date().toISOString(),
        status: 'completed',
        synced_count: syncedCount,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined
      });

      return {
        success: true,
        sync_id: syncId,
        total_products: products.length,
        synced_count: syncedCount,
        enriched_count: enrichedCount,
        failed_count: failedCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      await this.updateSyncLog(syncId, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Sync failed']
      });

      return {
        success: false,
        sync_id: syncId,
        total_products: products.length,
        synced_count: 0,
        enriched_count: 0,
        failed_count: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed'],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `csv_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create sync log
   */
  private async createSyncLog(log: any): Promise<void> {
    try {
      await this.supabase
        .from('plugin_sync_logs')
        .insert(log);
    } catch (error) {
      console.error('Failed to create sync log:', error);
    }
  }

  /**
   * Update sync log
   */
  private async updateSyncLog(syncId: string, updates: any): Promise<void> {
    try {
      await this.supabase
        .from('plugin_sync_logs')
        .update(updates)
        .eq('sync_id', syncId);
    } catch (error) {
      console.error('Failed to update sync log:', error);
    }
  }
}

/**
 * Create CSV sync handler instance
 */
export function createCSVSyncHandler(
  supabaseUrl: string,
  supabaseKey: string,
  anthropicApiKey: string
): CSVSyncHandler {
  return new CSVSyncHandler(supabaseUrl, supabaseKey, anthropicApiKey);
}
