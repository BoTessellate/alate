/**
 * Image CDN Types
 * Types for image processing, storage, and CDN delivery
 */

/**
 * Standard image sizes for CDN
 */
export type ImageSize = 'thumb' | 'preview' | 'large' | 'original';

/**
 * Pixel dimensions for each image size
 */
export const IMAGE_SIZE_DIMENSIONS: Record<Exclude<ImageSize, 'original'>, number> = {
  thumb: 256,
  preview: 768,
  large: 1440
};

/**
 * Image URLs for all sizes
 */
export interface ImageUrls {
  original: string;
  thumb: string;
  preview: string;
  large: string;
}

/**
 * Image processing job input
 */
export interface ImageProcessingInput {
  sourceUrl?: string;      // URL to fetch image from
  sourceBuffer?: Buffer;   // Raw image buffer
  brandId: string;
  productId: string;
  filename?: string;       // Optional custom filename
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  success: boolean;
  imageUrls?: ImageUrls;
  error?: string;
  processingTimeMs?: number;
}

/**
 * CDN provider configuration
 */
export interface CDNConfig {
  provider: 'cloudflare-r2' | 's3' | 'vercel-blob';
  bucket: string;
  publicUrl: string;       // CDN public URL prefix
  region?: string;         // For S3
  accessKeyId?: string;
  secretAccessKey?: string;
  accountId?: string;      // For Cloudflare R2
}

/**
 * Storage path components
 */
export interface StoragePath {
  bucket: string;
  key: string;             // Full path within bucket
  publicUrl: string;       // Public CDN URL
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'webp' | 'avif';
  size: number;            // File size in bytes
  contentType: string;
}

/**
 * Resize options
 */
export interface ResizeOptions {
  maxWidth: number;
  maxHeight?: number;
  quality?: number;        // 1-100, default 80
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Upload result for a single image
 */
export interface UploadResult {
  success: boolean;
  path: StoragePath;
  metadata?: ImageMetadata;
  error?: string;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  total: number;
  successful: number;
  failed: number;
  results: ImageProcessingResult[];
}
