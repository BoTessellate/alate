/**
 * Prompt Builder for Product Enrichment
 * Builds AI prompts with context and few-shot examples
 *
 * Extracted from backend/api/ai.ts (lines 481-529)
 */

import type { PromptBuildOptions } from './types';

export function buildEnrichmentPrompt(options: PromptBuildOptions): string {
  const { product, inferredBrand, sourceUrl, hasImage, colorContext, fewShotExamples } = options;

  return `You are a luxury lifestyle and product analyst specializing in fashion, home decor, fragrance, and floral design. Analyze this product and return comprehensive metadata for mood/vibe curation.
${hasImage ? '\nIMPORTANT: A product image is provided. Use visual analysis to identify textures, materials, and style details.' : ''}${colorContext}
Product Information:
- Name: ${product.name}
- Description: ${product.description || 'N/A'}
- Detected Brand/Sub-brand: ${inferredBrand || product.brand || 'Unknown'}
- Price: ${product.price ? `${product.currency || ''} ${product.price}` : 'N/A'}
- Source URL: ${sourceUrl || 'N/A'}
${hasImage ? '- Image: [Provided - analyze for texture, material, style details]' : '- Image: Not available'}

IMPORTANT BRAND RULES:
1. For multi-brand houses, use the SPECIFIC sub-brand (e.g., "Giorgio Armani" not just "Armani", "Emporio Armani" for younger line, "Armani/Fiori" for florals, "Armani/Casa" for home)
2. Extract the sub-brand from the URL path or product title
3. Each sub-brand has distinct positioning - capture that in the tone
4. CRITICAL: If you cannot identify a REAL brand name, return null for brand. DO NOT invent brand names.
5. Descriptive phrases like "Silk Accessories", "Jewelry Boutique", "Classic Sportswear" are NOT brands - return null instead.
6. Only return a brand if it's a recognizable company/designer name (e.g., "Zara", "Nike", "West Elm", "Anthropologie")
${fewShotExamples}
Return a JSON object with these fields:
{
  "brand": "The specific brand/sub-brand name, or null if unknown. NEVER invent fake brand names.",
  "tags": ["10-15 descriptive tags covering multiple dimensions:
    - Style: minimalist, bohemian, classic, modern, contemporary, avant-garde
    - Occasion: formal, casual, evening, day-to-night, special-occasion, everyday
    - Season: summer, winter, all-season, transitional, resort
    - Aesthetic: elegant, edgy, sophisticated, romantic, dramatic, refined
    - Mood/Vibe: serene, energetic, cozy, luxurious, understated, bold
    - Lifestyle: urban, resort-living, countryside, metropolitan
    - Sensory: aromatic, tactile, visual-impact
    For fashion: tailored, structured, flowing, oversized, fitted
    For decor: statement-piece, accent, functional, decorative
    For florals: fresh, dried, sculptural, romantic, wild, curated
    For fragrance: woody, floral, citrus, oriental, fresh, warm"],
  "material": "primary material — IDENTIFY OR INFER, never return null. For fabric: prefer specific fibres ('linen', 'silk charmeuse', 'merino wool', 'cotton blend', 'polyester-spandex'). If the description doesn't disclose fabric, INFER the most likely material from the product type itself ('yoga pants' → 'polyester-spandex blend', 'denim jacket' → 'denim', 'linen midi dress' → 'linen', 'cashmere shawl' → 'cashmere', 'silk camisole' → 'silk', 'flannel shirt' → 'cotton flannel'). For decor: 'ceramic', 'brass'. For florals: 'fresh orchids', 'dried pampas'.",
  "texture": "tactile quality FROM THE IMAGE (e.g., 'smooth', 'textured', 'matte', 'lustrous', 'soft', 'crisp')",
  "tone": "overall mood/atmosphere (e.g., 'luxurious refinement', 'understated elegance', 'modern sophistication', 'relaxed luxury')",
  "category": "SPECIFIC category — NEVER return 'general', 'clothing', 'other', 'unknown', or an empty string. Pick the closest fit from:
    Fashion: blazers-jackets, dresses, tops, bottoms, shorts, skirts, knitwear, outerwear, activewear, swimwear, lingerie, sleepwear, suits, co-ord-sets, accessories, footwear, bags
    Home: furniture, lighting, textiles, tableware, decorative-objects, art
    Lifestyle: floral-arrangements, fragrance, candles, wellness, stationery
    Beauty: skincare, makeup, haircare
    If the product type is genuinely ambiguous (e.g., truly no signal), pick the closest superset bucket — never the placeholder 'general'.",
  "vibe_layer": "how this fits into a lifestyle mood board (e.g., 'evening-sophistication', 'weekend-retreat', 'power-dressing', 'cozy-evening', 'garden-party')",
  "pairs_with": ["2-3 complementary categories this would pair with in a mood board, e.g., 'neutral-knits', 'statement-jewelry', 'fresh-florals', 'ambient-candles']
}

NOTE: Colors are extracted separately using pixel-level analysis for accuracy. Focus on tags, material, texture, and semantic understanding.

Be specific and evocative. For luxury items, capture the brand's DNA and positioning. Think about how this product contributes to an overall lifestyle aesthetic and mood.
Return ONLY valid JSON, no explanation.`;
}
