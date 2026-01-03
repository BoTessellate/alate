/**
 * Photo Upload Processor
 * Orchestrates the upload -> background removal -> enrichment pipeline
 */

import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getSupabaseClient } from '../shared/supabaseClient';
import { createImageGenerator } from '../imageGeneration';
import { callClaude, parseJSONFromResponse } from '../shared/secureAI';
import { createModuleLogger } from '../shared/logger';
import {
  PhotoUploadInput,
  ProcessedProduct,
  PhotoUploadResponse,
  UploadConfig,
  DEFAULT_UPLOAD_CONFIG,
  DEMO_ENRICHMENTS,
} from './types';

const logger = createModuleLogger('photoUpload');

// Default to real processing (false). Set DEMO_MODE=true to return mock data
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Gemini model for vision tasks (fallback when Claude is unavailable)
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash-exp';

/**
 * Process an uploaded photo through the full pipeline
 */
export async function processPhotoUpload(
  input: PhotoUploadInput,
  config: UploadConfig = DEFAULT_UPLOAD_CONFIG
): Promise<PhotoUploadResponse> {
  const startTime = Date.now();
  const productId = uuidv4();
  const timings = {
    uploadMs: 0,
    backgroundRemovalMs: 0,
    enrichmentMs: 0,
    totalMs: 0,
  };

  logger.info({ productId, productType: input.productType, demoMode: DEMO_MODE }, 'Starting photo upload processing');

  // Validate input
  validateInput(input, config);

  // Step 1: Upload raw image to Supabase
  const uploadStart = Date.now();
  const originalImageUrl = await uploadRawImage(productId, input);
  timings.uploadMs = Date.now() - uploadStart;
  logger.info({ productId, uploadMs: timings.uploadMs }, 'Raw image uploaded');

  // Step 2: Background removal (or skip in demo mode)
  let processedImageUrl = originalImageUrl;
  const bgStart = Date.now();

  if (!config.skipBackgroundRemoval && !DEMO_MODE) {
    try {
      processedImageUrl = await removeBackground(productId, input);
      logger.info({ productId }, 'Background removed successfully');
    } catch (error) {
      logger.warn({ productId, error }, 'Background removal failed, using original image');
      processedImageUrl = originalImageUrl;
    }
  } else {
    logger.info({ productId, reason: DEMO_MODE ? 'demo_mode' : 'skipped' }, 'Skipping background removal');
  }
  timings.backgroundRemovalMs = Date.now() - bgStart;

  // Step 3: AI Enrichment
  const enrichStart = Date.now();
  const enrichment = await enrichProduct(productId, input, originalImageUrl, config);
  timings.enrichmentMs = Date.now() - enrichStart;
  logger.info({ productId, enrichMs: timings.enrichmentMs }, 'Product enriched');

  timings.totalMs = Date.now() - startTime;

  // Assemble final product
  const product: ProcessedProduct = {
    id: productId,
    original_image_url: originalImageUrl,
    image_url: processedImageUrl,
    product_name: enrichment.product_name,
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

  logger.info({ productId, totalMs: timings.totalMs }, 'Photo upload processing complete');

  return {
    success: true,
    product,
    processingTime: timings,
    _demo: DEMO_MODE,
  };
}

/**
 * Validate upload input
 */
function validateInput(input: PhotoUploadInput, config: UploadConfig): void {
  // Check MIME type
  const allowedTypes = config.allowedMimeTypes || DEFAULT_UPLOAD_CONFIG.allowedMimeTypes!;
  if (!allowedTypes.includes(input.mimeType)) {
    throw new Error(`Invalid file format. Allowed: ${allowedTypes.join(', ')}`);
  }

  // Check file size (base64 is ~33% larger than binary)
  const maxSize = config.maxFileSizeBytes || DEFAULT_UPLOAD_CONFIG.maxFileSizeBytes!;
  const estimatedSize = (input.base64.length * 3) / 4;
  if (estimatedSize > maxSize) {
    throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`);
  }

  // Basic validation of base64
  if (!input.base64 || input.base64.length < 100) {
    throw new Error('Invalid image data');
  }
}

/**
 * Upload raw image to Supabase storage
 */
async function uploadRawImage(productId: string, input: PhotoUploadInput): Promise<string> {
  const supabase = getSupabaseClient();

  // Determine file extension
  const ext = input.mimeType.split('/')[1] || 'png';
  const fileName = `${productId}.${ext}`;

  // Convert base64 to buffer
  const buffer = Buffer.from(input.base64, 'base64');

  // Upload to 'uploads' bucket
  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, {
      contentType: input.mimeType,
      upsert: true,
    });

  if (error) {
    logger.error({ productId, error }, 'Failed to upload raw image');
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Remove background using ImageGenerator SDK
 */
async function removeBackground(productId: string, input: PhotoUploadInput): Promise<string> {
  const imageGenerator = createImageGenerator();
  const supabase = getSupabaseClient();

  // Extract product (remove background)
  const result = await imageGenerator.extractProduct({
    base64: input.base64,
    mimeType: input.mimeType,
  });

  if (!result.imageBase64 && !result.imageUrl) {
    throw new Error('Background removal returned no image');
  }

  // If we got base64 back, upload to cutouts bucket
  if (result.imageBase64) {
    const fileName = `${productId}.png`;
    const buffer = Buffer.from(result.imageBase64, 'base64');

    const { data, error } = await supabase.storage
      .from('cutouts')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload cutout: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('cutouts')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // Otherwise return the URL directly
  return result.imageUrl!;
}

/**
 * Enrich product with AI-generated metadata
 * Tries Claude first, falls back to Gemini, then to basic defaults
 */
async function enrichProduct(
  productId: string,
  input: PhotoUploadInput,
  imageUrl: string,
  config: UploadConfig
): Promise<{
  product_name: string;
  tags: string[];
  color_palette: string[];
  category: string;
  material?: string;
  texture?: string;
  tone?: string;
}> {
  // Demo mode - return realistic mock data
  if (DEMO_MODE || config.skipEnrichment) {
    const typeData = input.productType === 'fashion'
      ? DEMO_ENRICHMENTS.fashion.clothing
      : DEMO_ENRICHMENTS.home.decor;

    return {
      product_name: typeData.product_name,
      tags: typeData.tags,
      color_palette: typeData.color_palette,
      category: typeData.category,
      material: typeData.material,
      texture: typeData.texture,
      tone: typeData.tone,
    };
  }

  const prompt = `You are analyzing a product image for a style/shopping app.

Product Type Context: ${input.productType === 'fashion' ? 'Clothing, shoes, or accessories' : 'Furniture, home decor, or interior items'}

Analyze the image and return a JSON object with:
{
  "product_name": "A descriptive name for this product (e.g., 'Bohemian Woven Throw Pillow', 'Classic Navy Polo Shirt')",
  "tags": ["3-5 style descriptors like 'bohemian', 'minimalist', 'vintage', 'modern', 'casual'"],
  "color_palette": ["2-5 colors visible in the product, e.g., 'navy blue', 'cream', 'terracotta'"],
  "category": "Product category (e.g., 'tops', 'dresses', 'furniture', 'lighting', 'textiles')",
  "material": "Primary material if visible (e.g., 'cotton', 'wood', 'ceramic', 'leather')",
  "texture": "Texture description (e.g., 'smooth', 'woven', 'knit', 'matte')",
  "tone": "Aesthetic mood (e.g., 'warm', 'cool', 'earthy', 'modern', 'rustic')"
}

Return ONLY valid JSON, no explanation.`;

  // Try Gemini first (best for vision tasks)
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      const gemini = new GoogleGenerativeAI(geminiApiKey);
      const model = gemini.getGenerativeModel({ model: GEMINI_VISION_MODEL });

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

      // Parse JSON from response (handle markdown code blocks)
      let jsonText = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonText);
      logger.info({ productId, provider: 'gemini' }, 'Enrichment successful');
      return {
        product_name: parsed.product_name || 'Uploaded Product',
        tags: parsed.tags || [],
        color_palette: parsed.color_palette || [],
        category: parsed.category || 'general',
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
        product_name: parsed.product_name || 'Uploaded Product',
        tags: parsed.tags || [],
        color_palette: parsed.color_palette || [],
        category: parsed.category || 'general',
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
          product_name: parsed.product_name || 'Uploaded Product',
          tags: parsed.tags || [],
          color_palette: parsed.color_palette || [],
          category: parsed.category || 'general',
          material: parsed.material,
          texture: parsed.texture,
          tone: parsed.tone,
        };
      }
    }
  } catch (error) {
    logger.warn({ productId, error }, 'Claude enrichment also failed, using defaults');
  }

  // Final fallback defaults
  return {
    product_name: 'Uploaded Product',
    tags: ['uploaded'],
    color_palette: ['neutral'],
    category: input.productType === 'fashion' ? 'clothing' : 'home decor',
  };
}

/**
 * Export types for use in API
 */
export type { PhotoUploadInput, ProcessedProduct, PhotoUploadResponse, UploadConfig };
