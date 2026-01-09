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
   * - Extracts weave from texture if AI confused them
   * @param response - Raw AI response
   * @returns Normalized response
   */
  private normalizeEnrichmentResponse(response: ClaudeEnrichmentResponse): ClaudeEnrichmentResponse {
    // Valid texture_feel values (tactile - how it FEELS to touch)
    const validTextureFeel = [
      'smooth', 'soft', 'rough', 'fuzzy', 'silky', 'crisp', 'plush',
      'textured', 'ribbed', 'grainy', 'pebbled', 'quilted', 'embossed',
      'nubby', 'coarse', 'supple', 'stiff', 'spongy', 'velvety', 'slick',
      'bumpy', 'nubbly', 'scratchy', 'cottony', 'feathery', 'papery'
    ];

    // Valid texture_look values (visual - how it LOOKS)
    const validTextureLook = [
      'matte', 'glossy', 'shiny', 'lustrous', 'satin', 'iridescent',
      'metallic', 'patent', 'brushed', 'polished', 'distressed', 'woven',
      'knit', 'embossed', 'velvet', 'suede', 'pearlescent', 'frosted',
      'reflective', 'dull', 'shimmer', 'glitter', 'opalescent', 'lacquered'
    ];

    // Legacy combined texture (for backward compatibility)
    const validTextures = [
      'smooth', 'textured', 'woven', 'ribbed', 'rough', 'soft', 'fuzzy',
      'grainy', 'pebbled', 'quilted', 'embossed', 'matte', 'glossy',
      'shiny', 'brushed', 'polished', 'satin', 'distressed', 'knit',
      'velvet', 'suede', 'patent', 'metallic', 'nubuck', 'coarse'
    ];

    // Valid weave types (fabric construction methods) - Global textile traditions
    // Organized by technique type, not geography - names are self-descriptive of origin
    const validWeaves = [
      // Plain/tabby weaves
      'oxford', 'poplin', 'broadcloth', 'percale', 'chambray', 'canvas',
      'khadi', 'kota', 'tant', 'mangalgiri', 'chanderi', 'maheshwari',
      'habutae', 'shweshwe',
      // Twill weaves
      'twill', 'gabardine', 'denim', 'chino', 'herringbone', 'serge',
      // Satin weaves
      'sateen', 'charmeuse',
      // Jacquard/brocade weaves (complex patterns)
      'jacquard', 'damask', 'brocade',
      'banarasi', 'kanchipuram', 'paithani', 'patola', 'jamdani',
      'nishijin', 'songket', 'kente', 'aso-oke',
      // Knit constructions
      'jersey', 'interlock', 'pique', 'cable-knit', 'rib-knit',
      // Pile/napped fabrics
      'velour', 'velvet', 'corduroy', 'terry', 'chenille', 'fleece', 'flannel',
      // Resist-dye/tie-dye techniques (pattern + weave)
      'ikat', 'pochampally', 'sambalpuri', 'kasuri', 'shibori', 'bandhani',
      'adire', 'batik', 'ajrak',
      // Embroidered/embellished textiles
      'chikankari', 'lucknowi', 'phulkari', 'kantha', 'sashiko', 'kogin',
      'suzani',
      // Hand-painted/printed textiles
      'kalamkari', 'yuzen', 'ankara', 'kitenge', 'kanga',
      // Specialty silk weaves
      'tussar', 'muga', 'tsumugi', 'chirimen', 'meisen',
      // Textured/novelty weaves
      'seersucker', 'dobby', 'boucle', 'waffle',
      // Rug/flatweave techniques
      'kilim', 'dhurrie',
      // Patch/repair techniques (wabi-sabi aesthetic)
      'boro',
      // Traditional handloom (region-specific)
      'tenun', 'lurik', 'ulos', 'tapis', 'mudcloth', 'bogolan'
    ];

    // Weave-to-texture mapping (what texture feel AND look does this weave produce?)
    const weaveToTextureFeel: Record<string, string> = {
      // Plain weaves
      'oxford': 'textured', 'poplin': 'smooth', 'broadcloth': 'smooth', 'percale': 'crisp',
      'chambray': 'soft', 'canvas': 'rough', 'khadi': 'textured', 'kota': 'crisp',
      'tant': 'crisp', 'mangalgiri': 'crisp', 'chanderi': 'silky', 'maheshwari': 'soft',
      'habutae': 'silky', 'shweshwe': 'crisp',
      // Twill weaves
      'twill': 'smooth', 'gabardine': 'smooth', 'denim': 'textured', 'chino': 'smooth',
      'herringbone': 'textured', 'serge': 'smooth',
      // Satin weaves
      'sateen': 'silky', 'charmeuse': 'silky',
      // Jacquard/brocade weaves
      'jacquard': 'textured', 'damask': 'smooth', 'brocade': 'textured',
      'banarasi': 'textured', 'kanchipuram': 'crisp', 'paithani': 'silky', 'patola': 'silky',
      'jamdani': 'soft', 'nishijin': 'textured', 'songket': 'textured', 'kente': 'textured',
      'aso-oke': 'textured',
      // Knit constructions
      'jersey': 'soft', 'interlock': 'smooth', 'pique': 'textured', 'cable-knit': 'textured',
      'rib-knit': 'ribbed',
      // Pile/napped fabrics
      'velour': 'plush', 'velvet': 'plush', 'corduroy': 'ribbed', 'terry': 'fuzzy',
      'chenille': 'soft', 'fleece': 'soft', 'flannel': 'soft',
      // Resist-dye techniques
      'ikat': 'textured', 'pochampally': 'soft', 'sambalpuri': 'soft', 'kasuri': 'soft',
      'shibori': 'textured', 'bandhani': 'textured', 'adire': 'soft', 'batik': 'soft',
      'ajrak': 'soft',
      // Embroidered textiles (base fabric + embroidery)
      'chikankari': 'textured', 'lucknowi': 'textured', 'phulkari': 'textured',
      'kantha': 'quilted', 'sashiko': 'quilted', 'kogin': 'textured', 'suzani': 'embossed',
      // Hand-painted/printed
      'kalamkari': 'soft', 'yuzen': 'silky', 'ankara': 'crisp', 'kitenge': 'crisp', 'kanga': 'soft',
      // Specialty silks
      'tussar': 'textured', 'muga': 'silky', 'tsumugi': 'textured', 'chirimen': 'textured',
      'meisen': 'silky',
      // Textured weaves
      'seersucker': 'textured', 'dobby': 'textured', 'boucle': 'nubby', 'waffle': 'textured',
      // Rug techniques
      'kilim': 'rough', 'dhurrie': 'rough',
      // Patch/repair
      'boro': 'textured',
      // Handloom
      'tenun': 'textured', 'lurik': 'textured', 'ulos': 'textured', 'tapis': 'textured',
      'mudcloth': 'rough', 'bogolan': 'rough',
    };

    const weaveToTextureLook: Record<string, string> = {
      // Plain weaves
      'oxford': 'woven', 'poplin': 'matte', 'broadcloth': 'matte', 'percale': 'matte',
      'chambray': 'matte', 'canvas': 'matte', 'khadi': 'matte', 'kota': 'shiny',
      'tant': 'matte', 'mangalgiri': 'matte', 'chanderi': 'shiny', 'maheshwari': 'lustrous',
      'habutae': 'lustrous', 'shweshwe': 'matte',
      // Twill weaves
      'twill': 'matte', 'gabardine': 'matte', 'denim': 'matte', 'chino': 'matte',
      'herringbone': 'woven', 'serge': 'matte',
      // Satin weaves
      'sateen': 'lustrous', 'charmeuse': 'lustrous',
      // Jacquard/brocade weaves
      'jacquard': 'woven', 'damask': 'lustrous', 'brocade': 'lustrous',
      'banarasi': 'lustrous', 'kanchipuram': 'lustrous', 'paithani': 'lustrous',
      'patola': 'lustrous', 'jamdani': 'lustrous', 'nishijin': 'lustrous',
      'songket': 'lustrous', 'kente': 'woven', 'aso-oke': 'woven',
      // Knit constructions
      'jersey': 'matte', 'interlock': 'matte', 'pique': 'woven', 'cable-knit': 'knit',
      'rib-knit': 'knit',
      // Pile/napped fabrics
      'velour': 'velvet', 'velvet': 'velvet', 'corduroy': 'woven', 'terry': 'matte',
      'chenille': 'velvet', 'fleece': 'matte', 'flannel': 'matte',
      // Resist-dye techniques
      'ikat': 'matte', 'pochampally': 'lustrous', 'sambalpuri': 'lustrous', 'kasuri': 'matte',
      'shibori': 'matte', 'bandhani': 'matte', 'adire': 'matte', 'batik': 'matte', 'ajrak': 'matte',
      // Embroidered textiles
      'chikankari': 'embossed', 'lucknowi': 'embossed', 'phulkari': 'embossed',
      'kantha': 'embossed', 'sashiko': 'embossed', 'kogin': 'embossed', 'suzani': 'embossed',
      // Hand-painted/printed
      'kalamkari': 'matte', 'yuzen': 'lustrous', 'ankara': 'matte', 'kitenge': 'matte', 'kanga': 'matte',
      // Specialty silks
      'tussar': 'matte', 'muga': 'lustrous', 'tsumugi': 'matte', 'chirimen': 'matte', 'meisen': 'lustrous',
      // Textured weaves
      'seersucker': 'woven', 'dobby': 'woven', 'boucle': 'woven', 'waffle': 'woven',
      // Rug techniques
      'kilim': 'woven', 'dhurrie': 'woven',
      // Patch/repair
      'boro': 'distressed',
      // Handloom
      'tenun': 'woven', 'lurik': 'woven', 'ulos': 'woven', 'tapis': 'lustrous',
      'mudcloth': 'matte', 'bogolan': 'matte',
    };

    // Material-to-texture mapping (fallback for non-textiles)
    const materialToTextureFeel: Record<string, string> = {
      'leather': 'smooth', 'silk': 'silky', 'cotton': 'soft', 'wool': 'fuzzy',
      'linen': 'textured', 'metal': 'smooth', 'glass': 'smooth', 'ceramic': 'smooth',
      'wood': 'grainy', 'plastic': 'smooth', 'rubber': 'soft', 'suede': 'velvety',
      'velvet': 'plush', 'cashmere': 'soft', 'denim': 'textured', 'polyester': 'smooth',
      'nylon': 'slick', 'canvas': 'rough', 'tweed': 'textured', 'satin': 'silky',
    };

    const materialToTextureLook: Record<string, string> = {
      'leather': 'matte', 'silk': 'lustrous', 'cotton': 'matte', 'wool': 'matte',
      'linen': 'matte', 'metal': 'shiny', 'glass': 'glossy', 'ceramic': 'glossy',
      'wood': 'matte', 'plastic': 'glossy', 'rubber': 'matte', 'suede': 'suede',
      'velvet': 'velvet', 'cashmere': 'matte', 'denim': 'matte', 'polyester': 'shiny',
      'nylon': 'shiny', 'canvas': 'matte', 'tweed': 'woven', 'satin': 'satin',
    };

    // Get raw values
    let rawTextureFeel = response.texture_feel?.toLowerCase().trim() || '';
    let rawTextureLook = response.texture_look?.toLowerCase().trim() || '';
    let rawTexture = response.texture?.toLowerCase().trim() || ''; // Legacy field
    let rawWeave = response.weave?.toLowerCase().trim() || '';
    const rawMaterial = response.material?.toLowerCase().trim() || 'unknown';

    // If AI put a weave type in any texture field, extract it
    const allTextureFields = [rawTextureFeel, rawTextureLook, rawTexture];
    for (const field of allTextureFields) {
      if (field && validWeaves.includes(field)) {
        if (!rawWeave) {
          rawWeave = field;
        }
        // Clear from texture fields if it was mistakenly placed there
        if (rawTextureFeel === field) rawTextureFeel = '';
        if (rawTextureLook === field) rawTextureLook = '';
        if (rawTexture === field) rawTexture = '';
      }
    }

    // Validate weave (only keep valid values)
    const normalizedWeave = validWeaves.includes(rawWeave) ? rawWeave : undefined;

    // Normalize texture_feel
    let normalizedTextureFeel = rawTextureFeel;
    if (!validTextureFeel.includes(normalizedTextureFeel)) {
      // Try weave-based fallback first
      if (normalizedWeave && weaveToTextureFeel[normalizedWeave]) {
        normalizedTextureFeel = weaveToTextureFeel[normalizedWeave];
      } else if (materialToTextureFeel[rawMaterial]) {
        normalizedTextureFeel = materialToTextureFeel[rawMaterial];
      } else if (rawTexture && validTextureFeel.includes(rawTexture)) {
        // Legacy: try old texture field
        normalizedTextureFeel = rawTexture;
      } else {
        normalizedTextureFeel = 'smooth';
      }
    }

    // Normalize texture_look
    let normalizedTextureLook = rawTextureLook;
    if (!validTextureLook.includes(normalizedTextureLook)) {
      // Try weave-based fallback first
      if (normalizedWeave && weaveToTextureLook[normalizedWeave]) {
        normalizedTextureLook = weaveToTextureLook[normalizedWeave];
      } else if (materialToTextureLook[rawMaterial]) {
        normalizedTextureLook = materialToTextureLook[rawMaterial];
      } else if (rawTexture && validTextureLook.includes(rawTexture)) {
        // Legacy: try old texture field
        normalizedTextureLook = rawTexture;
      } else {
        normalizedTextureLook = 'matte';
      }
    }

    // Legacy texture (for backward compatibility - use feel as primary)
    let normalizedTexture = rawTexture;
    if (!validTextures.includes(normalizedTexture)) {
      normalizedTexture = normalizedTextureFeel;
    }

    return {
      color_palette: response.color_palette?.map(c => c.toLowerCase().trim()) || [],
      tags: response.tags?.map(t => t.toLowerCase().trim()) || [],
      texture_feel: normalizedTextureFeel,
      texture_look: normalizedTextureLook,
      texture: normalizedTexture, // Legacy - kept for backward compatibility
      weave: normalizedWeave,
      material: rawMaterial,
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
- **color_palette**: Array of 2-5 primary/secondary colors (e.g., ["indigo", "cream", "brick red"])
- **tags**: Array of 3-5 descriptive style keywords (e.g., ["handwoven", "traditional", "boho"])
- **texture_feel**: How it FEELS to touch (tactile). Choose from: smooth, soft, rough, fuzzy, silky, crisp, plush, textured, ribbed, grainy, pebbled, quilted, embossed, nubby, coarse, supple, stiff, spongy, velvety, slick
- **texture_look**: How it LOOKS visually. Choose from: matte, glossy, shiny, lustrous, satin, iridescent, metallic, patent, brushed, polished, distressed, woven, knit, embossed, velvet, suede, pearlescent, frosted, reflective
- **weave**: For TEXTILES ONLY - the fabric construction/tradition. Examples:
  - Western: oxford, twill, sateen, jersey, flannel, poplin, herringbone, jacquard, denim, corduroy
  - South Asian: khadi, ikat, banarasi, chanderi, kanchipuram, patola, bandhani, chikankari, phulkari
  - East Asian: shibori, kasuri, sashiko, nishijin, yuzen
  - African: kente, adire, ankara, kitenge, mudcloth, aso-oke
  - Use null for non-textile items.
- **material**: Primary material class (e.g., "cotton", "silk", "wool", "leather", "metal", "ceramic")
- **tone**: Overall aesthetic/mood (e.g., "earthy", "playful", "minimalist", "luxury", "bohemian")
- **flags**: Special attributes (e.g., ["handmade", "artisan", "eco-friendly", "vintage", "limited-edition"])
- **fit_tags**: Physical characteristics for layout. Choose from: "bulky", "flat", "delicate", "lightweight", "oversized"
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

**CRITICAL RULES:**
1. ALL values must be LOWERCASE
2. **texture_feel** = TACTILE (how it feels when touched)
3. **texture_look** = VISUAL (how it appears to the eye)
4. **weave** = FABRIC CONSTRUCTION (how textile is woven/made) - null for non-textiles

**Examples:**
- Banarasi silk saree → texture_feel: "silky", texture_look: "lustrous", weave: "banarasi"
- Khadi kurta → texture_feel: "textured", texture_look: "matte", weave: "khadi"
- Oxford shirt → texture_feel: "crisp", texture_look: "woven", weave: "oxford"
- Leather bag → texture_feel: "smooth", texture_look: "matte", weave: null
- Gold bracelet → texture_feel: "smooth", texture_look: "shiny", weave: null

Return ONLY valid JSON without markdown formatting:
{
  "color_palette": ["color1", "color2", "color3"],
  "tags": ["tag1", "tag2", "tag3"],
  "texture_feel": "tactile_quality",
  "texture_look": "visual_quality",
  "weave": "fabric_construction_or_null",
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
