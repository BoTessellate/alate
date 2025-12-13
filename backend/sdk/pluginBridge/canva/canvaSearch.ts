/**
 * Canva Search Integration
 * Allows Canva plugin to search Mood Layer products
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CanvaSearchRequest, CanvaSearchResponse, CanvaProduct } from '../types';

/**
 * Canva Search Handler
 */
export class CanvaSearchHandler {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Search products for Canva plugin
   */
  async searchProducts(searchRequest: CanvaSearchRequest): Promise<CanvaSearchResponse> {
    try {
      const { query, tags, category, region, limit = 20 } = searchRequest;

      // Build query
      let dbQuery = this.supabase
        .from('enriched_products')
        .select('*');

      // Apply filters
      if (category) {
        dbQuery = dbQuery.eq('category', category);
      }

      if (region) {
        dbQuery = dbQuery.eq('region', region);
      }

      if (tags && tags.length > 0) {
        dbQuery = dbQuery.overlaps('tags', tags);
      }

      if (query) {
        // Search in product_name and brand
        dbQuery = dbQuery.or(`product_name.ilike.%${query}%,brand.ilike.%${query}%`);
      }

      // Apply limit
      dbQuery = dbQuery.limit(limit);

      // Execute query
      const { data, error } = await dbQuery;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Transform to Canva format
      const canvaProducts: CanvaProduct[] = (data || []).map(product => ({
        id: product.id,
        product_name: product.product_name,
        brand: product.brand,
        category: product.category,
        tags: product.tags || [],
        color_palette: product.color_palette || [],
        // Note: We don't have image_url in enriched_products yet
        // This would be added in production
        thumbnail_url: this.generateThumbnailUrl(product)
      }));

      return {
        success: true,
        products: canvaProducts,
        count: canvaProducts.length,
        query: searchRequest
      };

    } catch (error) {
      console.error('Canva search error:', error);
      return {
        success: false,
        products: [],
        count: 0,
        query: searchRequest
      };
    }
  }

  /**
   * Generate thumbnail URL for product
   * In production, this would return actual product image
   */
  private generateThumbnailUrl(product: any): string {
    // Use Unsplash placeholder based on category
    const categoryImageMap: Record<string, string> = {
      'home-decor': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200',
      'tableware': 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=200',
      'furniture': 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=200',
      'textiles': 'https://images.unsplash.com/photo-1631889992441-396b3500d5a0?w=200',
      'storage': 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=200',
      'rugs': 'https://images.unsplash.com/photo-1600166898823-c16621304257?w=200',
      'lighting': 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=200',
      'art': 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=200'
    };

    return categoryImageMap[product.category] || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200';
  }

  /**
   * Get featured products for Canva
   */
  async getFeaturedProducts(limit: number = 10): Promise<CanvaSearchResponse> {
    try {
      const { data, error } = await this.supabase
        .from('enriched_products')
        .select('*')
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const canvaProducts: CanvaProduct[] = (data || []).map(product => ({
        id: product.id,
        product_name: product.product_name,
        brand: product.brand,
        category: product.category,
        tags: product.tags || [],
        color_palette: product.color_palette || [],
        thumbnail_url: this.generateThumbnailUrl(product)
      }));

      return {
        success: true,
        products: canvaProducts,
        count: canvaProducts.length,
        query: { limit }
      };

    } catch (error) {
      console.error('Featured products error:', error);
      return {
        success: false,
        products: [],
        count: 0,
        query: { limit }
      };
    }
  }

  /**
   * Get products by specific IDs
   */
  async getProductsByIds(productIds: string[]): Promise<CanvaProduct[]> {
    try {
      const { data, error } = await this.supabase
        .from('enriched_products')
        .select('*')
        .in('id', productIds);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return (data || []).map(product => ({
        id: product.id,
        product_name: product.product_name,
        brand: product.brand,
        category: product.category,
        tags: product.tags || [],
        color_palette: product.color_palette || [],
        thumbnail_url: this.generateThumbnailUrl(product)
      }));

    } catch (error) {
      console.error('Get products by IDs error:', error);
      return [];
    }
  }
}

/**
 * Create Canva search handler instance
 */
export function createCanvaSearchHandler(
  supabaseUrl: string,
  supabaseKey: string
): CanvaSearchHandler {
  return new CanvaSearchHandler(supabaseUrl, supabaseKey);
}
