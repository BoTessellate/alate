/**
 * Multi-Product Detector
 * Uses Gemini Vision to detect multiple products in a single image
 */

import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseClient } from '../shared/supabaseClient';
import { createModuleLogger, logApiCall } from '../shared/logger';
import { z } from 'zod';
import { ConfigurationError, ExternalServiceError } from '../shared/errors';

const logger = createModuleLogger('multiProductDetector');

const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// Gemini model for vision tasks
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash-exp';

// ============================================================================
// TYPES
// ============================================================================

export interface BoundingBox {
  x: number;      // Top-left x (0-1)
  y: number;      // Top-left y (0-1)
  width: number;  // Width (0-1)
  height: number; // Height (0-1)
}

export interface DetectedProduct {
  /** Temporary ID for this detection session */
  tempId: string;
  /** Bounding box normalized coordinates (0-1) */
  boundingBox: BoundingBox;
  /** AI-suggested product name */
  suggestedName: string;
  /** AI-detected category */
  category: string;
  /** Main colors detected */
  colors: string[];
  /** Detection confidence (0-1) */
  confidence: number;
}

export interface MultiProductDetectionInput {
  /** Base64 encoded image */
  base64: string;
  /** MIME type */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Context: fashion or home */
  context: 'fashion' | 'home';
}

export interface MultiProductDetectionResponse {
  success: boolean;
  /** Original image URL (stored) */
  originalImageUrl: string;
  /** Array of detected products */
  detectedProducts: DetectedProduct[];
  /** Processing time in ms */
  processingTimeMs: number;
  /** Demo mode flag */
  _demo?: boolean;
}

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

