/**
 * Multi-Product Detector
 * Uses Gemini Vision to detect multiple products in a single image
 */

import { randomUUID } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseClient } from '../shared/supabaseClient';
import { createModuleLogger, logApiCall } from '../shared/logger';
import { z } from 'zod';
import { ConfigurationError, ExternalServiceError } from '../shared/errors';

const logger = createModuleLogger('multiProductDetector');

// Default to real processing (false). Set DEMO_MODE=true to return mock data
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Gemini model for vision tasks (gemini-2.0-flash-exp was deprecated, use gemini-2.0-flash)
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';

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
// VALID CATEGORIES (for post-detection filtering)
// ============================================================================

const VALID_FASHION_CATEGORIES = [
  'tops', 'shirts', 'blouses', 't-shirts', 'sweaters', 'hoodies',
  'bottoms', 'pants', 'jeans', 'shorts', 'skirts', 'trousers',
  'dresses', 'jumpsuits', 'rompers',
  'outerwear', 'jackets', 'coats', 'blazers', 'cardigans',
  'shoes', 'footwear', 'sneakers', 'boots', 'heels', 'sandals', 'slippers', 'loafers',
  'bags', 'handbags', 'backpacks', 'purses', 'clutches', 'totes',
  'accessories', 'jewelry', 'watches', 'belts', 'scarves', 'hats', 'sunglasses', 'ties',
  'headphones', 'earphones', 'headwear',
  'swimwear', 'activewear', 'loungewear', 'underwear', 'socks',
];

const VALID_HOME_CATEGORIES = [
  'furniture', 'sofas', 'chairs', 'tables', 'desks', 'beds', 'dressers', 'shelving',
  'lighting', 'lamps', 'pendants', 'chandeliers', 'sconces',
  'decor', 'vases', 'sculptures', 'artwork', 'mirrors', 'clocks', 'frames',
  'textiles', 'rugs', 'curtains', 'pillows', 'throws', 'blankets', 'bedding',
  'storage', 'baskets', 'bins', 'organizers',
  'plants', 'planters', 'pots',
  'kitchenware', 'dinnerware', 'glassware', 'serveware',
];

// Items that should NEVER be detected (background/architectural elements)
const EXCLUDED_ITEMS = [
  'ceiling', 'wall', 'floor', 'window', 'door', 'doorframe',
  'light fixture', 'ceiling light', 'recessed light', 'ceiling fan',
  'molding', 'baseboard', 'trim', 'outlet', 'switch', 'vent',
  'stairs', 'railing', 'banister', 'column', 'beam', 'pillar',
  'fireplace mantel', 'built-in', 'cabinet (built-in)', 'closet',
  'countertop', 'backsplash', 'sink', 'toilet', 'bathtub', 'shower',
  'radiator', 'thermostat', 'smoke detector', 'sprinkler',
  'person', 'human', 'body', 'face', 'hand', 'arm', 'leg',
];

// ============================================================================
// DETECTION PROMPT
// ============================================================================

