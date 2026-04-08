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
import {
  processPhotoUpload,
  PhotoUploadInput,
  detectMultipleProducts,
  MultiProductDetectionInput,
  processSelectedProducts,
  ProcessMultipleInput,
  SelectedProduct,
} from '../sdk/photoUpload';
import {
  findBestProductImage,
  shouldSearchForImage,
  type DetectedProductInfo,
} from '../sdk/productImageSearch';

const logger = createModuleLogger('image-processing');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Enable real processing via env var (defaults to true now that we're ready)
const PROCESSING_ENABLED = process.env.PROCESSING_ENABLED !== 'false';
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

interface DetectMultiRequestBody {
  image: {
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  };
  context: 'fashion' | 'home';
}

interface SmartDetectRequestBody {
  image: {
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  };
  context: 'fashion' | 'home';
}

type RecommendedMode = 'single' | 'multi' | 'uncertain';

interface SmartDetectResponse {
  success: boolean;
  recommendedMode: RecommendedMode;
  detectedProducts: Array<{
    tempId: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    suggestedName: string;
    category: string;
    colors: string[];
    confidence: number;
  }>;
  originalImageUrl: string;
  processingTimeMs: number;
  _demo?: boolean;
}

interface ProcessMultiRequestBody {
  originalBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  selectedProducts: Array<{
    tempId: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    customName?: string;
    detected: {
      tempId: string;
      boundingBox: { x: number; y: number; width: number; height: number };
      suggestedName: string;
      category: string;
      colors: string[];
      confidence: number;
    };
  }>;
  productType: 'fashion' | 'home';
  /** URL of the original full image (for re-crop feature) */
  originalImageUrl?: string;
}

interface ReCropRequestBody {
  /** URL of the original (uncropped) image */
  originalImageUrl: string;
  /** Product ID to update */
  productId: string;
  /** Original bounding box (AI-generated) */
  originalBoundingBox: { x: number; y: number; width: number; height: number };
  /** New bounding box (user-adjusted) */
  newBoundingBox: { x: number; y: number; width: number; height: number };
  /** Product type for context */
  productType: 'fashion' | 'home';
  /** Optional: re-run enrichment on new crop */
  reEnrich?: boolean;
  /** Device ID for feedback tracking */
  deviceId?: string;
}

interface UpdateProductRequestBody {
  /** Product ID to update */
  productId: string;
  /** Field updates */
  updates: {
    product_name?: string;
    brand?: string;
    tags?: string[];
    category?: string;
    price?: number;
    currency?: string;
    material?: string;
    texture?: string;
    tone?: string;
  };
  /** Previous product name (to detect significant change) */
  previousName?: string;
  /** Current image URL (to compare if new image is better) */
  currentImageUrl?: string;
  /** Force image search even if name didn't change much */
  forceImageSearch?: boolean;
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
        .from('enriched_products')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from('enriched_products') as any)
      .update({ cutout_url: cutoutUrl })
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
// MULTI-PRODUCT DETECTION HANDLER
// ============================================================================

async function handleMultiProductDetection(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as DetectMultiRequestBody;

    // Validate request
    if (!body.image?.base64 || !body.image?.mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Image data and mimeType are required',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.context || !['fashion', 'home'].includes(body.context)) {
      return res.status(400).json({
        success: false,
        error: 'Context must be "fashion" or "home"',
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
      context: body.context,
      base64Length: body.image.base64.length,
    }, 'Starting multi-product detection');

    const input: MultiProductDetectionInput = {
      base64: body.image.base64,
      mimeType: body.image.mimeType,
      context: body.context,
    };

    const result = await detectMultipleProducts(input);

    logger.info({
      detectedCount: result.detectedProducts.length,
      processingMs: result.processingTimeMs,
      demo: result._demo,
    }, 'Multi-product detection complete');

    return res.status(200).json(result);

  } catch (error) {
    logger.error({ error }, 'Multi-product detection failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
      code: 'DETECTION_FAILED',
    });
  }
}

