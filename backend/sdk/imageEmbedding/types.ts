/**
 * Image Embedding Types
 *
 * Types for the image embedding service that generates visual descriptions
 * and stores embeddings in Pinecone for similarity matching.
 */

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface ImageEmbeddingInput {
  /** URL of the image to generate embedding for */
  imageUrl: string;
  /** Unique product ID */
  productId: string;
  /** Device ID for per-user namespace isolation */
  deviceId: string;
  /** Optional metadata to store alongside the embedding */
  metadata?: ProductMetadata;
}

export interface ProductMetadata {
  productName?: string;
  brand?: string;
  category?: string;
  tags?: string[];
  colors?: string[];
  material?: string;
  size?: string;
  price?: number;
  currency?: string;
}

export interface FindSimilarInput {
  /** URL of the image to find similar products for */
  imageUrl: string;
  /** Device ID to search within user's closet */
  deviceId: string;
  /** Minimum similarity score (0-1), default 0.75 */
  threshold?: number;
  /** Maximum number of results, default 5 */
  limit?: number;
}

// =============================================================================
// OUTPUT TYPES
// =============================================================================

export interface SimilarProduct {
  /** Product ID in user's closet */
  productId: string;
  /** Similarity score (0-1) */
  score: number;
  /** Product name */
  productName: string;
  /** Image URL */
  imageUrl?: string;
  /** Brand if available */
  brand?: string;
  /** Category */
  category?: string;
  /** Product tags */
  tags?: string[];
  /** Color palette */
  colors?: string[];
}

export interface ImageEmbeddingResult {
  success: boolean;
  /** Pinecone vector ID: img:{deviceId}:{productId} */
  embeddingId?: string;
  /** Vision-generated description of the image */
  visionDescription?: string;
  /** The embedding vector (usually not returned to client) */
  embedding?: number[];
  /** Error message if failed */
  error?: string;
}

export interface FindSimilarResult {
  success: boolean;
  /** Array of similar products from user's closet */
  similarProducts: SimilarProduct[];
  /** Vision-generated description used for matching */
  visionDescription?: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface ImageEmbeddingConfig {
  /** Pinecone API key */
  pineconeApiKey: string;
  /** Pinecone index name (default: mood-layer-products) */
  pineconeIndexName: string;
  /** Pinecone host URL */
  pineconeHost?: string;
  /** OpenAI API key for vision and embeddings */
  openaiApiKey: string;
  /** Similarity threshold for matches (default: 0.75) */
  similarityThreshold?: number;
  /** Max similar results to return (default: 5) */
  maxSimilarResults?: number;
  /** Embedding model (default: text-embedding-3-small) */
  embeddingModel?: string;
  /** Embedding dimensions (default: 1536) */
  embeddingDimensions?: number;
  /** Vision model for descriptions (default: gpt-4o-mini) */
  visionModel?: string;
}

// =============================================================================
// PINECONE TYPES
// =============================================================================

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface PineconeQueryMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_CONFIG: Partial<ImageEmbeddingConfig> = {
  pineconeIndexName: 'mood-layer-products',
  similarityThreshold: 0.75,
  maxSimilarResults: 5,
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
  visionModel: 'gpt-4o-mini',
};

/** Namespace prefix for user embeddings in Pinecone */
export const USER_NAMESPACE_PREFIX = 'user:';

/** Vector ID prefix for image embeddings */
export const VECTOR_ID_PREFIX = 'img:';

/**
 * Generate a Pinecone namespace for a user
 */
export function getUserNamespace(deviceId: string): string {
  return `${USER_NAMESPACE_PREFIX}${deviceId}`;
}

/**
 * Generate a vector ID for a product image embedding
 */
export function getVectorId(deviceId: string, productId: string): string {
  return `${VECTOR_ID_PREFIX}${deviceId}:${productId}`;
}

/**
 * Parse a vector ID to extract deviceId and productId
 */
export function parseVectorId(vectorId: string): { deviceId: string; productId: string } | null {
  if (!vectorId.startsWith(VECTOR_ID_PREFIX)) return null;
  const parts = vectorId.slice(VECTOR_ID_PREFIX.length).split(':');
  if (parts.length < 2) return null;
  return {
    deviceId: parts[0],
    productId: parts.slice(1).join(':'), // productId might contain colons
  };
}
