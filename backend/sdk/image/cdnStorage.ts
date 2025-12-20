/**
 * CDN Storage Module
 * Handles uploads to Cloudflare R2, S3, or Vercel Blob
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import {
  CDNConfig,
  StoragePath,
  UploadResult,
  ImageSize,
  ImageUrls
} from './types';
import { generateStoragePath, generateImageUrls } from './imageProcessor';

/**
 * CDN Storage client for managing image uploads
 */
export class CDNStorage {
  private client: S3Client;
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = config;

    // Configure S3 client (works with R2 and S3)
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region || 'auto',
      credentials: {
        accessKeyId: config.accessKeyId || '',
        secretAccessKey: config.secretAccessKey || ''
      }
    };

    // Cloudflare R2 endpoint
    if (config.provider === 'cloudflare-r2' && config.accountId) {
      clientConfig.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Upload a single image to CDN
   * @param buffer - Image buffer
   * @param key - Storage key (path)
   * @param contentType - MIME type
   * @returns Upload result
   */
  async upload(
    buffer: Buffer,
    key: string,
    contentType: string = 'image/jpeg'
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable', // 1 year cache
        ACL: 'public-read'
      });

      await this.client.send(command);

      const publicUrl = `${this.config.publicUrl.replace(/\/$/, '')}/${key}`;

      return {
        success: true,
        path: {
          bucket: this.config.bucket,
          key,
          publicUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        path: {
          bucket: this.config.bucket,
          key,
          publicUrl: ''
        },
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Upload all image variants for a product
   * @param variants - Map of size to buffer
   * @param brandId - Brand identifier
   * @param productId - Product identifier
   * @returns ImageUrls object with all CDN URLs
   */
  async uploadProductImages(
    variants: Map<ImageSize, Buffer>,
    brandId: string,
    productId: string
  ): Promise<{ success: boolean; imageUrls?: ImageUrls; errors?: string[] }> {
    const errors: string[] = [];
    const urls: Partial<ImageUrls> = {};

    for (const [size, buffer] of variants) {
      const key = generateStoragePath(brandId, productId, size);
      const result = await this.upload(buffer, key);

      if (result.success) {
        urls[size] = result.path.publicUrl;
      } else {
        errors.push(`Failed to upload ${size}: ${result.error}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      imageUrls: urls as ImageUrls
    };
  }

  /**
   * Delete an image from CDN
   * @param key - Storage key
   * @returns Success status
   */
  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error(`Failed to delete ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all images for a product
   * @param brandId - Brand identifier
   * @param productId - Product identifier
   * @returns Number of deleted files
   */
  async deleteProductImages(brandId: string, productId: string): Promise<number> {
    const sizes: ImageSize[] = ['original', 'thumb', 'preview', 'large'];
    let deleted = 0;

    for (const size of sizes) {
      const key = generateStoragePath(brandId, productId, size);
      if (await this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if an image exists
   * @param key - Storage key
   * @returns Exists status
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if product images exist
   * @param brandId - Brand identifier
   * @param productId - Product identifier
   * @returns Map of size to exists status
   */
  async productImagesExist(
    brandId: string,
    productId: string
  ): Promise<Map<ImageSize, boolean>> {
    const sizes: ImageSize[] = ['original', 'thumb', 'preview', 'large'];
    const results = new Map<ImageSize, boolean>();

    for (const size of sizes) {
      const key = generateStoragePath(brandId, productId, size);
      results.set(size, await this.exists(key));
    }

    return results;
  }

  /**
   * Get public URL for an image
   * @param key - Storage key
   * @returns Public CDN URL
   */
  getPublicUrl(key: string): string {
    return `${this.config.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  /**
   * Get all public URLs for a product
   * @param brandId - Brand identifier
   * @param productId - Product identifier
   * @returns ImageUrls object
   */
  getProductUrls(brandId: string, productId: string): ImageUrls {
    return generateImageUrls(this.config.publicUrl, brandId, productId);
  }
}

/**
 * Create CDN storage from environment variables
 */
export function createCDNStorageFromEnv(): CDNStorage {
  const provider = (process.env.CDN_PROVIDER || 'cloudflare-r2') as CDNConfig['provider'];

  const config: CDNConfig = {
    provider,
    bucket: process.env.CDN_BUCKET || 'moodlayer-images',
    publicUrl: process.env.CDN_PUBLIC_URL || '',
    region: process.env.CDN_REGION || 'auto',
    accessKeyId: process.env.CDN_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.CDN_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID
  };

  return new CDNStorage(config);
}
