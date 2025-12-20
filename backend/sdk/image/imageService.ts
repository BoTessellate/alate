/**
 * Image Service
 * High-level service combining processing and CDN storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ImageUrls,
  ImageProcessingInput,
  ImageProcessingResult,
  BatchProcessingResult,
  CDNConfig
} from './types';
import { processImage, generateImageUrls } from './imageProcessor';
import { CDNStorage, createCDNStorageFromEnv } from './cdnStorage';

export interface ImageServiceConfig {
  cdnConfig: CDNConfig;
  supabaseUrl?: string;
  supabaseKey?: string;
}

/**
 * Image Service - orchestrates image processing and CDN uploads
 */
export class ImageService {
  private cdn: CDNStorage;
  private supabase: SupabaseClient | null = null;

  constructor(config: ImageServiceConfig) {
    this.cdn = new CDNStorage(config.cdnConfig);

    if (config.supabaseUrl && config.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
  }

  /**
   * Process and upload a product image
   * @param input - Image processing input
   * @returns Processing result with CDN URLs
   */
  async processAndUpload(input: ImageProcessingInput): Promise<ImageProcessingResult> {
    const startTime = Date.now();

    try {
      // Process image (fetch, validate, resize)
      const { variants, metadata } = await processImage(input);

      // Upload all variants to CDN
      const uploadResult = await this.cdn.uploadProductImages(
        variants,
        input.brandId,
        input.productId
      );

      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.errors?.join('; ') || 'Upload failed',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Update database if configured
      if (this.supabase && uploadResult.imageUrls) {
        await this.updateProductImageUrls(input.productId, uploadResult.imageUrls);
      }

      return {
        success: true,
        imageUrls: uploadResult.imageUrls,
        processingTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Process and upload multiple product images
   * @param inputs - Array of processing inputs
   * @returns Batch processing result
   */
  async processAndUploadBatch(
    inputs: ImageProcessingInput[]
  ): Promise<BatchProcessingResult> {
    const results: ImageProcessingResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process sequentially to avoid overwhelming resources
    for (const input of inputs) {
      const result = await this.processAndUpload(input);
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: inputs.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Update product image URLs in database
   * @param productId - Product ID
   * @param imageUrls - Image URLs to store
   */
  private async updateProductImageUrls(
    productId: string,
    imageUrls: ImageUrls
  ): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase
      .from('enriched_products')
      .update({ image_urls: imageUrls })
      .eq('id', productId);

    if (error) {
      console.error(`Failed to update image URLs for product ${productId}:`, error);
    }
  }

  /**
   * Delete product images from CDN and database
   * @param brandId - Brand ID
   * @param productId - Product ID
   */
  async deleteProductImages(brandId: string, productId: string): Promise<boolean> {
    // Delete from CDN
    const deleted = await this.cdn.deleteProductImages(brandId, productId);

    // Clear database reference
    if (this.supabase) {
      await this.supabase
        .from('enriched_products')
        .update({ image_urls: null })
        .eq('id', productId);
    }

    return deleted > 0;
  }

  /**
   * Get image URLs for a product (from CDN paths)
   * @param brandId - Brand ID
   * @param productId - Product ID
   * @returns Image URLs
   */
  getProductImageUrls(brandId: string, productId: string): ImageUrls {
    return this.cdn.getProductUrls(brandId, productId);
  }

  /**
   * Check if product images exist in CDN
   * @param brandId - Brand ID
   * @param productId - Product ID
   * @returns True if all images exist
   */
  async productImagesExist(brandId: string, productId: string): Promise<boolean> {
    const exists = await this.cdn.productImagesExist(brandId, productId);
    return Array.from(exists.values()).every(v => v);
  }

  /**
   * Re-process product images (useful for regenerating sizes)
   * @param brandId - Brand ID
   * @param productId - Product ID
   * @param sourceUrl - Original image URL (or fetch from DB)
   */
  async reprocessProductImages(
    brandId: string,
    productId: string,
    sourceUrl: string
  ): Promise<ImageProcessingResult> {
    return this.processAndUpload({
      brandId,
      productId,
      sourceUrl
    });
  }

  /**
   * Generate fallback URLs for missing images
   * @param imageUrls - Partial image URLs
   * @param fallbackUrl - URL to use for missing images
   * @returns Complete ImageUrls with fallbacks
   */
  static generateFallbackUrls(
    imageUrls: Partial<ImageUrls> | null,
    fallbackUrl: string
  ): ImageUrls {
    return {
      original: imageUrls?.original || fallbackUrl,
      thumb: imageUrls?.thumb || fallbackUrl,
      preview: imageUrls?.preview || fallbackUrl,
      large: imageUrls?.large || fallbackUrl
    };
  }
}

/**
 * Create image service with custom config
 */
export function createImageService(config: ImageServiceConfig): ImageService {
  return new ImageService(config);
}

/**
 * Create image service from environment variables
 */
export function createImageServiceFromEnv(): ImageService {
  const provider = (process.env.CDN_PROVIDER || 'cloudflare-r2') as CDNConfig['provider'];

  return new ImageService({
    cdnConfig: {
      provider,
      bucket: process.env.CDN_BUCKET || 'moodlayer-images',
      publicUrl: process.env.CDN_PUBLIC_URL || '',
      region: process.env.CDN_REGION || 'auto',
      accessKeyId: process.env.CDN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.CDN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID
    },
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY
  });
}