function getDetectionPrompt(context: 'fashion' | 'home'): string {
  const contextDescription = context === 'fashion'
    ? `This is a fashion/outfit image. Detect ONLY wearable items: clothing, shoes, bags, jewelry, and accessories.

VALID CATEGORIES for fashion: tops, shirts, bottoms, pants, jeans, dresses, outerwear, jackets, shoes, sneakers, boots, sandals, slippers, bags, handbags, accessories, jewelry, watches, belts, scarves, hats, sunglasses, headphones.

TYPICAL LOCATIONS for fashion items (use these as guidance for bounding boxes):
- Headphones/hats/sunglasses: upper portion of image (y: 0.0-0.3)
- Tops/shirts/hoodies: upper-middle (y: 0.15-0.55)
- Bottoms/pants/skirts: lower-middle (y: 0.4-0.85)
- Shoes/footwear: bottom portion (y: 0.7-1.0)
- Bags: varies, typically side of body`
    : `This is a home/interior image. Detect ONLY movable/purchasable items: furniture, decor, lighting fixtures, and textiles.

VALID CATEGORIES for home: furniture, sofas, chairs, tables, beds, lighting, lamps, decor, vases, artwork, mirrors, textiles, rugs, curtains, pillows, throws, plants, planters.`;

  return `Analyze this image and detect individual PRODUCTS that could be purchased and added to a shopping collection.

${contextDescription}

CRITICAL - DO NOT DETECT these background/architectural elements:
- Ceilings, walls, floors, windows, doors
- Built-in fixtures (ceiling lights, recessed lighting, vents, outlets)
- Architectural features (molding, trim, columns, beams, stairs)
- Fixed installations (sinks, toilets, built-in cabinets, countertops)
- People or body parts

BOUNDING BOX ACCURACY IS CRITICAL:
- The bounding box MUST tightly encompass the actual product location in the image
- For fashion items on a person: the box should be where the item IS on the person's body
- Do NOT place bounding boxes on background areas like ceilings or walls
- Double-check that your bounding box coordinates actually point to where the product is visible

For each VALID product detected, return:
- name: descriptive product name (e.g., "Navy Blue Polo Shirt", "Leather Ankle Boots")
- boundingBox: { x, y, width, height } as normalized 0-1 values where (0,0) is top-left corner
  * x: horizontal position of left edge (0=left, 1=right)
  * y: vertical position of top edge (0=top, 1=bottom)
  * width: horizontal size (0-1)
  * height: vertical size (0-1)
- category: product category from the valid list above
- colors: array of main colors visible in that product
- confidence: 0-1 confidence score (only include if confidence >= 0.7)

Return JSON only in this exact format:
{
  "products": [
    {
      "name": "Pink Cropped Hoodie",
      "boundingBox": { "x": 0.15, "y": 0.25, "width": 0.7, "height": 0.35 },
      "category": "tops",
      "colors": ["pink", "dusty rose"],
      "confidence": 0.95
    }
  ]
}

Rules:
- ONLY detect purchasable/movable products, NOT room fixtures or architecture
- ${context === 'fashion' ? 'For outfits: separate each clothing item worn by the person - tops, bottoms, shoes, accessories' : 'For rooms: only furniture pieces and decor that can be purchased separately'}
- Maximum 8 products per image
- Minimum confidence 0.7 to include a product
- Minimum 30% visibility to include a product
- Ensure bounding boxes accurately locate the product (not background)
- Verify bounding box y-coordinates make sense: tops should be higher, shoes lower
- If no valid products are detected, return {"products": []}`;
}

/**
 * Validate detected category against allowed list
 */
function isValidCategory(category: string, context: 'fashion' | 'home'): boolean {
  const normalizedCategory = category.toLowerCase().trim();
  const validCategories = context === 'fashion' ? VALID_FASHION_CATEGORIES : VALID_HOME_CATEGORIES;

  // Check exact match or partial match
  return validCategories.some(valid =>
    normalizedCategory === valid ||
    normalizedCategory.includes(valid) ||
    valid.includes(normalizedCategory)
  );
}

/**
 * Check if item name suggests a background/architectural element
 */
function isExcludedItem(name: string): boolean {
  const normalizedName = name.toLowerCase().trim();
  return EXCLUDED_ITEMS.some(excluded =>
    normalizedName.includes(excluded) ||
    excluded.includes(normalizedName)
  );
}

/**
 * Validate bounding box location matches expected position for the category
 * Returns true if the location seems reasonable, false if suspicious
 */
