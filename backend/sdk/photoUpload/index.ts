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
