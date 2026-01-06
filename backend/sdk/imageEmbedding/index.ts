/**
 * Image Embedding SDK
 *
 * Provides image similarity matching for user closets using:
 * - GPT-4o-mini Vision for image descriptions
 * - text-embedding-3-small for vector embeddings
 * - Pinecone for vector storage and similarity search
 */

// Types
export type {
  ImageEmbeddingInput,
  ImageEmbeddingResult,
  FindSimilarInput,
  FindSimilarResult,
  SimilarProduct,
  ImageEmbeddingConfig,
  ProductMetadata,
  PineconeVector,
  PineconeQueryMatch,
} from './types';

// Constants and utilities
export {
  DEFAULT_CONFIG,
  USER_NAMESPACE_PREFIX,
  VECTOR_ID_PREFIX,
  getUserNamespace,
  getVectorId,
  parseVectorId,
} from './types';

// Description generator
export {
  generateImageDescription,
  generateQuickDescription,
  metadataToDescription,
} from './descriptionGenerator';
export type { DescriptionResult } from './descriptionGenerator';

// Main service
export {
  ImageEmbeddingService,
  createImageEmbeddingService,
  getImageEmbeddingService,
} from './imageEmbeddingService';
