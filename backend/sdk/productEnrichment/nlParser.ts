import { createModuleLogger } from '../shared/logger';
import { callClaude, callGemini, parseJSONFromResponse } from '../shared/secureAI';

const log = createModuleLogger('nlParser');

interface ParsedProductDetails {
  brand: string | null;
  size: string | null;
  material: string | null;
  estimated_price: number | null;
  currency: string | null;
  additional_tags: string[];
}

interface ParsedMultiProductDetails {
  multiple: true;
  products: Array<{
    product_type?: string;
    brand?: string | null;
    size?: string | null;
    material?: string | null;
    estimated_price?: number | null;
    currency?: string | null;
    additional_tags?: string[];
  }>;
}

type ParsedDetails = ParsedProductDetails | ParsedMultiProductDetails;

export interface ParseProductDetailsInput {
  description: string;
  context?: 'fashion' | 'home';
}

export interface ParseProductDetailsResult {
  success: boolean;
  parsed: ParsedDetails | ParsedProductDetails;
  confidence: number;
  model_used?: string;
  error?: string;
}

/**
 * Parse natural language product description into structured fields
 * Uses Gemini (same as chat agent) for consistency
 *
 * Example input: "It's a Zara blazer, size M, wool blend, paid $80"
 * Example output: { brand: "Zara", size: "M", material: "wool blend", estimated_price: 80, currency: "USD" }
 */
