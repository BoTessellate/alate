/**
 * Multi-Product Processor
 * Crops, removes background, and enriches each selected product from detection
 */

import { v4 as uuidv4 } from 'uuid';
// Sharp is dynamically imported to avoid Vercel serverless function issues
// with native bindings at module load time
import { getSupabaseClient } from '../shared/supabaseClient';
import { createImageGenerator } from '../imageGeneration';
import { callClaude, parseJSONFromResponse } from '../shared/secureAI';
import { createModuleLogger } from '../shared/logger';
import { ProcessedProduct, DEMO_ENRICHMENTS } from './types';
import { BoundingBox, DetectedProduct } from './multiProductDetector';

const logger = createModuleLogger('multiProductProcessor');

// Default to real processing (false). Set DEMO_MODE=true to return mock data
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectedProduct {
  /** Temp ID from detection */
  tempId: string;
  /** Bounding box for cropping */
  boundingBox: BoundingBox;
  /** User-edited name (optional) */
  customName?: string;
  /** Original detected data */
  detected: DetectedProduct;
}

export interface ProcessMultipleInput {
  /** Original image base64 */
  originalBase64: string;
  /** MIME type */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Selected products to process */
  selectedProducts: SelectedProduct[];
  /** Product type context */
  productType: 'fashion' | 'home';
}

export interface ProcessingResult {
  tempId: string;
  product: ProcessedProduct;
  timing: {
    cropMs: number;
    backgroundRemovalMs: number;
    enrichmentMs: number;
    totalMs: number;
  };
}