function isBoundingBoxLocationValid(
  category: string,
  name: string,
  boundingBox: { x: number; y: number; width: number; height: number }
): boolean {
  const normalizedCategory = category.toLowerCase();
  const normalizedName = name.toLowerCase();

  // Calculate center point of bounding box
  const centerY = boundingBox.y + boundingBox.height / 2;

  // Headphones, hats, sunglasses should be in upper portion (y center < 0.4)
  const upperItems = ['headphones', 'hat', 'cap', 'beanie', 'sunglasses', 'glasses'];
  if (upperItems.some(item => normalizedName.includes(item) || normalizedCategory.includes(item))) {
    if (centerY > 0.5) {
      return false; // Headphones shouldn't be in lower half
    }
  }

  // Shoes, footwear should be in lower portion (y center > 0.6)
  const lowerItems = ['shoes', 'sneakers', 'boots', 'sandals', 'slippers', 'heels', 'loafers', 'footwear'];
  if (lowerItems.some(item => normalizedName.includes(item) || normalizedCategory.includes(item))) {
    if (centerY < 0.5) {
      return false; // Shoes shouldn't be in upper half
    }
  }

  // Tops should generally be in upper-middle (y center between 0.15-0.6)
  const topItems = ['top', 'shirt', 'blouse', 'hoodie', 'sweater', 'jacket', 'coat', 'blazer'];
  if (topItems.some(item => normalizedName.includes(item) || normalizedCategory === 'tops' || normalizedCategory === 'outerwear')) {
    if (centerY > 0.75 || centerY < 0.1) {
      return false; // Tops shouldn't be at very bottom or very top edge
    }
  }

  // Bottoms should generally be in lower-middle (y center between 0.4-0.9)
  const bottomItems = ['pants', 'jeans', 'trousers', 'skirt', 'shorts'];
  if (bottomItems.some(item => normalizedName.includes(item) || normalizedCategory === 'bottoms')) {
    if (centerY < 0.3) {
      return false; // Pants shouldn't be in upper third
    }
  }

  return true;
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
      tempId: randomUUID(),
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
  const imageId = randomUUID();
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

    // Convert to our DetectedProduct format with post-detection filtering
    const allDetections = validated.products.map(p => ({
      tempId: randomUUID(),
      boundingBox: p.boundingBox,
      suggestedName: p.name,
      category: p.category,
      colors: p.colors,
      confidence: p.confidence,
    }));

    // Filter out invalid detections
    const filteredDetections = allDetections.filter(p => {
      // Filter 1: Minimum confidence threshold
      if (p.confidence < 0.7) {
        logger.debug({ name: p.suggestedName, confidence: p.confidence }, 'Filtered: low confidence');
        return false;
      }

      // Filter 2: Exclude background/architectural elements by name
      if (isExcludedItem(p.suggestedName)) {
        logger.debug({ name: p.suggestedName }, 'Filtered: excluded item type');
        return false;
      }

      // Filter 3: Validate category matches context
      if (!isValidCategory(p.category, input.context)) {
        logger.debug({ name: p.suggestedName, category: p.category, context: input.context }, 'Filtered: invalid category for context');
        return false;
      }

      // Filter 4: Reject items that cover >60% of image (likely background)
      const coverage = p.boundingBox.width * p.boundingBox.height;
      if (coverage > 0.6) {
        logger.debug({ name: p.suggestedName, coverage }, 'Filtered: too large (likely background)');
        return false;
      }

      // Filter 5: Validate bounding box location matches expected position for item type (fashion only)
      if (input.context === 'fashion') {
        if (!isBoundingBoxLocationValid(p.category, p.suggestedName, p.boundingBox)) {
          const centerY = p.boundingBox.y + p.boundingBox.height / 2;
          logger.warn({
            name: p.suggestedName,
            category: p.category,
            boundingBox: p.boundingBox,
            centerY,
          }, 'Filtered: bounding box location does not match item type (spatial mismatch)');
          return false;
        }
      }

      return true;
    });

    logger.info({
      rawCount: allDetections.length,
      filteredCount: filteredDetections.length,
      filtered: allDetections.length - filteredDetections.length,
    }, 'Post-detection filtering complete');

    return filteredDetections;
  } catch (error: any) {
    logApiCall(logger, 'gemini', 'generateContent', startTime, false, {
      error: error.message,
    });
    logger.error({ error }, 'Gemini vision detection failed');
    // Return empty array on failure - user can try single product mode
    return [];
  }
}
