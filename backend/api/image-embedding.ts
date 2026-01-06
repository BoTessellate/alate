/**
 * Image Embedding API
 *
 * Routes:
 * POST /api/image-embedding?action=find-similar - Find similar products in user's closet
 * POST /api/image-embedding?action=embed        - Generate and store embedding for a product
 * POST /api/image-embedding?action=delete       - Delete an embedding
 * GET  /api/image-embedding?action=stats        - Get embedding stats for user
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import {
  createImageEmbeddingService,
  ImageEmbeddingService,
  SimilarProduct,
} from '../sdk/imageEmbedding';

const logger = createModuleLogger('image-embedding');

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

let _service: ImageEmbeddingService | null = null;

function getService(): ImageEmbeddingService {
  if (!_service) {
    _service = createImageEmbeddingService();
  }
  return _service;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface FindSimilarRequest {
  image_url: string;
  device_id: string;
  threshold?: number;
  limit?: number;
}

interface FindSimilarResponse {
  success: boolean;
  similar_products: SimilarProduct[];
  vision_description?: string;
  error?: string;
}

interface EmbedRequest {
  image_url: string;
  product_id: string;
  device_id: string;
  metadata?: {
    product_name?: string;
    brand?: string;
    category?: string;
    tags?: string[];
    colors?: string[];
    material?: string;
    size?: string;
    price?: number;
    currency?: string;
  };
}

interface EmbedResponse {
  success: boolean;
  embedding_id?: string;
  vision_description?: string;
  error?: string;
}

interface DeleteRequest {
  embedding_id: string;
  device_id: string;
}

interface DeleteResponse {
  success: boolean;
  error?: string;
}

interface StatsResponse {
  success: boolean;
  vector_count?: number;
  error?: string;
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * Find similar products in user's closet
 */
async function handleFindSimilar(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const body = req.body as FindSimilarRequest;

  // Validate required fields
  if (!body.image_url) {
    res.status(400).json({ success: false, error: 'image_url is required' });
    return;
  }

  if (!body.device_id) {
    res.status(400).json({ success: false, error: 'device_id is required' });
    return;
  }

  const startTime = Date.now();
  logger.info({ device_id: body.device_id }, 'Finding similar products');

  try {
    const service = getService();
    const result = await service.findSimilarProducts({
      imageUrl: body.image_url,
      deviceId: body.device_id,
      threshold: body.threshold,
      limit: body.limit,
    });

    const response: FindSimilarResponse = {
      success: result.success,
      similar_products: result.similarProducts,
      vision_description: result.visionDescription,
      error: result.error,
    };

    logger.info(
      {
        device_id: body.device_id,
        found: result.similarProducts.length,
        duration_ms: Date.now() - startTime,
      },
      'Similar products search complete'
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Error finding similar products');
    res.status(500).json({
      success: false,
      similar_products: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate and store embedding for a product
 */
async function handleEmbed(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const body = req.body as EmbedRequest;

  // Validate required fields
  if (!body.image_url) {
    res.status(400).json({ success: false, error: 'image_url is required' });
    return;
  }

  if (!body.product_id) {
    res.status(400).json({ success: false, error: 'product_id is required' });
    return;
  }

  if (!body.device_id) {
    res.status(400).json({ success: false, error: 'device_id is required' });
    return;
  }

  const startTime = Date.now();
  logger.info(
    { product_id: body.product_id, device_id: body.device_id },
    'Generating embedding'
  );

  try {
    const service = getService();
    const result = await service.generateAndStoreEmbedding({
      imageUrl: body.image_url,
      productId: body.product_id,
      deviceId: body.device_id,
      metadata: body.metadata
        ? {
            productName: body.metadata.product_name,
            brand: body.metadata.brand,
            category: body.metadata.category,
            tags: body.metadata.tags,
            colors: body.metadata.colors,
            material: body.metadata.material,
            size: body.metadata.size,
            price: body.metadata.price,
            currency: body.metadata.currency,
          }
        : undefined,
    });

    const response: EmbedResponse = {
      success: result.success,
      embedding_id: result.embeddingId,
      vision_description: result.visionDescription,
      error: result.error,
    };

    logger.info(
      {
        product_id: body.product_id,
        embedding_id: result.embeddingId,
        duration_ms: Date.now() - startTime,
      },
      'Embedding generated'
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Error generating embedding');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete an embedding
 */
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const body = req.body as DeleteRequest;

  // Validate required fields
  if (!body.embedding_id) {
    res.status(400).json({ success: false, error: 'embedding_id is required' });
    return;
  }

  if (!body.device_id) {
    res.status(400).json({ success: false, error: 'device_id is required' });
    return;
  }

  logger.info(
    { embedding_id: body.embedding_id, device_id: body.device_id },
    'Deleting embedding'
  );

  try {
    const service = getService();
    const success = await service.deleteEmbedding(body.embedding_id, body.device_id);

    const response: DeleteResponse = {
      success,
      error: success ? undefined : 'Failed to delete embedding',
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Error deleting embedding');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get embedding stats for a user
 */
async function handleStats(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const deviceId = req.query.device_id as string;

  if (!deviceId) {
    res.status(400).json({ success: false, error: 'device_id query parameter is required' });
    return;
  }

  logger.info({ device_id: deviceId }, 'Getting embedding stats');

  try {
    const service = getService();
    const stats = await service.getUserEmbeddingStats(deviceId);

    const response: StatsResponse = {
      success: !!stats,
      vector_count: stats?.vectorCount,
      error: stats ? undefined : 'Failed to get stats',
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Error getting stats');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Apply CORS, rate limiting, and security headers
  const handled = await applyMiddleware(req, res);
  if (handled) return;

  // Only POST for mutations, GET for stats
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const action = req.query.action as string;

  switch (action) {
    case 'find-similar':
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'POST required for find-similar' });
        return;
      }
      await handleFindSimilar(req, res);
      break;

    case 'embed':
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'POST required for embed' });
        return;
      }
      await handleEmbed(req, res);
      break;

    case 'delete':
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'POST required for delete' });
        return;
      }
      await handleDelete(req, res);
      break;

    case 'stats':
      if (req.method !== 'GET') {
        res.status(405).json({ success: false, error: 'GET required for stats' });
        return;
      }
      await handleStats(req, res);
      break;

    default:
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use: find-similar, embed, delete, or stats',
      });
  }
}