export interface ProcessMultipleResponse {
  success: boolean;
  /** Processed products */
  products: ProcessedProduct[];
  /** Processing times per product */
  processingResults: ProcessingResult[];
  /** Total processing time */
  totalProcessingMs: number;
  /** Demo mode flag */
  _demo?: boolean;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Process selected products from multi-detection
 * For each: crop -> background removal -> enrichment
 */
export async function processSelectedProducts(
  input: ProcessMultipleInput
): Promise<ProcessMultipleResponse> {
  const overallStart = Date.now();

  logger.info({
    productCount: input.selectedProducts.length,
    productType: input.productType,
    demoMode: DEMO_MODE,
  }, 'Starting multi-product processing');

  const results: ProcessingResult[] = [];

  // Process each selected product
  for (const selected of input.selectedProducts) {
    const productStart = Date.now();
    const productId = uuidv4();

    logger.info({ tempId: selected.tempId, productId }, 'Processing product');

    const timing = {
      cropMs: 0,
      backgroundRemovalMs: 0,
      enrichmentMs: 0,
      totalMs: 0,
    };

    try {
      // Step 1: Crop the image region
      const cropStart = Date.now();
      const croppedBase64 = await cropImageRegion(
        input.originalBase64,
        input.mimeType,
        selected.boundingBox
      );
      timing.cropMs = Date.now() - cropStart;
      logger.info({ tempId: selected.tempId, cropMs: timing.cropMs }, 'Cropped image region');

      // Step 2: Upload cropped image
      const croppedUrl = await uploadCroppedImage(productId, croppedBase64, input.mimeType);

      // Step 3: Background removal
      const bgStart = Date.now();
      let processedUrl = croppedUrl;

      if (!DEMO_MODE) {
        try {
          processedUrl = await removeBackground(productId, croppedBase64, input.mimeType);
          logger.info({ tempId: selected.tempId }, 'Background removed');
        } catch (error) {
          logger.warn({ tempId: selected.tempId, error }, 'Background removal failed, using cropped image');
        }
      }
      timing.backgroundRemovalMs = Date.now() - bgStart;

      // Step 4: Enrichment
      const enrichStart = Date.now();
      const enrichment = await enrichProduct(
        productId,
        selected,
        croppedUrl,
        input.productType
      );
      timing.enrichmentMs = Date.now() - enrichStart;

      timing.totalMs = Date.now() - productStart;

      // Assemble product
      const product: ProcessedProduct = {
        id: productId,
        original_image_url: croppedUrl,
        image_url: processedUrl,
        product_name: selected.customName || enrichment.product_name,
        brand: 'My Upload',
        price: 0,
        currency: 'USD',
        tags: enrichment.tags,
        color_palette: enrichment.color_palette,
        category: enrichment.category,
        material: enrichment.material,
        texture: enrichment.texture,
        tone: enrichment.tone,
        source: 'upload',
        uploaded_at: new Date().toISOString(),
      };

      results.push({
        tempId: selected.tempId,
        product,
        timing,
      });

      logger.info({ tempId: selected.tempId, productId, totalMs: timing.totalMs }, 'Product processed');

    } catch (error) {
      logger.error({ tempId: selected.tempId, error }, 'Failed to process product');
      // Continue with other products even if one fails
    }
  }

  const totalProcessingMs = Date.now() - overallStart;

  logger.info({
    processedCount: results.length,
    totalMs: totalProcessingMs,
  }, 'Multi-product processing complete');

  return {
    success: results.length > 0,
    products: results.map(r => r.product),
    processingResults: results,
    totalProcessingMs,
    _demo: DEMO_MODE,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Crop an image region based on bounding box
 */
async function cropImageRegion(
  base64: string,
  mimeType: string,
  boundingBox: BoundingBox
): Promise<string> {
  // Dynamic import sharp to avoid Vercel serverless issues with native bindings
  const sharp = (await import('sharp')).default;

  const buffer = Buffer.from(base64, 'base64');

  // Get image dimensions
  const metadata = await sharp(buffer).metadata();
  const imgWidth = metadata.width || 1000;
  const imgHeight = metadata.height || 1000;

  // Calculate pixel coordinates from normalized values
  const left = Math.max(0, Math.floor(boundingBox.x * imgWidth));
  const top = Math.max(0, Math.floor(boundingBox.y * imgHeight));
  const width = Math.min(
    Math.floor(boundingBox.width * imgWidth),
    imgWidth - left
  );
  const height = Math.min(
    Math.floor(boundingBox.height * imgHeight),
    imgHeight - top
  );

  // Ensure minimum dimensions
  const cropWidth = Math.max(width, 50);
  const cropHeight = Math.max(height, 50);

  logger.debug({
    original: { width: imgWidth, height: imgHeight },
    crop: { left, top, width: cropWidth, height: cropHeight },
    boundingBox,
  }, 'Cropping image');

  // Crop the region
  const croppedBuffer = await sharp(buffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer();

  return croppedBuffer.toString('base64');
}

/**
 * Upload cropped image to storage
 */
async function uploadCroppedImage(
  productId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const supabase = getSupabaseClient();
  const ext = mimeType.split('/')[1] || 'png';
  const fileName = `cropped/${productId}.${ext}`;

  const buffer = Buffer.from(base64, 'base64');

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload cropped image: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Remove background from cropped image
 */
async function removeBackground(
  productId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const imageGenerator = createImageGenerator();
  const supabase = getSupabaseClient();

  const result = await imageGenerator.extractProduct({
    base64,
    mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
  });

  if (!result.imageBase64 && !result.imageUrl) {
    throw new Error('Background removal returned no image');
  }

  if (result.imageBase64) {
    const fileName = `cutouts/${productId}.png`;
    const buffer = Buffer.from(result.imageBase64, 'base64');

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload cutout: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  return result.imageUrl!;
}

/**
 * Enrich product with AI metadata
 */
async function enrichProduct(
  productId: string,
  selected: SelectedProduct,
  imageUrl: string,
  productType: 'fashion' | 'home'
): Promise<{
  product_name: string;
  tags: string[];
  color_palette: string[];
  category: string;
  material?: string;
  texture?: string;
  tone?: string;
}> {
  // Use detected data as starting point
  const { detected } = selected;

  // Demo mode - enhance with demo enrichments
  if (DEMO_MODE) {
    const baseData = productType === 'fashion'
      ? DEMO_ENRICHMENTS.fashion.clothing
      : DEMO_ENRICHMENTS.home.decor;

    return {
      product_name: selected.customName || detected.suggestedName,
      tags: [...detected.colors.slice(0, 2), ...baseData.tags.slice(0, 3)],
      color_palette: detected.colors.length > 0 ? detected.colors : baseData.color_palette,
      category: detected.category,
      material: baseData.material,
      texture: baseData.texture,
      tone: baseData.tone,
    };
  }

  // Real AI enrichment - try Gemini first (best for vision), then Claude
  const prompt = `You are analyzing a cropped product image for a style/shopping app.

This product was detected as: "${detected.suggestedName}"
Category: ${detected.category}
Visible colors: ${detected.colors.join(', ')}
Product Type Context: ${productType === 'fashion' ? 'Clothing, shoes, or accessories' : 'Furniture, home decor, or interior items'}

Analyze the image and return a JSON object with refined metadata:
{
  "product_name": "Refined descriptive name",
  "tags": ["3-5 style descriptors"],
  "color_palette": ["2-5 colors visible"],
  "category": "Product category",
  "material": "Primary material",
  "texture": "Texture description",
  "tone": "Aesthetic mood"
}

Return ONLY valid JSON, no explanation.`;

  // Try Gemini first (best for vision tasks)
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      const gemini = new GoogleGenerativeAI(geminiApiKey);
      const model = gemini.getGenerativeModel({ model: process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash-exp' });

      // Fetch image and convert to base64 for Gemini vision
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      let jsonText = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonText);
      logger.info({ productId, provider: 'gemini' }, 'Enrichment successful');
      return {
        product_name: selected.customName || parsed.product_name || detected.suggestedName,
        tags: parsed.tags || detected.colors,
        color_palette: parsed.color_palette || detected.colors,
        category: parsed.category || detected.category,
        material: parsed.material,
        texture: parsed.texture,
        tone: parsed.tone,
      };
    }
    logger.warn({ productId }, 'GEMINI_API_KEY not configured, trying GPT-4o');
  } catch (error) {
    logger.warn({ productId, error }, 'Gemini enrichment failed, trying GPT-4o fallback');
  }

  // Fallback to GPT-4o (also good for vision)
  try {
    const OpenAI = (await import('openai')).default;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });

      // Fetch image and convert to base64 for GPT-4o vision
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });

      const text = response.choices[0]?.message?.content || '';

      // Parse JSON from response
      let jsonText = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonText);
      logger.info({ productId, provider: 'gpt-4o' }, 'Enrichment successful');
      return {
        product_name: selected.customName || parsed.product_name || detected.suggestedName,
        tags: parsed.tags || detected.colors,
        color_palette: parsed.color_palette || detected.colors,
        category: parsed.category || detected.category,
        material: parsed.material,
        texture: parsed.texture,
        tone: parsed.tone,
      };
    }
    logger.warn({ productId }, 'OPENAI_API_KEY not configured, trying Claude');
  } catch (error) {
    logger.warn({ productId, error }, 'GPT-4o enrichment failed, trying Claude fallback');
  }

  // Last resort: Claude (text-only, no vision)
  try {
    const response = await callClaude(`${prompt}\n\nImage URL: ${imageUrl}`, { maxTokens: 500 });

    if (response.success && response.text) {
      const parsed = parseJSONFromResponse(response.text);
      if (parsed) {
        logger.info({ productId, provider: 'claude' }, 'Enrichment successful');
        return {
          product_name: selected.customName || parsed.product_name || detected.suggestedName,
          tags: parsed.tags || detected.colors,
          color_palette: parsed.color_palette || detected.colors,
          category: parsed.category || detected.category,
          material: parsed.material,
          texture: parsed.texture,
          tone: parsed.tone,
        };
      }
    }
  } catch (error) {
    logger.warn({ productId, error }, 'Claude enrichment also failed, using detected data');
  }

  // Final fallback to detected data
  return {
    product_name: selected.customName || detected.suggestedName,
    tags: detected.colors,
    color_palette: detected.colors,
    category: detected.category,
  };
}
