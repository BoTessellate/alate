/**
 * CSV Upload Handler
 * Processes CSV file uploads from brand dashboard
 */

import { parse } from 'csv-parse/sync';
import { ProductEnricher } from '../productEnrichment/enrichProduct';
import { createClient } from '@supabase/supabase-js';
import { validateBrandName } from '../shared/brandValidation';

// CSV row type for parsed records
interface CSVRow {
  product_name?: string;
  brand?: string;
  category?: string;
  price?: string;
  tags?: string;
  color_palette?: string;
  region?: string;
  material?: string;
  texture?: string;
  tone?: string;
  sku?: string;
  [key: string]: string | undefined;
}

export interface CSVUploadRequest {
  csv_content: string; // CSV file content as string
  brand_id: string;
  brand_name: string;
  auto_enrich?: boolean; // Auto-enrich products after upload
  skip_duplicates?: boolean; // Skip products that already exist
}

export interface CSVUploadResponse {
  success: boolean;
  total_rows: number;
  processed: number;
  enriched: number;
  skipped: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  uploaded_products: string[]; // Product IDs
  duration_ms: number;
}

export interface CSVValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  row_count: number;
  columns: string[];
}

/**
 * CSV Upload Handler
 */
export class CSVUploadHandler {
  private supabase;
  private enricher: ProductEnricher;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    if (!anthropicKey) {
      throw new Error('Anthropic API key not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.enricher = new ProductEnricher(anthropicKey);
  }

  /**
   * Validate CSV format and content
   */
  async validateCSV(csvContent: string): Promise<CSVValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      }) as CSVRow[];

      if (records.length === 0) {
        errors.push('CSV file is empty');
        return {
          valid: false,
          errors,
          warnings,
          row_count: 0,
          columns: []
        };
      }

      // Get columns
      const columns = Object.keys(records[0] as object);

      // Check required columns
      const requiredColumns = ['product_name', 'category'];
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));

      if (missingColumns.length > 0) {
        errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Check recommended columns
      const recommendedColumns = ['brand', 'price', 'tags', 'color_palette'];
      const missingRecommended = recommendedColumns.filter(col => !columns.includes(col));

      if (missingRecommended.length > 0) {
        warnings.push(`Missing recommended columns: ${missingRecommended.join(', ')}`);
      }

      // Validate data types
      records.forEach((row, index) => {
        if (!row.product_name || row.product_name.trim() === '') {
          errors.push(`Row ${index + 2}: product_name is required`);
        }

        if (!row.category || row.category.trim() === '') {
          errors.push(`Row ${index + 2}: category is required`);
        }

        if (row.price && isNaN(Number(row.price))) {
          warnings.push(`Row ${index + 2}: price is not a valid number`);
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        row_count: records.length,
        columns
      };
    } catch (error) {
      errors.push(`CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        warnings,
        row_count: 0,
        columns: []
      };
    }
  }

  /**
   * Upload and process CSV file
   */
  async uploadCSV(request: CSVUploadRequest): Promise<CSVUploadResponse> {
    const startTime = Date.now();
    const {
      csv_content,
      brand_id,
      brand_name,
      auto_enrich = true,
      skip_duplicates = true
    } = request;

    const response: CSVUploadResponse = {
      success: false,
      total_rows: 0,
      processed: 0,
      enriched: 0,
      skipped: 0,
      errors: [],
      uploaded_products: [],
      duration_ms: 0
    };

    try {
      // Validate CSV first
      const validation = await this.validateCSV(csv_content);
      if (!validation.valid) {
        response.errors.push({
          row: 0,
          error: validation.errors.join('; ')
        });
        response.duration_ms = Date.now() - startTime;
        return response;
      }

      // Parse CSV
      const records = parse(csv_content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      }) as CSVRow[];

      response.total_rows = records.length;

      // Process each row
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNumber = i + 2; // Account for header row

        try {
          // Normalize product data
          const product = this.normalizeCSVRow(row, brand_name);

          // Check for duplicates
          if (skip_duplicates) {
            const exists = await this.checkProductExists(product.product_name, brand_name);
            if (exists) {
              response.skipped++;
              continue;
            }
          }

          // Enrich or save directly
          if (auto_enrich) {
            const enriched = await this.enricher.enrichAndSave(product);
            if (enriched.success && enriched.product_id) {
              response.uploaded_products.push(enriched.product_id);
              response.enriched++;
              response.processed++;
            } else {
              response.errors.push({
                row: rowNumber,
                error: enriched.error || 'Enrichment failed'
              });
            }
          } else {
            const saved = await this.saveProductDirectly(product, brand_id);
            if (saved) {
              response.uploaded_products.push(saved);
              response.processed++;
            } else {
              response.errors.push({
                row: rowNumber,
                error: 'Failed to save product'
              });
            }
          }
        } catch (error) {
          response.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Log upload activity
      await this.logUploadActivity(brand_id, response);

      response.success = response.processed > 0;
      response.duration_ms = Date.now() - startTime;

      return response;
    } catch (error) {
      console.error('CSV upload error:', error);
      response.errors.push({
        row: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      response.duration_ms = Date.now() - startTime;
      return response;
    }
  }

  /**
   * Normalize CSV row to product format
   */
  private normalizeCSVRow(row: any, defaultBrand: string): any {
    // Validate brand name to prevent fake/invented brands
    const rawBrand = row.brand?.trim() || defaultBrand;
    const validatedBrand = validateBrandName(rawBrand);

    return {
      product_name: row.product_name?.trim(),
      brand: validatedBrand,
      category: row.category?.trim()?.toLowerCase(),
      price: row.price ? parseFloat(row.price) : undefined,
      tags: row.tags ? row.tags.split(',').map((t: string) => t.trim().toLowerCase()) : [],
      color_palette: row.color_palette ? row.color_palette.split(',').map((c: string) => c.trim()) : [],
      region: row.region?.trim(),
      material: row.material?.trim()?.toLowerCase(),
      texture: row.texture?.trim()?.toLowerCase(),
      tone: row.tone?.trim()?.toLowerCase(),
      sku: row.sku?.trim()
    };
  }

  /**
   * Check if product already exists
   */
  private async checkProductExists(productName: string, brand: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('enriched_products')
        .select('id')
        .eq('product_name', productName)
        .eq('brand', brand)
        .single();

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save product directly without enrichment
   */
  private async saveProductDirectly(product: any, brandId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('enriched_products')
        .insert({
          product_name: product.product_name,
          brand: product.brand,
          category: product.category,
          price: product.price,
          tags: product.tags,
          color_palette: product.color_palette,
          region: product.region,
          material: product.material,
          texture: product.texture,
          tone: product.tone,
          sku: product.sku,
          enrichment_status: 'pending',
          user_id: brandId,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error || !data) {
        console.error('Save error:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Save error:', error);
      return null;
    }
  }

  /**
   * Log upload activity
   */
  private async logUploadActivity(brandId: string, response: CSVUploadResponse): Promise<void> {
    try {
      await this.supabase
        .from('upload_logs')
        .insert({
          brand_id: brandId,
          upload_type: 'csv',
          total_rows: response.total_rows,
          processed: response.processed,
          enriched: response.enriched,
          skipped: response.skipped,
          error_count: response.errors.length,
          duration_ms: response.duration_ms,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to log upload activity:', error);
      // Don't throw - logging is optional
    }
  }

  /**
   * Get upload history for a brand
   */
  async getUploadHistory(brandId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('upload_logs')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Get upload history error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get upload history error:', error);
      return [];
    }
  }

  /**
   * Generate CSV template
   */
  generateTemplate(): string {
    const headers = [
      'product_name',
      'brand',
      'category',
      'price',
      'tags',
      'color_palette',
      'region',
      'material',
      'texture',
      'tone',
      'sku'
    ];

    const example = [
      'Handwoven Cushion',
      'Amala Earth',
      'home-decor',
      '1299',
      'handmade,boho,cushion',
      '#8B4513,#F5DEB3,#4682B4',
      'India',
      'cotton',
      'woven',
      'warm',
      'AE-CUSH-001'
    ];

    return `${headers.join(',')}\n${example.join(',')}`;
  }
}

/**
 * Create CSV upload handler instance
 */
export function createCSVUploadHandler(): CSVUploadHandler {
  return new CSVUploadHandler();
}
