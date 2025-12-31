/**
 * Image Processing API - Consolidated Endpoint
 * Combines background removal and photo upload functionality
 *
 * Routes:
 * POST /api/image-processing?action=remove-bg  - Remove background from product image
 * POST /api/image-processing?action=upload     - Upload and process product photo
 *
 * This consolidation reduces serverless function count for Vercel Hobby plan limits.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { processPhotoUpload, PhotoUploadInput } from '../sdk/photoUpload';

const logger = createModuleLogger('image-processing');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROCESSING_ENABLED = false; // Set to true when ready to process real products
const MAX_PAYLOAD_SIZE = 15 * 1024 * 1024; // 15MB to account for base64 overhead

// Lazy initialization for OpenAI (only when needed)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Lazy initialization for Supabase
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
  }
  return _supabase;
}

// ============================================================================
// TYPES
// ============================================================================

interface RemoveBackgroundRequest {
  product_id: string;
  image_url: string;
  force?: boolean;
}

interface PhotoUploadRequestBody {
  image: {
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    fileName?: string;
  };
  productType: 'fashion' | 'home';
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleRemoveBackground(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if processing is enabled
  if (!PROCESSING_ENABLED) {
    return res.status(503).json({
      error: 'Background removal is currently disabled',
      message: 'Processing will be enabled when real products are available',
      status: 'infrastructure_ready',
    });
  }

  try {
    const { product_id, image_url, force = false } = req.body as RemoveBackgroundRequest;

    if (!product_id || !image_url) {
      return res.status(400).json({ error: 'product_id and image_url are required' });
    }

    const supabase = getSupabase();

    // Check if cutout already exists (unless force reprocessing)
    if (!force) {
      const { data: existingProduct } = await supabase
        .from('products')
        .select('cutout_url')
        .eq('id', product_id)
        .single() as { data: { cutout_url?: string } | null };

      if (existingProduct?.cutout_url) {
        return res.status(200).json({
          success: true,
          cutout_url: existingProduct.cutout_url,
          cached: true,
        });
      }
    }

    const openai = getOpenAI();

    // Fetch the image and convert to buffer for OpenAI
    const imageRes = await fetch(image_url);
    const imageBlob = await imageRes.blob();
    const imageFile = new File([imageBlob], 'product.png', { type: 'image/png' });

    // Process with OpenAI
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: 'Remove the background from this product image completely. Keep only the product itself with a transparent background. Preserve all product details, colors, and quality.',
      size: '1024x1024',
    });

    const processedImageUrl = response.data?.[0]?.url;

    if (!processedImageUrl) {
      throw new Error('No image returned from OpenAI');
    }

    // Upload to Supabase Storage
    const imageResponse = await fetch(processedImageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const fileName = `${product_id}.png`;
    const { error: uploadError } = await supabase.storage
      .from('cutouts')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('cutouts')
      .getPublicUrl(fileName);

    const cutoutUrl = publicUrlData.publicUrl;

    // Update product record with cutout URL
    const { error: updateError } = await supabase
      .from('products')
      .update({ cutout_url: cutoutUrl } as any)
      .eq('id', product_id);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to update product with cutout URL');
    }

    return res.status(200).json({
      success: true,
      cutout_url: cutoutUrl,
      cached: false,
    });

  } catch (error) {
    logger.error({ error }, 'Background removal error');
    return res.status(500).json({
      error: 'Failed to remove background',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handlePhotoUpload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as PhotoUploadRequestBody;

    // Validate request structure
    if (!body.image || !body.image.base64) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.image.mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Image mimeType is required',
        code: 'INVALID_FORMAT',
      });
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(body.image.mimeType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid image format. Allowed: ${allowedTypes.join(', ')}`,
        code: 'INVALID_FORMAT',
      });
    }

    // Validate product type
    if (!body.productType || !['fashion', 'home'].includes(body.productType)) {
      return res.status(400).json({
        success: false,
        error: 'productType must be "fashion" or "home"',
        code: 'INVALID_FORMAT',
      });
    }

    // Check payload size
    if (body.image.base64.length > MAX_PAYLOAD_SIZE) {
      return res.status(413).json({
        success: false,
        error: 'Image file too large. Maximum size: 10MB',
        code: 'FILE_TOO_LARGE',
      });
    }

    logger.info({
      mimeType: body.image.mimeType,
      productType: body.productType,
      base64Length: body.image.base64.length,
    }, 'Processing photo upload');

    // Process the upload
    const input: PhotoUploadInput = {
      base64: body.image.base64,
      mimeType: body.image.mimeType,
      fileName: body.image.fileName,
      productType: body.productType,
    };

    const result = await processPhotoUpload(input);

    logger.info({
      productId: result.product.id,
      totalMs: result.processingTime.totalMs,
      demo: result._demo,
    }, 'Photo upload processed successfully');

    return res.status(200).json(result);

  } catch (error) {
    logger.error({ error }, 'Photo upload failed');

    const message = error instanceof Error ? error.message : 'Unknown error';
    let code = 'PROCESSING_FAILED';

    if (message.includes('Invalid file format') || message.includes('Invalid image')) {
      code = 'INVALID_FORMAT';
    } else if (message.includes('too large')) {
      code = 'FILE_TOO_LARGE';
    } else if (message.includes('Upload failed')) {
      code = 'UPLOAD_FAILED';
    } else if (message.includes('enrichment')) {
      code = 'ENRICHMENT_FAILED';
    }

    return res.status(500).json({
      success: false,
      error: message,
      code,
    });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  const action = req.query.action as string;

  switch (action) {
    case 'remove-bg':
      return handleRemoveBackground(req, res);

    case 'upload':
      return handlePhotoUpload(req, res);

    default:
      return res.status(400).json({
        error: 'Invalid action',
        hint: 'Use ?action=remove-bg or ?action=upload',
        examples: {
          'remove-bg': 'POST /api/image-processing?action=remove-bg',
          'upload': 'POST /api/image-processing?action=upload',
        },
      });
  }
}

/**
 * Vercel configuration for larger payloads
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};
