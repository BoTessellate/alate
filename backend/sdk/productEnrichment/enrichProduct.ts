/**
 * Product Enrichment Module
 * Enriches raw product data using Claude AI (primary) with Gemini fallback
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  RawProductInput,
  EnrichedProduct,
  ClaudeEnrichmentResponse,
  EnrichmentConfig
} from './types';
import {
  validateRawProduct,
  validateEnrichedFields,
  sanitizeProductName,
  normalizeCategory
} from './validateProduct';
import {
  normalizeTags,
  validateCategory as validateTaxonomyCategory,
  NormalizationResult
} from '../taxonomy';

export class ProductEnrichmentEngine {
  private anthropic: Anthropic | null;
  private gemini: GoogleGenerativeAI | null;
  private supabase: SupabaseClient;
  private model: string;
  private geminiModel: string;

  constructor(config: EnrichmentConfig) {
    // Initialize Anthropic if API key available
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey
      });
    } else {
      this.anthropic = null;
      console.warn('Anthropic API key not provided - Claude enrichment disabled');
    }

    // Initialize Gemini as fallback
    const geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      this.gemini = new GoogleGenerativeAI(geminiApiKey);
    } else {
      this.gemini = null;
      console.warn('Gemini API key not provided - Gemini fallback disabled');
    }

    // Ensure at least one provider is available
    if (!this.anthropic && !this.gemini) {
      throw new Error('At least one AI provider (Anthropic or Gemini) must be configured');
    }

    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    this.model = config.model || process.env.ENRICHMENT_MODEL || 'claude-opus-4-5-20251101';
    this.geminiModel = config.geminiModel || process.env.GEMINI_ENRICHMENT_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Enriches a raw product using Claude AI
   * @param rawProduct - Raw product input
   * @returns Enriched product with AI-generated fields
   */
  async enrichProduct(rawProduct: RawProductInput): Promise<EnrichedProduct> {
    // Step 1: Validate raw input
    const validation = validateRawProduct(rawProduct);
    if (!validation.isValid) {
      throw new Error(`Invalid product input: ${validation.errors.join(', ')}`);
    }

    // Step 2: Sanitize inputs
    const sanitized: RawProductInput = {
      ...rawProduct,
      product_name: sanitizeProductName(rawProduct.product_name),
      category: normalizeCategory(rawProduct.category)
    };

    // Step 3: Call Claude for enrichment
    const enrichedFields = await this.callClaudeForEnrichment(sanitized);

    // Step 4: Validate enriched fields
    const enrichmentValidation = validateEnrichedFields(enrichedFields);
    if (!enrichmentValidation.isValid) {
      throw new Error(`Invalid enrichment output: ${enrichmentValidation.errors.join(', ')}`);
    }

    // Step 5: Normalize tags using taxonomy
    const tagNormalization = this.normalizeProductTags(
      enrichedFields.tags || [],
      sanitized.category
    );

    // Step 6: Map inferred dimensions to product_dimensions if not already set
    const productDimensions = sanitized.product_dimensions || (enrichedFields.inferred_dimensions ? {
      width: enrichedFields.inferred_dimensions.width_cm,
      height: enrichedFields.inferred_dimensions.height_cm,
      depth: enrichedFields.inferred_dimensions.depth_cm,
    } : undefined);

    // Step 7: Merge and return enriched product
    const enrichedProduct: EnrichedProduct = {
      ...sanitized,
      ...enrichedFields,
      tags: tagNormalization.canonical_tags,
      canonical_tags: tagNormalization.canonical_tags,
      product_dimensions: productDimensions,
      enriched_at: new Date().toISOString()
    };

    // Remove the inferred_dimensions field (it's mapped to product_dimensions)
    delete (enrichedProduct as { inferred_dimensions?: unknown }).inferred_dimensions;

    return enrichedProduct;
  }

  /**
   * Normalizes product tags against the taxonomy
   * @param tags - Raw tags from enrichment
   * @param category - Product category for scoped normalization
   * @returns Normalization result with canonical tags
   */
  private normalizeProductTags(tags: string[], category?: string): NormalizationResult {
    // Validate category against taxonomy
    const validCategory = category ? validateTaxonomyCategory(category) : undefined;

    // Normalize tags using taxonomy
    const result = normalizeTags(tags, validCategory || undefined);

    // Log unmatched tags for monitoring (could be sent to analytics)
    if (result.unmatched_tags.length > 0) {
      console.warn(
        `Unmatched tags during enrichment: ${result.unmatched_tags.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Calls AI API to enrich product data (Claude primary, Gemini fallback)
   * @param product - Sanitized raw product
   * @returns Enriched fields from AI
   */
  private async callClaudeForEnrichment(
    product: RawProductInput
  ): Promise<ClaudeEnrichmentResponse> {
    const prompt = this.buildEnrichmentPrompt(product);

    // Try Claude first if available
    if (this.anthropic) {
      try {
        const message = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        // Extract text from Claude response
        const responseText = message.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('');

        // Parse JSON response
        const enriched = JSON.parse(responseText);
        console.log('Product enrichment completed using Claude');
        return this.normalizeEnrichmentResponse(enriched);
      } catch (claudeError) {
        console.warn('Claude enrichment failed, attempting Gemini fallback:', claudeError);
        // Fall through to Gemini fallback
      }
    }

    // Gemini fallback
    if (this.gemini) {
      return await this.callGeminiForEnrichment(prompt);
    }

    throw new Error('All AI providers failed for product enrichment');
  }

  /**
   * Calls Gemini API for enrichment (fallback)
   * @param prompt - The enrichment prompt
   * @returns Enriched fields from Gemini
   */
  private async callGeminiForEnrichment(prompt: string): Promise<ClaudeEnrichmentResponse> {
    if (!this.gemini) {
      throw new Error('Gemini not configured');
    }

    const model = this.gemini.getGenerativeModel({ model: this.geminiModel });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();

    // Clean up response - Gemini sometimes wraps in markdown code blocks
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const enriched = JSON.parse(responseText);
      console.log('Product enrichment completed using Gemini (fallback)');
      return this.normalizeEnrichmentResponse(enriched);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response: ${responseText}`);
    }
  }

  /**
   * Normalizes enrichment response to ensure data consistency
   * - Converts all string values to lowercase
   * - Validates texture values against allowed list
   * @param response - Raw AI response
   * @returns Normalized response
   */
  private normalizeEnrichmentResponse(response: ClaudeEnrichmentResponse): ClaudeEnrichmentResponse {
    // Valid texture values (surface finishes, not weave types)
    const validTextures = [
      'smooth', 'textured', 'woven', 'ribbed', 'rough', 'soft', 'fuzzy',
      'grainy', 'pebbled', 'quilted', 'embossed', 'matte', 'glossy',
      'shiny', 'brushed', 'polished', 'satin', 'distressed', 'knit',
      'velvet', 'suede', 'patent', 'metallic'
    ];

    // Texture mapping for common mistakes
    const textureMapping: Record<string, string> = {
      'oxford': 'smooth',      // Oxford is a weave, not texture
      'twill': 'textured',     // Twill is a weave
      'percale': 'smooth',     // Percale is a weave
      'sateen': 'satin',       // Sateen is a weave, satin is the texture
      'jersey': 'soft',        // Jersey is a knit type
      'flannel': 'soft',       // Flannel describes softness
      'corduroy': 'ribbed',    // Corduroy has ribbed texture
      'denim': 'textured',     // Denim is material, not texture
      'canvas': 'textured',    // Canvas is material
      'leather': 'smooth',     // Leather is material
      'silk': 'smooth',        // Silk is material
      'cotton': 'soft',        // Cotton is material
      'wool': 'fuzzy',         // Wool is material
      'linen': 'textured',     // Linen is material
    };

    // Normalize texture
    let normalizedTexture = response.texture?.toLowerCase().trim() || 'smooth';
    if (textureMapping[normalizedTexture]) {
      normalizedTexture = textureMapping[normalizedTexture];
    }
    if (!validTextures.includes(normalizedTexture)) {
      console.warn(`Invalid texture "${normalizedTexture}", defaulting to "smooth"`);
      normalizedTexture = 'smooth';
    }

    return {
      color_palette: response.color_palette?.map(c => c.toLowerCase().trim()) || [],
      tags: response.tags?.map(t => t.toLowerCase().trim()) || [],
      texture: normalizedTexture,
      material: response.material?.toLowerCase().trim() || 'unknown',
      tone: response.tone?.toLowerCase().trim() || 'neutral',
      flags: response.flags?.map(f => f.toLowerCase().trim()) || [],
      fit_tags: response.fit_tags || [],
      inferred_dimensions: response.inferred_dimensions
    };
  }

  /**
   * Builds the enrichment prompt for Claude
   * @param product - Raw product data
   * @returns Formatted prompt string
   */
  private buildEnrichmentPrompt(product: RawProductInput): string {
    // Build description section from all available metadata
    const descriptionParts: string[] = [];
    if (product.description) descriptionParts.push(product.description);
    if (product.meta_description) descriptionParts.push(product.meta_description);
    if (product.product_type) descriptionParts.push(`Product Type: ${product.product_type}`);
    const fullDescription = descriptionParts.join('\n');

    return `You are an expert product analyst specializing in home decor, fashion, and lifestyle products.

Given the product below, analyze and enrich it with the following:
- **color_palette**: An array of 2-5 primary and secondary colors (e.g., ["indigo", "cream", "brick red"])
- **tags**: An array of 3-5 descriptive style keywords (e.g., ["handwoven", "traditional", "boho", "textured"])
- **texture**: The SURFACE FINISH quality - how it feels/looks to touch. Must be one of: smooth, textured, woven, ribbed, rough, soft, fuzzy, grainy, pebbled, quilted, embossed, matte, glossy, shiny, brushed, polished, satin, distressed
- **material**: The primary material class (e.g., "cotton", "ceramic", "wood", "linen", "leather", "silk", "denim")
- **tone**: The overall aesthetic or mood (e.g., "earthy", "playful", "minimalist", "luxury")
- **flags**: Special product attributes (e.g., ["handmade", "fragile", "limited-edition", "eco-friendly", "vintage", "artisan"])
- **fit_tags**: Physical characteristics for layout placement. Choose from: "bulky", "flat", "delicate", "lightweight", "oversized"
- **inferred_dimensions**: Estimate typical dimensions based on product type

**Product Details:**
- Product Name: "${product.product_name}"
- Brand: "${product.brand}"
- Category: "${product.category}"
${product.price ? `- Price: ${product.price}` : ''}
${product.region ? `- Region: ${product.region}` : ''}
${product.dimensions ? `- Dimensions: ${product.dimensions}` : ''}
${product.product_dimensions ? `- Structured Dimensions: ${JSON.stringify(product.product_dimensions)}` : ''}
${fullDescription ? `\n**Product Description/Metadata:**\n${fullDescription}` : ''}

**CRITICAL RULES - READ CAREFULLY:**
1. ALL values must be LOWERCASE (e.g., "cotton" not "Cotton", "smooth" not "Smooth")
2. **texture** is SURFACE FINISH, NOT fabric weave type:
   - CORRECT: smooth, textured, matte, glossy, shiny, brushed, polished, woven, soft
   - WRONG: oxford, twill, percale, sateen (these are weave types - use for material instead)
3. For ACCESSORIES (jewelry, watches, bags):
   - Use textures like: shiny, matte, brushed, polished, satin, pebbled, smooth
   - Base texture on material (e.g., metal=shiny/brushed, leather=smooth/pebbled)
4. Extract material, size, and other details from the description/metadata if available
5. Use specific, descriptive terms (avoid vague words like "nice", "good", "normal")
6. Ensure colors are realistic and relevant to the product type
7. Return ONLY valid JSON without any markdown formatting or explanations

**Output Format (JSON only):**
{
  "color_palette": ["color1", "color2", "color3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "texture": "surface_finish",
  "material": "material_type",
  "tone": "aesthetic_mood",
  "flags": ["flag1", "flag2"],
  "fit_tags": ["flat", "lightweight"],
  "inferred_dimensions": {
    "width_cm": 45,
    "height_cm": 45,
    "depth_cm": 10,
    "size_category": "medium"
  }
}`;
  }

  /**
   * Saves enriched product to Supabase
   * @param enrichedProduct - Enriched product data
   * @returns Saved product with database ID
   */
  async saveToDatabase(enrichedProduct: EnrichedProduct, userId?: string): Promise<EnrichedProduct> {
    // Add user_id to match database schema (use system ID if not provided)
    const productToSave = {
      ...enrichedProduct,
      user_id: userId || '00000000-0000-0000-0000-000000000000' // System/backend user ID
    };

    const { data, error } = await this.supabase
      .from('enriched_products')
      .insert(productToSave)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save to database: ${error.message}`);
    }

    return data as EnrichedProduct;
  }

  /**
   * End-to-end pipeline: enrich and save product
   * @param rawProduct - Raw product input
   * @returns Saved enriched product with database ID
   */
  async enrichAndSave(rawProduct: RawProductInput): Promise<EnrichedProduct> {
    const enriched = await this.enrichProduct(rawProduct);
    return await this.saveToDatabase(enriched);
  }

  /**
   * Batch enrich multiple products
   * @param rawProducts - Array of raw products
   * @returns Array of enriched products
   */
  async enrichBatch(rawProducts: RawProductInput[]): Promise<EnrichedProduct[]> {
    const enrichedProducts: EnrichedProduct[] = [];

    for (const product of rawProducts) {
      try {
        const enriched = await this.enrichProduct(product);
        enrichedProducts.push(enriched);
      } catch (error) {
        console.error(`Failed to enrich product ${product.product_name}:`, error);
        // Continue with next product
      }
    }

    return enrichedProducts;
  }

  /**
   * Batch enrich and save multiple products
   * @param rawProducts - Array of raw products
   * @returns Array of saved enriched products
   */
  async enrichAndSaveBatch(rawProducts: RawProductInput[], userId?: string): Promise<EnrichedProduct[]> {
    const enriched = await this.enrichBatch(rawProducts);

    // Add user_id to all products
    const productsToSave = enriched.map(p => ({
      ...p,
      user_id: userId || '00000000-0000-0000-0000-000000000000'
    }));

    const { data, error } = await this.supabase
      .from('enriched_products')
      .insert(productsToSave)
      .select();

    if (error) {
      throw new Error(`Failed to save batch to database: ${error.message}`);
    }

    return data as EnrichedProduct[];
  }
}

/**
 * Factory function to create ProductEnrichmentEngine
 */
export function createEnrichmentEngine(config: EnrichmentConfig): ProductEnrichmentEngine {
  return new ProductEnrichmentEngine(config);
}

/**
 * Simple ProductEnricher wrapper for backward compatibility
 * Used by CSV upload and other simple use cases
 */
export class ProductEnricher {
  private engine: ProductEnrichmentEngine;

  constructor(anthropicApiKey: string) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.engine = new ProductEnrichmentEngine({
      anthropicApiKey,
      supabaseUrl,
      supabaseKey
    });
  }

  async enrichAndSave(product: RawProductInput): Promise<{ success: boolean; product_id?: string; error?: string }> {
    try {
      const enriched = await this.engine.enrichAndSave(product);
      return { success: true, product_id: enriched.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Enrichment failed'
      };
    }
  }
}
