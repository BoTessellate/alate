/**
 * Photo Upload API - Vercel Serverless Function
 *
 * Processes user-uploaded product photos:
 * 1. Upload raw image to Supabase storage
 * 2. Remove background (extract product)
 * 3. Enrich with AI (tags, colors, category, etc.)
 * 4. Return processed product data for frontend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { processPhotoUpload, PhotoUploadInput } from '../sdk/photoUpload';

const logger = createModuleLogger('photo-upload-api');

// Maximum payload size (base64 is ~33% larger than binary)
const MAX_PAYLOAD_SIZE = 15 * 1024 * 1024; // 15MB to account for base64 overhead

interface PhotoUploadRequestBody {
  image: {
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    fileName?: string;
  };
  productType: 'fashion' | 'home';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

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

    // Determine error type and code
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