const detectedProductSchema = z.object({
  name: z.string(),
  boundingBox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  category: z.string(),
  colors: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const detectionResponseSchema = z.object({
  products: z.array(detectedProductSchema).max(8),
});

type DetectionResponseType = z.infer<typeof detectionResponseSchema>;

// ============================================================================
// DETECTION PROMPT
// ============================================================================

function getDetectionPrompt(context: 'fashion' | 'home'): string {
  const contextDescription = context === 'fashion'
    ? 'This is a fashion/outfit image. Detect individual clothing items, shoes, and accessories.'
    : 'This is a home/interior image. Detect individual furniture, decor items, and lighting.';

  return `Analyze this image and detect all individual products that could be added to a shopping collection.

${contextDescription}

For each distinct product detected, return:
- name: descriptive product name (e.g., "Navy Blue Polo Shirt", "Mid-Century Modern Armchair")
- boundingBox: { x, y, width, height } as normalized 0-1 values (top-left origin)
- category: product category (e.g., "tops", "bottoms", "shoes", "furniture", "lighting")
- colors: array of main colors visible in that product
- confidence: 0-1 confidence score

Return JSON only in this exact format:
{
  "products": [
    {
      "name": "Navy Blue Polo Shirt",
      "boundingBox": { "x": 0.1, "y": 0.05, "width": 0.8, "height": 0.4 },
      "category": "tops",
      "colors": ["navy blue", "white"],
      "confidence": 0.95
    }
  ]
}

Rules:
- Only include clearly visible, distinct products
- For outfits: separate tops, bottoms, shoes, bags, jewelry, accessories
- For rooms: separate furniture, decor items, lighting, textiles
- Maximum 8 products per image
- Minimum 30% visibility to include a product
- Ensure bounding boxes don't exceed image bounds (all values 0-1)
- If no products are detected, return {"products": []}`;
}

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_DETECTIONS: Record<'fashion' | 'home', DetectedProduct[]> = {
  fashion: [
    {
      tempId: 'demo-1',
      boundingBox: { x: 0.15, y: 0.05, width: 0.7, height: 0.35 },
      suggestedName: 'White Cotton T-Shirt',
      category: 'tops',
      colors: ['white', 'gray'],
      confidence: 0.92,
    },
    {
      tempId: 'demo-2',
      boundingBox: { x: 0.1, y: 0.42, width: 0.75, height: 0.38 },
      suggestedName: 'Blue Denim Jeans',
      category: 'bottoms',
      colors: ['indigo', 'blue'],
      confidence: 0.88,
    },
    {
      tempId: 'demo-3',
      boundingBox: { x: 0.2, y: 0.82, width: 0.6, height: 0.16 },
      suggestedName: 'White Leather Sneakers',
      category: 'shoes',
      colors: ['white', 'off-white'],
      confidence: 0.85,
    },
  ],
  home: [
    {
      tempId: 'demo-1',
      boundingBox: { x: 0.1, y: 0.3, width: 0.5, height: 0.5 },
      suggestedName: 'Mid-Century Modern Armchair',
      category: 'furniture',
      colors: ['mustard yellow', 'walnut'],
      confidence: 0.94,
    },
    {
      tempId: 'demo-2',
      boundingBox: { x: 0.65, y: 0.15, width: 0.25, height: 0.4 },
      suggestedName: 'Brass Floor Lamp',
      category: 'lighting',
      colors: ['brass', 'cream'],
      confidence: 0.87,
    },
    {
      tempId: 'demo-3',
      boundingBox: { x: 0.55, y: 0.6, width: 0.35, height: 0.25 },
      suggestedName: 'Woven Throw Pillow',
      category: 'textiles',
      colors: ['terracotta', 'cream'],
      confidence: 0.82,
    },
  ],
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Detect multiple products in a single image using GPT-4o Vision
 */
export async function detectMultipleProducts(
  input: MultiProductDetectionInput
): Promise<MultiProductDetectionResponse> {
  const startTime = Date.now();

  logger.info({
    context: input.context,
    mimeType: input.mimeType,
    demoMode: DEMO_MODE,
  }, 'Starting multi-product detection');

  // Step 1: Upload original image to storage
  const originalImageUrl = await uploadOriginalImage(input);
  logger.info({ originalImageUrl }, 'Original image uploaded');

  // Step 2: Run detection (or return demo data)
  let detectedProducts: DetectedProduct[];

  if (DEMO_MODE) {
    // Demo mode - return mock data
    detectedProducts = DEMO_DETECTIONS[input.context].map(p => ({
      ...p,
      tempId: uuidv4(),
    }));
    logger.info({ count: detectedProducts.length }, 'Returning demo detections');
  } else {
    // Real detection with Gemini Vision
    detectedProducts = await runVisionDetection(input);
    logger.info({ count: detectedProducts.length }, 'Gemini vision detection complete');
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    success: true,
    originalImageUrl,
    detectedProducts,
    processingTimeMs,
    _demo: DEMO_MODE,
  };
}

/**
 * Upload the original image to Supabase storage
 */
async function uploadOriginalImage(input: MultiProductDetectionInput): Promise<string> {
  const supabase = getSupabaseClient();
  const imageId = uuidv4();
  const ext = input.mimeType.split('/')[1] || 'png';
  const fileName = `multi-detect/${imageId}.${ext}`;

  const buffer = Buffer.from(input.base64, 'base64');

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, {
      contentType: input.mimeType,
      upsert: true,
    });

  if (error) {
    logger.error({ error }, 'Failed to upload original image');
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Run Gemini Vision to detect products
 */
async function runVisionDetection(input: MultiProductDetectionInput): Promise<DetectedProduct[]> {
  const startTime = Date.now();
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new ConfigurationError('GEMINI_API_KEY is not configured');
  }

  const gemini = new GoogleGenerativeAI(geminiApiKey);
  const model = gemini.getGenerativeModel({ model: GEMINI_VISION_MODEL });

  const prompt = getDetectionPrompt(input.context);

  try {
    // Prepare image for Gemini
    const imagePart = {
      inlineData: {
        mimeType: input.mimeType,
        data: input.base64,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    logApiCall(logger, 'gemini', 'generateContent', startTime, true, {
      model: GEMINI_VISION_MODEL,
      context: input.context,
    });

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);
    const validated = detectionResponseSchema.parse(parsed);

    // Convert to our DetectedProduct format
    return validated.products.map(p => ({
      tempId: uuidv4(),
      boundingBox: p.boundingBox,
      suggestedName: p.name,
      category: p.category,
      colors: p.colors,
      confidence: p.confidence,
    }));
  } catch (error: any) {
    logApiCall(logger, 'gemini', 'generateContent', startTime, false, {
      error: error.message,
    });
    logger.error({ error }, 'Gemini vision detection failed');
    // Return empty array on failure - user can try single product mode
    return [];
  }
}
