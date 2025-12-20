/**
 * Image CDN SDK
 * Image processing, storage, and CDN delivery
 */

// Types
export type {
  ImageSize,
  ImageUrls,
  ImageProcessingInput,
  ImageProcessingResult,
  CDNConfig,
  StoragePath,
  ImageMetadata,
  ResizeOptions,
  UploadResult,
  BatchProcessingResult
} from './types';

export { IMAGE_SIZE_DIMENSIONS } from './types';

// Image processing functions
export {
  fetchImage,
  getImageMetadata,
  resizeImage,
  generateSizeVariants,
  generateStoragePath,
  generateImageUrls,
  validateImage,
  processImage,
  estimateProcessingTime
} from './imageProcessor';

// CDN storage
export { CDNStorage, createCDNStorageFromEnv } from './cdnStorage';

// Main image service
export { ImageService, createImageService, createImageServiceFromEnv } from './imageService';
