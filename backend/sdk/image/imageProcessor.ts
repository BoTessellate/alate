/**
 * Image Processor Module
 * Handles image fetching, resizing, and preparation for CDN upload
 */

import sharp from 'sharp';
import {
  ImageSize,
  IMAGE_SIZE_DIMENSIONS,
  ImageUrls,
  ImageProcessingInput,
  ImageProcessingResult,
  ImageMetadata,
  ResizeOptions
} from './types';

/**
 * Fetch image from URL
 * @param url - Source URL
 * @returns Image buffer
 */
export async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.startsWith('image/')) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get image metadata from buffer
 * @param buffer - Image buffer
 * @returns Image metadata
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error('Unable to read image metadata');
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format as ImageMetadata['format'],
    size: buffer.length,
    contentType: `image/${metadata.format}`
  };
}

/**
 * Resize image to specified dimensions
 * @param buffer - Source image buffer
 * @param options - Resize options
 * @returns Resized image buffer
 */
export async function resizeImage(
  buffer: Buffer,
  options: ResizeOptions
): Promise<Buffer> {
  let pipeline = sharp(buffer);

  // Resize with aspect ratio preservation
  pipeline = pipeline.resize({
    width: options.maxWidth,
    height: options.maxHeight,
    fit: options.fit || 'inside',
    withoutEnlargement: true
  });

  // Convert to specified format (default: jpeg)
  const format = options.format || 'jpeg';
  const quality = options.quality || 80;

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
  }

  return pipeline.toBuffer();
}

/**
 * Generate all size variants from source image
 * @param sourceBuffer - Original image buffer
 * @returns Map of size to buffer
 */
export async function generateSizeVariants(
  sourceBuffer: Buffer
): Promise<Map<ImageSize, Buffer>> {
  const variants = new Map<ImageSize, Buffer>();

  // Original (optimized but not resized)
  const optimizedOriginal = await sharp(sourceBuffer)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  variants.set('original', optimizedOriginal);

  // Generate resized variants
  for (const [size, width] of Object.entries(IMAGE_SIZE_DIMENSIONS)) {
    const resized = await resizeImage(sourceBuffer, {
      maxWidth: width,
      quality: size === 'thumb' ? 70 : 80
    });
    variants.set(size as ImageSize, resized);
  }

  return variants;
}

/**
 * Generate storage path for an image
 * @param brandId - Brand identifier
 * @param productId - Product identifier
 * @param size - Image size variant
 * @returns Storage path key
 */
export function generateStoragePath(
  brandId: string,
  productId: string,
  size: ImageSize
): string {
  const filename = size === 'original' ? 'original.jpg' : `${size}.jpg`;
  return `products/${brandId}/${productId}/${filename}`;
}

/**
 * Generate public CDN URLs for all sizes
 * @param cdnBaseUrl - CDN base URL
 * @param brandId - Brand identifier
 * @param productId - Product identifier
 * @returns ImageUrls object
 */
export function generateImageUrls(
  cdnBaseUrl: string,
  brandId: string,
  productId: string
): ImageUrls {
  const baseUrl = cdnBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  const basePath = `products/${brandId}/${productId}`;

  return {
    original: `${baseUrl}/${basePath}/original.jpg`,
    thumb: `${baseUrl}/${basePath}/thumb.jpg`,
    preview: `${baseUrl}/${basePath}/preview.jpg`,
    large: `${baseUrl}/${basePath}/large.jpg`
  };
}

/**
 * Validate image buffer
 * @param buffer - Image buffer to validate
 * @returns Validation result
 */
export async function validateImage(
  buffer: Buffer
): Promise<{ isValid: boolean; error?: string; metadata?: ImageMetadata }> {
  try {
    const metadata = await getImageMetadata(buffer);

    // Check minimum dimensions
    if (metadata.width < 100 || metadata.height < 100) {
      return {
        isValid: false,
        error: 'Image too small. Minimum dimensions: 100x100 pixels'
      };
    }

    // Check maximum file size (10MB)
    if (metadata.size > 10 * 1024 * 1024) {
      return {
        isValid: false,
        error: 'Image too large. Maximum file size: 10MB'
      };
    }

    // Check format
    const allowedFormats = ['jpeg', 'png', 'webp', 'avif'];
    if (!allowedFormats.includes(metadata.format)) {
      return {
        isValid: false,
        error: `Invalid format: ${metadata.format}. Allowed: ${allowedFormats.join(', ')}`
      };
    }

    return { isValid: true, metadata };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate image: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Process a single image: fetch, validate, resize
 * @param input - Processing input
 * @returns Map of size variants ready for upload
 */
export async function processImage(
  input: ImageProcessingInput
): Promise<{ variants: Map<ImageSize, Buffer>; metadata: ImageMetadata }> {
  // Get source buffer
  let sourceBuffer: Buffer;

  if (input.sourceBuffer) {
    sourceBuffer = input.sourceBuffer;
  } else if (input.sourceUrl) {
    sourceBuffer = await fetchImage(input.sourceUrl);
  } else {
    throw new Error('Either sourceUrl or sourceBuffer must be provided');
  }

  // Validate
  const validation = await validateImage(sourceBuffer);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Generate variants
  const variants = await generateSizeVariants(sourceBuffer);

  return {
    variants,
    metadata: validation.metadata!
  };
}

/**
 * Calculate estimated processing time based on image size
 * @param metadata - Image metadata
 * @returns Estimated time in milliseconds
 */
export function estimateProcessingTime(metadata: ImageMetadata): number {
  const pixels = metadata.width * metadata.height;
  // Rough estimate: 1ms per 10,000 pixels
  const baseTime = Math.ceil(pixels / 10000);
  // Add overhead for each variant
  const variantCount = Object.keys(IMAGE_SIZE_DIMENSIONS).length + 1;
  return baseTime * variantCount + 500; // 500ms overhead
}