// ============================================================================
// SMART DETECTION HANDLER (Auto-detect mode)
// ============================================================================

// Confidence thresholds for mode decision
const CONFIDENT_SINGLE_THRESHOLD = 0.9;

function determineRecommendedMode(
  products: Array<{ confidence: number }>
): RecommendedMode {
  const count = products.length;

  if (count === 0) {
    // No products detected - fall back to single product mode (treat whole image as product)
    return 'single';
  }

  if (count === 1) {
    // Single product - check confidence
    const confidence = products[0].confidence;
    if (confidence >= CONFIDENT_SINGLE_THRESHOLD) {
      return 'single';
    }
    // Low confidence single - ask user if they want to look for more
    return 'uncertain';
  }

  // Multiple products detected - use multi mode
  return 'multi';
}

async function handleSmartDetect(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as SmartDetectRequestBody;

    // Validate request
    if (!body.image?.base64 || !body.image?.mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Image data and mimeType are required',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.context || !['fashion', 'home'].includes(body.context)) {
      return res.status(400).json({
        success: false,
        error: 'Context must be "fashion" or "home"',
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
      context: body.context,
      base64Length: body.image.base64.length,
    }, 'Starting smart detection');

    // Always run multi-product detection first
    const detectionResult = await detectMultipleProducts({
      base64: body.image.base64,
      mimeType: body.image.mimeType,
      context: body.context,
    });

    // Determine recommended mode based on results
    const recommendedMode = determineRecommendedMode(detectionResult.detectedProducts);

    logger.info({
      detectedCount: detectionResult.detectedProducts.length,
      recommendedMode,
      processingMs: detectionResult.processingTimeMs,
      demo: detectionResult._demo,
    }, 'Smart detection complete');

    const response: SmartDetectResponse = {
      success: true,
      recommendedMode,
      detectedProducts: detectionResult.detectedProducts,
      originalImageUrl: detectionResult.originalImageUrl,
      processingTimeMs: detectionResult.processingTimeMs,
      _demo: detectionResult._demo,
    };

    return res.status(200).json(response);

  } catch (error) {
    logger.error({ error }, 'Smart detection failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
      code: 'DETECTION_FAILED',
    });
  }
}

// ============================================================================
// MULTI-PRODUCT PROCESSING HANDLER
// ============================================================================

async function handleProcessMultipleProducts(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ProcessMultiRequestBody;

    // Validate request
    if (!body.originalBase64 || !body.mimeType) {
      return res.status(400).json({
        success: false,
        error: 'Original image base64 and mimeType are required',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.selectedProducts || body.selectedProducts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product must be selected',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.productType || !['fashion', 'home'].includes(body.productType)) {
      return res.status(400).json({
        success: false,
        error: 'productType must be "fashion" or "home"',
        code: 'INVALID_FORMAT',
      });
    }

    logger.info({
      mimeType: body.mimeType,
      productType: body.productType,
      selectedCount: body.selectedProducts.length,
    }, 'Starting multi-product processing');

    const input: ProcessMultipleInput = {
      originalBase64: body.originalBase64,
      mimeType: body.mimeType,
      selectedProducts: body.selectedProducts as SelectedProduct[],
      productType: body.productType,
      originalImageUrl: body.originalImageUrl,
    };

    const result = await processSelectedProducts(input);

    logger.info({
      processedCount: result.products.length,
      totalMs: result.totalProcessingMs,
      demo: result._demo,
    }, 'Multi-product processing complete');

    return res.status(200).json(result);

  } catch (error) {
    logger.error({ error }, 'Multi-product processing failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
      code: 'PROCESSING_FAILED',
    });
  }
}

// ============================================================================
// RE-CROP HANDLER (for bounding box corrections)
// ============================================================================