export async function parseProductDetails(
  input: ParseProductDetailsInput
): Promise<ParseProductDetailsResult> {
  const { description, context = 'fashion' } = input;

  if (!description || typeof description !== 'string') {
    return {
      success: false,
      error: 'description is required',
      parsed: {
        brand: null,
        size: null,
        material: null,
        estimated_price: null,
        currency: null,
        additional_tags: [],
      },
      confidence: 0,
    };
  }

  if (description.length > 500) {
    return {
      success: false,
      error: 'description too long (max 500 characters)',
      parsed: {
        brand: null,
        size: null,
        material: null,
        estimated_price: null,
        currency: null,
        additional_tags: [],
      },
      confidence: 0,
    };
  }

  const prompt = `Extract structured product details from this natural language description.
The user may describe one or multiple products in a single message.

User said: "${description}"
Context: ${context} (${context === 'fashion' ? 'clothing/accessories' : 'home decor/furniture'})

For each product mentioned, extract:
- product_type: What the item is (e.g., "top", "pants", "shoes", "dress")
- brand: The brand name (e.g., "Zara", "Nike", "M&S", "Mango")
- size: Size information (e.g., "S", "M", "Large", "UK 8", "42")
- material: Material or fabric if mentioned
- estimated_price: Numeric price value (just the number)
- currency: Currency code (default "USD" if not specified)
- additional_tags: Additional descriptive tags

If ONE product is described, return:
{
  "brand": "brand or null",
  "size": "size or null",
  "material": "material or null",
  "estimated_price": number or null,
  "currency": "currency code or null",
  "additional_tags": ["tag1"]
}

If MULTIPLE products are described, return:
{
  "multiple": true,
  "products": [
    { "product_type": "top", "brand": "Mango", "size": "S", ... },
    { "product_type": "pants", "brand": "M&S", "size": "M", ... }
  ]
}

Return ONLY valid JSON, no explanation.`;

  try {
    log.info({ description, context }, 'Parsing natural language product details with Gemini...');

    // Use Gemini (same as chat agent) for consistency
    let aiResponse = await callGemini(prompt, { maxTokens: 300 });
    let modelUsed = 'gemini';

    // Fallback to Claude if Gemini fails
    if (!aiResponse.success) {
      log.warn({ error: aiResponse.error }, 'Gemini failed, trying Claude...');
      aiResponse = await callClaude(prompt, { maxTokens: 300 });
      modelUsed = 'claude';
    }

    if (!aiResponse.success || !aiResponse.text) {
      log.warn('All AI providers failed for parse-details');
      return {
        success: false,
        error: 'Failed to parse description',
        parsed: {
          brand: null,
          size: null,
          material: null,
          estimated_price: null,
          currency: null,
          additional_tags: [],
        },
        confidence: 0,
      };
    }

    const parsed = parseJSONFromResponse(aiResponse.text) as ParsedDetails | null;

    if (!parsed) {
      log.warn('Failed to parse JSON from AI response');
      return {
        success: false,
        error: 'Failed to parse AI response',
        parsed: {
          brand: null,
          size: null,
          material: null,
          estimated_price: null,
          currency: null,
          additional_tags: [],
        },
        confidence: 0,
      };
    }

    // Check if this is a multi-product response
    if ('multiple' in parsed && parsed.multiple === true && Array.isArray(parsed.products)) {
      // Multi-product response - clean each product
      const cleanedProducts = parsed.products.map((p) => ({
        product_type: p.product_type && typeof p.product_type === 'string' ? p.product_type.trim() : undefined,
        brand: p.brand && typeof p.brand === 'string' ? p.brand.trim() : null,
        size: p.size && typeof p.size === 'string' ? p.size.trim() : null,
        material: p.material && typeof p.material === 'string' ? p.material.trim() : null,
        estimated_price: typeof p.estimated_price === 'number' ? p.estimated_price : null,
        currency: p.currency && typeof p.currency === 'string' ? p.currency.toUpperCase() : null,
        additional_tags: Array.isArray(p.additional_tags)
          ? p.additional_tags.filter((t): t is string => typeof t === 'string').map(t => t.trim())
          : [],
      }));

      // Calculate confidence based on how many products have at least one field
      const productsWithData = cleanedProducts.filter((p) =>
        p.brand || p.size || p.material || p.estimated_price || p.product_type
      ).length;
      const confidence = cleanedProducts.length > 0 ? productsWithData / cleanedProducts.length : 0;

      log.info({
        productCount: cleanedProducts.length,
        productsWithData,
        modelUsed,
        confidence,
      }, 'Multi-product natural language parsing complete');

      return {
        success: true,
        parsed: {
          multiple: true,
          products: cleanedProducts,
        },
        confidence,
        model_used: modelUsed,
      };
    }

    // Single product response - validate and clean the parsed data
    const singleParsed = parsed as ParsedProductDetails;
    const cleanedParsed: ParsedProductDetails = {
      brand: singleParsed.brand && typeof singleParsed.brand === 'string' ? singleParsed.brand.trim() : null,
      size: singleParsed.size && typeof singleParsed.size === 'string' ? singleParsed.size.trim() : null,
      material: singleParsed.material && typeof singleParsed.material === 'string' ? singleParsed.material.trim() : null,
      estimated_price: typeof singleParsed.estimated_price === 'number' ? singleParsed.estimated_price : null,
      currency: singleParsed.currency && typeof singleParsed.currency === 'string' ? singleParsed.currency.toUpperCase() : null,
      additional_tags: Array.isArray(singleParsed.additional_tags)
        ? singleParsed.additional_tags.filter((t): t is string => typeof t === 'string').map(t => t.trim())
        : [],
    };

    // Calculate confidence based on how many fields were extracted
    const fieldsExtracted = [
      cleanedParsed.brand,
      cleanedParsed.size,
      cleanedParsed.material,
      cleanedParsed.estimated_price,
      cleanedParsed.additional_tags.length > 0,
    ].filter(Boolean).length;
    const confidence = Math.min(1, fieldsExtracted / 3); // At least 3 fields = full confidence

    log.info({
      parsed: cleanedParsed,
      modelUsed,
      confidence,
      fieldsExtracted
    }, 'Natural language parsing complete');

    return {
      success: true,
      parsed: cleanedParsed,
      confidence,
      model_used: modelUsed,
    };

  } catch (error) {
    log.error({ error }, 'Parse product details failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      parsed: {
        brand: null,
        size: null,
        material: null,
        estimated_price: null,
        currency: null,
        additional_tags: [],
      },
      confidence: 0,
    };
  }
}
