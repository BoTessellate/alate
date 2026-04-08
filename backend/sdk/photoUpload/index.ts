/**
 * Photo Upload SDK
 * User photo upload and processing pipeline
 */

export { processPhotoUpload } from './uploadProcessor';
export type {
  PhotoUploadInput,
  ProcessedProduct,
  PhotoUploadResponse,
  UploadConfig,
} from './uploadProcessor';
export {
  DEFAULT_UPLOAD_CONFIG,
  DEMO_ENRICHMENTS,
} from './types';
export type { PhotoUploadError } from './types';

// Multi-product detection exports
export { detectMultipleProducts } from './multiProductDetector';
export type {
  DetectedProduct,
  BoundingBox,
  MultiProductDetectionInput,
  MultiProductDetectionResponse,
} from './multiProductDetector';

// Multi-product processing exports
export { processSelectedProducts } from './multiProductProcessor';
export type {
  SelectedProduct,
  ProcessMultipleInput,
  ProcessMultipleResponse,
  ProcessingResult,
} from './multiProductProcessor';