async function handleReCrop(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ReCropRequestBody;

    // Validate request
    if (!body.originalImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'originalImageUrl is required',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required',
        code: 'INVALID_FORMAT',
      });
    }

    if (!body.newBoundingBox) {
      return res.status(400).json({
        success: false,
        error: 'newBoundingBox is required',
        code: 'INVALID_FORMAT',
      });
    }

    // SECURITY: Validate URL is from trusted domains (SSRF prevention)
    const trustedDomains = [
      'supabase.co',
      'supabase.in',
      'tml-uploads',
      'backend-tml.vercel.app',
    ];

    try {
      const urlObj = new URL(body.originalImageUrl);
      const isTrusted = trustedDomains.some(domain =>
        urlObj.hostname.endsWith(domain) || urlObj.hostname.includes(domain)
      );
      if (!isTrusted) {
        logger.warn({ url: body.originalImageUrl, hostname: urlObj.hostname }, 'Rejected untrusted image URL');
        return res.status(400).json({
          success: false,
          error: 'Image URL must be from a trusted source',
          code: 'UNTRUSTED_URL',
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid image URL format',
        code: 'INVALID_URL',
      });
    }

    logger.info({
      productId: body.productId,
      originalBox: body.originalBoundingBox,
      newBox: body.newBoundingBox,
      reEnrich: body.reEnrich,
    }, 'Starting re-crop');

    const supabase = getSupabase();
    const startTime = Date.now();

    // Step 1: Fetch the original image (URL already validated above)
    const imageResponse = await fetch(body.originalImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch original image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Step 2: Crop with new bounding box using Sharp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharp = (await import('sharp')).default as any;
    const imgBuffer = Buffer.from(base64, 'base64');
    const metadata = await sharp(imgBuffer).metadata();
    const imgWidth = metadata.width || 1000;
    const imgHeight = metadata.height || 1000;

    // Calculate pixel coordinates from normalized values
    const left = Math.max(0, Math.floor(body.newBoundingBox.x * imgWidth));
    const top = Math.max(0, Math.floor(body.newBoundingBox.y * imgHeight));
    const width = Math.min(
      Math.floor(body.newBoundingBox.width * imgWidth),
      imgWidth - left
    );
    const height = Math.min(
      Math.floor(body.newBoundingBox.height * imgHeight),
      imgHeight - top
    );

    // Ensure minimum dimensions
    const cropWidth = Math.max(width, 50);
    const cropHeight = Math.max(height, 50);

    logger.debug({
      original: { width: imgWidth, height: imgHeight },
      crop: { left, top, width: cropWidth, height: cropHeight },
    }, 'Cropping with adjusted bounding box');

    // Crop the region
    const croppedBuffer = await sharp(imgBuffer)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toBuffer();

    // Step 3: Upload the new cropped image
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `cropped/${body.productId}-adjusted-${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, croppedBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload cropped image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(uploadData.path);

    const newCroppedUrl = urlData.publicUrl;

    // Step 4: Calculate feedback deltas
    const positionDelta = body.originalBoundingBox ? {
      x: body.newBoundingBox.x - body.originalBoundingBox.x,
      y: body.newBoundingBox.y - body.originalBoundingBox.y,
    } : null;

    const sizeDelta = body.originalBoundingBox ? {
      width: body.newBoundingBox.width - body.originalBoundingBox.width,
      height: body.newBoundingBox.height - body.originalBoundingBox.height,
    } : null;

    const boxMoved = positionDelta
      ? Math.abs(positionDelta.x) > 0.02 || Math.abs(positionDelta.y) > 0.02
      : false;
    const boxResized = sizeDelta
      ? Math.abs(sizeDelta.width) > 0.02 || Math.abs(sizeDelta.height) > 0.02
      : false;

    // Step 5: Store detection feedback
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('detection_feedback') as any).insert({
        product_id: body.productId,
        original_image_url: body.originalImageUrl,
        original_image_width: imgWidth,
        original_image_height: imgHeight,
        context: body.productType,
        ai_bounding_box: body.originalBoundingBox || body.newBoundingBox,
        user_bounding_box: body.newBoundingBox,
        position_delta: positionDelta,
        size_delta: sizeDelta,
        box_moved: boxMoved,
        box_resized: boxResized,
        was_product_saved: true,
        user_cropped_url: newCroppedUrl,
        device_id: body.deviceId,
      });
      logger.info({ productId: body.productId }, 'Detection feedback stored');
    } catch (feedbackError) {
      // Non-fatal - log but continue
      logger.warn({ error: feedbackError }, 'Failed to store detection feedback');
    }

    const processingTime = Date.now() - startTime;

    logger.info({
      productId: body.productId,
      newCroppedUrl,
      processingMs: processingTime,
      boxMoved,
      boxResized,
    }, 'Re-crop complete');

    return res.status(200).json({
      success: true,
      productId: body.productId,
      newCroppedUrl,
      boundingBox: body.newBoundingBox,
      processingTimeMs: processingTime,
      feedback: {
        boxMoved,
        boxResized,
        positionDelta,
        sizeDelta,
      },
    });

  } catch (error) {
    logger.error({ error }, 'Re-crop failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
      code: 'RECROP_FAILED',
    });
  }
}

/**
 * Handle product update with optional image search
 * When user edits product name/brand, search for a better image
 */
async function handleUpdateProduct(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as UpdateProductRequestBody;
  const startTime = Date.now();

  // Validate request
  if (!body.productId) {
    return res.status(400).json({
      success: false,
      error: 'productId is required',
      code: 'INVALID_FORMAT',
    });
  }

  if (!body.updates || Object.keys(body.updates).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'updates object is required with at least one field',
      code: 'INVALID_FORMAT',
    });
  }

  const supabase = getSupabase();

  try {
    logger.info({
      productId: body.productId,
      updates: Object.keys(body.updates),
      previousName: body.previousName,
      forceImageSearch: body.forceImageSearch,
    }, 'Processing product update');

    // Determine if name changed significantly (for image search trigger)
    const nameChanged = body.previousName &&
      body.updates.product_name &&
      body.previousName.toLowerCase().trim() !== body.updates.product_name.toLowerCase().trim();

    const shouldSearch = body.forceImageSearch || (
      nameChanged &&
      // Only search if new name looks like a specific product (has brand or model)
      body.updates.product_name &&
      (body.updates.product_name.split(' ').length >= 2 || body.updates.brand)
    );

    let imageSearchResult: { found: boolean; imageUrl?: string; source?: string; matchedProductId?: string; enrichedData?: Record<string, unknown> } = { found: false };
    let enrichedUpdates: Record<string, unknown> = { ...body.updates };

    // Step 1: Search for better image if warranted
    if (shouldSearch) {
      logger.info({ newName: body.updates.product_name }, 'Searching for product image');

      const searchInfo: DetectedProductInfo = {
        name: body.updates.product_name || '',
        brand: body.updates.brand,
        category: body.updates.category || 'general',
        tags: body.updates.tags || [],
        colors: [],
        confidence: 0.9, // User-edited names are high confidence
      };

      // Check if this product should be searched
      if (shouldSearchForImage(searchInfo)) {
        const result = await findBestProductImage(searchInfo, {
          enableDatabaseSearch: true,
          enableWebSearch: true,
          databaseMinSimilarity: 0.7, // Higher threshold for name-based search
        });

        if (result.found && result.imageUrl) {
          imageSearchResult = {
            found: true,
            imageUrl: result.imageUrl,
            source: result.source,
            matchedProductId: result.matchedProductId,
          };

          // If we matched a database product, use its enriched data too
          if (result.source === 'database' && result.matchedProductId) {
            try {
              const { data: matchedProduct } = await supabase
                .from('enriched_products')
                .select('tags, category, material, texture, tone, color_palette')
                .eq('id', result.matchedProductId)
                .single() as { data: { tags?: string[]; category?: string; material?: string; texture?: string; tone?: string; color_palette?: string[] } | null };

              if (matchedProduct) {
                // Only use enriched data that the user hasn't explicitly set
                imageSearchResult.enrichedData = matchedProduct;
                if (!body.updates.tags && matchedProduct.tags) {
                  enrichedUpdates.tags = matchedProduct.tags;
                }
                if (!body.updates.category && matchedProduct.category) {
                  enrichedUpdates.category = matchedProduct.category;
                }
                // Add material, texture, tone if available
                if (matchedProduct.material) enrichedUpdates.material = matchedProduct.material;
                if (matchedProduct.texture) enrichedUpdates.texture = matchedProduct.texture;
                if (matchedProduct.tone) enrichedUpdates.tone = matchedProduct.tone;
              }
            } catch (err) {
              logger.warn({ error: err }, 'Failed to fetch matched product enrichment');
            }
          }

          // Add new image URL to updates
          enrichedUpdates.image_url = result.imageUrl;
          enrichedUpdates.image_source = result.source;
          if (result.matchedProductId) {
            enrichedUpdates.matched_product_id = result.matchedProductId;
          }
        }
      }
    }

    // Step 2: Sync to database (upsert enriched_products)
    let syncedToDatabase = false;
    try {
      // Prepare the database record
      const dbRecord: Record<string, unknown> = {
        id: body.productId,
        product_name: enrichedUpdates.product_name,
        brand: enrichedUpdates.brand || 'My Upload',
        updated_at: new Date().toISOString(),
      };

      // Add optional fields if present
      if (enrichedUpdates.image_url) dbRecord.image_url = enrichedUpdates.image_url;
      if (enrichedUpdates.tags) dbRecord.tags = enrichedUpdates.tags;
      if (enrichedUpdates.category) dbRecord.category = enrichedUpdates.category;
      if (enrichedUpdates.price !== undefined) dbRecord.price = enrichedUpdates.price;
      if (enrichedUpdates.currency) dbRecord.currency = enrichedUpdates.currency;
      if (enrichedUpdates.material) dbRecord.material = enrichedUpdates.material;
      if (enrichedUpdates.texture) dbRecord.texture = enrichedUpdates.texture;
      if (enrichedUpdates.tone) dbRecord.tone = enrichedUpdates.tone;
      if (enrichedUpdates.image_source) dbRecord.image_source = enrichedUpdates.image_source;
      if (enrichedUpdates.matched_product_id) dbRecord.matched_product_id = enrichedUpdates.matched_product_id;

      // Upsert to database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await supabase
        .from('enriched_products')
        .upsert(dbRecord as any, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        logger.warn({ error: upsertError }, 'Failed to sync product to database');
      } else {
        syncedToDatabase = true;
        logger.info({ productId: body.productId }, 'Product synced to database');
      }
    } catch (dbError) {
      logger.warn({ error: dbError }, 'Database sync failed');
    }

    const processingTime = Date.now() - startTime;

    logger.info({
      productId: body.productId,
      imageFound: imageSearchResult.found,
      imageSource: imageSearchResult.source,
      syncedToDatabase,
      processingMs: processingTime,
    }, 'Product update complete');

    return res.status(200).json({
      success: true,
      productId: body.productId,
      updates: enrichedUpdates,
      imageSearch: {
        performed: shouldSearch,
        found: imageSearchResult.found,
        source: imageSearchResult.source || 'unchanged',
        newImageUrl: imageSearchResult.imageUrl,
        matchedProductId: imageSearchResult.matchedProductId,
        enrichedFromMatch: !!imageSearchResult.enrichedData,
      },
      syncedToDatabase,
      processingTimeMs: processingTime,
    });

  } catch (error) {
    logger.error({ error }, 'Product update failed');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
      code: 'UPDATE_FAILED',
    });
  }
}

// ============================================================================
// BATCH CUTOUT PRE-PROCESSING HANDLER
// ============================================================================

interface BatchCutoutRequest {
  product_ids?: string[];  // Specific product IDs to process
  limit?: number;          // Max products to process (default 10)
  force?: boolean;         // Reprocess even if cutout_url exists
}

interface ProductForCutout {
  id: string;
  product_name: string;
  image_url: string;
  cutout_url: string | null;
}

/**
 * Batch pre-process cutouts for products
 * Can be called by admin or scheduled job to pre-warm the cache
 */
async function handleBatchCutouts(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PROCESSING_ENABLED) {
    return res.status(503).json({
      error: 'Background removal is currently disabled',
      status: 'infrastructure_ready',
    });
  }

  try {
    const { product_ids, limit = 10, force = false } = req.body as BatchCutoutRequest;
    const supabase = getSupabase();

    // Get products to process
    let query = supabase
      .from('enriched_products')
      .select('id, product_name, image_url, cutout_url')
      .not('image_url', 'is', null);

    if (product_ids && product_ids.length > 0) {
      query = query.in('id', product_ids);
    } else if (!force) {
      // Only get products without cutouts
      query = query.is('cutout_url', null);
    }

    query = query.limit(Math.min(limit, 50)); // Cap at 50 per request

    const { data, error: fetchError } = await query;
    const products = data as ProductForCutout[] | null;

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No products need processing',
        processed: 0,
        total: 0,
      });
    }

    logger.info({ count: products.length, force }, 'Starting batch cutout processing');

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    const openai = getOpenAI();

    // Process each product
    for (const product of products) {
      // Skip if already has cutout and not forcing
      if (product.cutout_url && !force) {
        results.push({ id: product.id, success: true });
        continue;
      }

      try {
        // Fetch the image
        const imageRes = await fetch(product.image_url);
        if (!imageRes.ok) {
          throw new Error(`Failed to fetch image: ${imageRes.status}`);
        }
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

        const fileName = `${product.id}.png`;
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

        // Update product record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('enriched_products') as any)
          .update({ cutout_url: cutoutUrl })
          .eq('id', product.id);

        results.push({ id: product.id, success: true });
        logger.info({ productId: product.id, productName: product.product_name }, 'Cutout processed successfully');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ id: product.id, success: false, error: errorMessage });
        logger.error({ productId: product.id, error: errorMessage }, 'Failed to process cutout');
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info({ success: successCount, failed: failureCount }, 'Batch cutout processing complete');

    return res.status(200).json({
      success: true,
      processed: successCount,
      failed: failureCount,
      total: products.length,
      results,
    });

  } catch (error) {
    logger.error({ error }, 'Batch cutout processing error');
    return res.status(500).json({
      error: 'Failed to process batch cutouts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = await applyMiddleware(req, res);
  if (handled) return;

  const action = req.query.action as string;

  switch (action) {
    case 'remove-bg':
      return handleRemoveBackground(req, res);

    case 'batch-cutouts':
      return handleBatchCutouts(req, res);

    case 'upload':
      return handlePhotoUpload(req, res);

    case 'detect-multi':
      return handleMultiProductDetection(req, res);

    case 'smart-detect':
      return handleSmartDetect(req, res);

    case 'process-multi':
      return handleProcessMultipleProducts(req, res);

    case 're-crop':
      return handleReCrop(req, res);

    case 'update-product':
      return handleUpdateProduct(req, res);

    default:
      return res.status(400).json({
        error: 'Invalid action',
        hint: 'Use ?action=remove-bg, ?action=batch-cutouts, ?action=upload, etc.',
        examples: {
          'remove-bg': 'POST /api/image-processing?action=remove-bg',
          'batch-cutouts': 'POST /api/image-processing?action=batch-cutouts',
          'upload': 'POST /api/image-processing?action=upload',
          'detect-multi': 'POST /api/image-processing?action=detect-multi',
          'smart-detect': 'POST /api/image-processing?action=smart-detect',
          'process-multi': 'POST /api/image-processing?action=process-multi',
          're-crop': 'POST /api/image-processing?action=re-crop',
          'update-product': 'POST /api/image-processing?action=update-product',
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
