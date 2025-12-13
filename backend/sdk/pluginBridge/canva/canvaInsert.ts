/**
 * Canva Insert Integration
 * Generates layout and provides data for Canva board insertion
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CanvaInsertRequest, CanvaInsertResponse } from '../types';
import { LayoutGenerator } from '../../layoutGenerator/generateLayout';
import { renderLayout } from '../../exportEngine/renderBoard';
import { exportAndUpload } from '../../exportEngine/exportToImage';

/**
 * Canva Insert Handler
 */
export class CanvaInsertHandler {
  private supabase: SupabaseClient;
  private layoutGenerator: LayoutGenerator;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.layoutGenerator = new LayoutGenerator();
  }

  /**
   * Generate layout for Canva insertion
   */
  async generateCanvaLayout(request: CanvaInsertRequest): Promise<CanvaInsertResponse> {
    try {
      const { product_ids, layout_type, canvas_size, format = 'json' } = request;

      // Validate product IDs
      if (!product_ids || product_ids.length === 0) {
        return {
          success: false,
          error: 'No product IDs provided'
        };
      }

      // Fetch products from database
      const { data: products, error } = await this.supabase
        .from('enriched_products')
        .select('*')
        .in('id', product_ids);

      if (error || !products || products.length === 0) {
        return {
          success: false,
          error: 'Products not found'
        };
      }

      // Transform to product input format
      const productInputs = products.map(p => ({
        image_url: this.generateImageUrl(p),
        brand: p.brand,
        tags: p.tags || []
      }));

      // Generate layout
      const layout = await this.layoutGenerator.generateLayout({
        products: productInputs,
        layout_type: layout_type || this.selectLayoutType(products.length),
        canvas_size: canvas_size || { width: 1200, height: 1200 },
        show_labels: true
      });

      // Return based on format
      if (format === 'json') {
        return {
          success: true,
          layout,
          elements: layout.elements
        };
      }

      // Generate image if requested
      if (format === 'image') {
        const canvas = await renderLayout(layout);
        const exportResult = await exportAndUpload(canvas, 'png', {
          uploadToCdn: true,
          supabaseUrl: process.env.SUPABASE_URL,
          supabaseKey: process.env.SUPABASE_KEY
        });

        return {
          success: true,
          layout,
          image_url: exportResult.export_url,
          elements: layout.elements
        };
      }

      return {
        success: false,
        error: 'Invalid format'
      };

    } catch (error) {
      console.error('Canva insert error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Layout generation failed'
      };
    }
  }

  /**
   * Select appropriate layout type based on product count
   */
  private selectLayoutType(productCount: number): string {
    if (productCount <= 2) return 'MinimalSplit';
    if (productCount <= 4) return 'LayeredCenterpiece';
    if (productCount <= 7) return 'ZigZagStaggered';
    return 'GridWithOverlap';
  }

  /**
   * Generate image URL for product
   */
  private generateImageUrl(product: any): string {
    // Map categories to placeholder images
    const categoryImageMap: Record<string, string> = {
      'home-decor': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500',
      'tableware': 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=500',
      'furniture': 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=500',
      'textiles': 'https://images.unsplash.com/photo-1631889992441-396b3500d5a0?w=500',
      'storage': 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500',
      'rugs': 'https://images.unsplash.com/photo-1600166898823-c16621304257?w=500',
      'lighting': 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500',
      'art': 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=500',
      'garden': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500',
      'drinkware': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
      'fashion': 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=500',
      'stationery': 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500'
    };

    return categoryImageMap[product.category] || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500';
  }

  /**
   * Get layout preview
   */
  async getLayoutPreview(productIds: string[], layoutType?: string): Promise<any> {
    try {
      const { data: products } = await this.supabase
        .from('enriched_products')
        .select('*')
        .in('id', productIds);

      if (!products || products.length === 0) {
        return null;
      }

      const productInputs = products.map(p => ({
        image_url: this.generateImageUrl(p),
        brand: p.brand,
        tags: p.tags || []
      }));

      return await this.layoutGenerator.generateLayout({
        products: productInputs,
        layout_type: layoutType || this.selectLayoutType(products.length),
        canvas_size: { width: 600, height: 600 }, // Smaller preview size
        show_labels: true
      });

    } catch (error) {
      console.error('Layout preview error:', error);
      return null;
    }
  }
}

/**
 * Create Canva insert handler instance
 */
export function createCanvaInsertHandler(
  supabaseUrl: string,
  supabaseKey: string
): CanvaInsertHandler {
  return new CanvaInsertHandler(supabaseUrl, supabaseKey);
}
