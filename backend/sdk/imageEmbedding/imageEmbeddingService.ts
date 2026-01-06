/**
 * Image Embedding Service
 *
 * Core service for generating and managing image embeddings in Pinecone.
 * Uses GPT-4o-mini Vision for descriptions and text-embedding-3-small for vectors.
 * Supports per-user namespaces for closet isolation.
 */

import OpenAI from 'openai';
import { Pinecone, Index } from '@pinecone-database/pinecone';
import { createModuleLogger } from '../shared/logger';
import { generateImageDescription, metadataToDescription } from './descriptionGenerator';

const logger = createModuleLogger('image-embedding');
import {
  ImageEmbeddingInput,
  ImageEmbeddingResult,
  FindSimilarInput,
  FindSimilarResult,
  SimilarProduct,
  ImageEmbeddingConfig,
  ProductMetadata,
  DEFAULT_CONFIG,
  getUserNamespace,
  getVectorId,
  parseVectorId,
} from './types';

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class ImageEmbeddingService {
  private pinecone: Pinecone;
  private pineconeIndex: Index;
  private openai: OpenAI;
  private config: Required<
    Pick<
      ImageEmbeddingConfig,
      | 'similarityThreshold'
      | 'maxSimilarResults'
      | 'embeddingModel'
      | 'embeddingDimensions'
      | 'visionModel'
    >
  >;

  constructor(config: ImageEmbeddingConfig) {
    // Initialize Pinecone
    this.pinecone = new Pinecone({
      apiKey: config.pineconeApiKey,
    });
    this.pineconeIndex = this.pinecone.index(config.pineconeIndexName);

    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Store config with defaults
    this.config = {
      similarityThreshold: config.similarityThreshold ?? DEFAULT_CONFIG.similarityThreshold!,
      maxSimilarResults: config.maxSimilarResults ?? DEFAULT_CONFIG.maxSimilarResults!,
      embeddingModel: config.embeddingModel ?? DEFAULT_CONFIG.embeddingModel!,
      embeddingDimensions: config.embeddingDimensions ?? DEFAULT_CONFIG.embeddingDimensions!,
      visionModel: config.visionModel ?? DEFAULT_CONFIG.visionModel!,
    };

    logger.info({ index: config.pineconeIndexName }, 'Initialized ImageEmbeddingService');
  }

  // ===========================================================================
  // EMBEDDING GENERATION
  // ===========================================================================

  /**
   * Generate a text embedding from a description
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel,
      input: text,
      dimensions: this.config.embeddingDimensions,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate and store an embedding for a product image
   */
  async generateAndStoreEmbedding(input: ImageEmbeddingInput): Promise<ImageEmbeddingResult> {
    const { imageUrl, productId, deviceId, metadata } = input;

    try {
      // Step 1: Generate vision description
      const descResult = await generateImageDescription(imageUrl);

      if (!descResult.success || !descResult.description) {
        return {
          success: false,
          error: descResult.error || 'Failed to generate image description',
        };
      }

      // Step 2: Combine vision description with metadata for richer embedding
      let fullDescription = descResult.description;
      if (metadata) {
        const metaDesc = metadataToDescription(metadata);
        if (metaDesc) {
          fullDescription = `${descResult.description}\n\nMetadata: ${metaDesc}`;
        }
      }

      // Step 3: Generate embedding
      const embedding = await this.generateEmbedding(fullDescription);

      // Step 4: Store in Pinecone with user namespace
      const vectorId = getVectorId(deviceId, productId);
      const namespace = getUserNamespace(deviceId);

      const pineconeMetadata: Record<string, string | string[] | number | boolean> = {
        product_id: productId,
        device_id: deviceId,
        image_url: imageUrl, // Store for similarity results display
        vision_description: descResult.description.slice(0, 1000), // Truncate for Pinecone limits
      };

      // Add metadata fields if provided
      if (metadata) {
        if (metadata.productName) pineconeMetadata.product_name = metadata.productName;
        if (metadata.brand) pineconeMetadata.brand = metadata.brand;
        if (metadata.category) pineconeMetadata.category = metadata.category;
        if (metadata.tags && metadata.tags.length > 0) pineconeMetadata.tags = metadata.tags;
        if (metadata.colors && metadata.colors.length > 0) pineconeMetadata.colors = metadata.colors;
        if (metadata.material) pineconeMetadata.material = metadata.material;
        if (metadata.size) pineconeMetadata.size = metadata.size;
        if (metadata.price !== undefined) pineconeMetadata.price = metadata.price;
      }

      await this.pineconeIndex.namespace(namespace).upsert([
        {
          id: vectorId,
          values: embedding,
          metadata: pineconeMetadata,
        },
      ]);

      logger.info({ vectorId, namespace }, 'Stored embedding');

      return {
        success: true,
        embeddingId: vectorId,
        visionDescription: descResult.description,
      };
    } catch (error) {
      logger.error({ error }, 'Error generating embedding');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating embedding',
      };
    }
  }

  // ===========================================================================
  // SIMILARITY SEARCH
  // ===========================================================================

  /**
   * Find similar products in user's closet based on image
   */
  async findSimilarProducts(input: FindSimilarInput): Promise<FindSimilarResult> {
    const {
      imageUrl,
      deviceId,
      threshold = this.config.similarityThreshold,
      limit = this.config.maxSimilarResults,
    } = input;

    try {
      // Step 1: Generate vision description for the query image
      const descResult = await generateImageDescription(imageUrl);

      if (!descResult.success || !descResult.description) {
        return {
          success: false,
          similarProducts: [],
          error: descResult.error || 'Failed to generate image description',
        };
      }

      // Step 2: Generate embedding for the description
      const embedding = await this.generateEmbedding(descResult.description);

      // Step 3: Query Pinecone in user's namespace
      const namespace = getUserNamespace(deviceId);

      const queryResponse = await this.pineconeIndex.namespace(namespace).query({
        vector: embedding,
        topK: limit,
        includeMetadata: true,
      });

      // Step 4: Filter by threshold and map to SimilarProduct
      const similarProducts: SimilarProduct[] = (queryResponse.matches || [])
        .filter((match) => (match.score || 0) >= threshold)
        .map((match) => {
          const meta = match.metadata || {};
          return {
            productId: (meta.product_id as string) || parseVectorId(match.id)?.productId || match.id,
            score: match.score || 0,
            productName: (meta.product_name as string) || 'Unknown Product',
            imageUrl: meta.image_url as string | undefined,
            brand: meta.brand as string | undefined,
            category: meta.category as string | undefined,
            tags: meta.tags as string[] | undefined,
            colors: meta.colors as string[] | undefined,
          };
        });

      logger.info({ count: similarProducts.length, namespace }, 'Found similar products');

      return {
        success: true,
        similarProducts,
        visionDescription: descResult.description,
      };
    } catch (error) {
      logger.error({ error }, 'Error finding similar products');
      return {
        success: false,
        similarProducts: [],
        error: error instanceof Error ? error.message : 'Unknown error finding similar products',
      };
    }
  }

  // ===========================================================================
  // EMBEDDING MANAGEMENT
  // ===========================================================================

  /**
   * Delete an embedding from Pinecone
   */
  async deleteEmbedding(embeddingId: string, deviceId: string): Promise<boolean> {
    try {
      const namespace = getUserNamespace(deviceId);
      await this.pineconeIndex.namespace(namespace).deleteOne(embeddingId);
      logger.info({ embeddingId, namespace }, 'Deleted embedding');
      return true;
    } catch (error) {
      logger.error({ error, embeddingId }, 'Error deleting embedding');
      return false;
    }
  }

  /**
   * Delete all embeddings for a user (use with caution)
   */
  async deleteAllUserEmbeddings(deviceId: string): Promise<boolean> {
    try {
      const namespace = getUserNamespace(deviceId);
      await this.pineconeIndex.namespace(namespace).deleteAll();
      logger.info({ namespace }, 'Deleted all user embeddings');
      return true;
    } catch (error) {
      logger.error({ error, deviceId }, 'Error deleting user embeddings');
      return false;
    }
  }

  /**
   * Get stats about a user's embeddings
   */
  async getUserEmbeddingStats(deviceId: string): Promise<{ vectorCount: number } | null> {
    try {
      const stats = await this.pineconeIndex.describeIndexStats();
      const namespace = getUserNamespace(deviceId);
      const namespaceStats = stats.namespaces?.[namespace];
      return {
        vectorCount: namespaceStats?.recordCount || 0,
      };
    } catch (error) {
      logger.error({ error, deviceId }, 'Error getting stats');
      return null;
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an ImageEmbeddingService instance with environment variables
 */
export function createImageEmbeddingService(
  config?: Partial<ImageEmbeddingConfig>
): ImageEmbeddingService {
  return new ImageEmbeddingService({
    pineconeApiKey: config?.pineconeApiKey || process.env.PINECONE_API_KEY || '',
    pineconeIndexName: config?.pineconeIndexName || process.env.PINECONE_INDEX_NAME || 'mood-layer-products',
    openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY || '',
    similarityThreshold: config?.similarityThreshold,
    maxSimilarResults: config?.maxSimilarResults,
    embeddingModel: config?.embeddingModel,
    embeddingDimensions: config?.embeddingDimensions,
    visionModel: config?.visionModel,
  });
}

// Export singleton for convenience
let defaultService: ImageEmbeddingService | null = null;

export function getImageEmbeddingService(): ImageEmbeddingService {
  if (!defaultService) {
    defaultService = createImageEmbeddingService();
  }
  return defaultService;
}
