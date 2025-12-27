/**
 * Product Enrichment Module
 * Enriches raw product data using Claude AI
 */

import Anthropic from '@anthropic-ai/sdk';
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
  private anthropic: Anthropic;
  private supabase: SupabaseClient;
  private model: string;

  constructor(config: EnrichmentConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey
    });

    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    this.model = config.model || process.env.ENRICHMENT_MODEL || 'claude-opus-4-5-20251101';
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
   * Calls Claude API to enrich product data
   * @param product - Sanitized raw product
   * @returns Enriched fields from Claude
   */
  private async callClaudeForEnrichment(
    product: RawProductInput
  ): Promise<ClaudeEnrichmentResponse> {
    const prompt = this.buildEnrichmentPrompt(product);

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
    try {
      const enriched = JSON.parse(responseText);
      return enriched as ClaudeEnrichmentResponse;
    } catch (error) {
      throw new Error(`Failed to parse Claude response: ${responseText}`);
    }
  }

  /**
   * Builds the enrichment prompt for Claude
   * @param product - Raw product data
   * @returns Formatted prompt string
   */
  private buildEnrichmentPrompt(product: RawProductInput): string {
    return `You are an expert product analyst specializing in home decor, fashion, and lifestyle products.

Given the product below, analyze and enrich it with the following:
- **color_palette**: An array of 2-5 primary and secondary colors (e.g., ["indigo", "cream", "brick red"])
- **tags**: An array of 3-5 descriptive style keywords (e.g., ["handwoven", "traditional", "boho", "textured"])
- **texture**: A single descriptive word for the surface quality (e.g., "woven", "matte", "glossy", "smooth")
- **material**: The primary material class (e.g., "cotton", "ceramic", "wood", "linen")
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

**Important Instructions:**
1. Base your analysis on the product name, brand, and category
2. Use specific, descriptive terms (avoid vague words like "nice", "good", "normal")
3. Ensure colors are realistic and relevant to the product type
4. Tags should capture style, aesthetic, and use case
5. Flags should highlight special characteristics (handmade, fragile, eco-friendly, etc.)
6. fit_tags help with moodboard layout - think about how the item would be photographed/displayed
7. For dimensions, infer typical sizes based on product category (e.g., a cushion is ~45x45cm)
8. Return ONLY valid JSON without any markdown formatting or explanations

**Output Format (JSON only):**
{
  "color_palette": ["color1", "color2", "color3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "texture": "texture_description",
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
