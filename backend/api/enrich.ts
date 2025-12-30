/**
 * Product Enrichment API - Vercel Serverless Function
 * Uses Claude via Supabase Edge Function to enrich product data
 * API keys remain secure in Supabase secrets
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { callClaude, parseJSONFromResponse } from '../sdk/shared/secureAI';

const log = createModuleLogger('enrichment');

/**
 * REMINDER: Add Anthropic API credits when bank issue is resolved
 * The enrichment feature requires API credits to work in production.
 * Set DEMO_MODE=false in Vercel env vars once credits are added.
 */
const DEMO_MODE = process.env.DEMO_MODE !== 'false'; // Default to demo mode

// Demo enrichment data for testing without API credits
const DEMO_ENRICHMENTS: Record<string, any> = {
  default: {
    tags: ['handcrafted', 'artisan', 'sustainable', 'boho'],
    color_palette: ['terracotta', 'cream', 'sage green', 'natural wood'],
    material: 'cotton',
    texture: 'woven',
    tone: 'earthy',
    category: 'home decor'
  },
  cushion: {
    tags: ['handwoven', 'traditional', 'boho', 'textured'],
    color_palette: ['indigo', 'cream', 'gold', 'rust'],
    material: 'cotton',
    texture: 'woven',
    tone: 'warm',
    category: 'textiles'
  },
  ceramic: {
    tags: ['handmade', 'artisan', 'minimalist', 'organic'],
    color_palette: ['terracotta', 'white', 'speckled cream'],
    material: 'ceramic',
    texture: 'matte',
    tone: 'earthy',
    category: 'home decor'
  },
  furniture: {
    tags: ['handcrafted', 'sustainable', 'modern', 'natural'],
    color_palette: ['walnut', 'oak', 'natural wood', 'brass'],
    material: 'wood',
    texture: 'smooth',
    tone: 'warm',
    category: 'furniture'
  }
};

function getDemoEnrichment(productName: string): any {
  const name = productName.toLowerCase();
  if (name.includes('cushion') || name.includes('pillow') || name.includes('textile')) {
    return DEMO_ENRICHMENTS.cushion;
  }
  if (name.includes('ceramic') || name.includes('pottery') || name.includes('vase')) {
    return DEMO_ENRICHMENTS.ceramic;
  }
  if (name.includes('chair') || name.includes('table') || name.includes('furniture') || name.includes('wood')) {
    return DEMO_ENRICHMENTS.furniture;
  }
  return DEMO_ENRICHMENTS.default;
}

interface RawProduct {
  name: string;
  description?: string;
  brand?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  source_url?: string;
}

interface EnrichedProduct extends RawProduct {
  tags: string[];
  color_palette: string[];
  material?: string;
  texture?: string;
  tone?: string;
  category?: string;
  enriched_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product } = req.body as { product: RawProduct };

  if (!product || !product.name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  try {
    // Demo mode - return realistic mock data without API calls
    if (DEMO_MODE) {
      log.info({ productName: product.name, demoMode: true }, 'Using demo enrichment data');
      const demoEnrichment = getDemoEnrichment(product.name);

      const enrichedProduct: EnrichedProduct = {
        ...product,
        tags: demoEnrichment.tags,
        color_palette: demoEnrichment.color_palette,
        material: demoEnrichment.material,
        texture: demoEnrichment.texture,
        tone: demoEnrichment.tone,
        category: demoEnrichment.category,
        enriched_at: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        product: enrichedProduct,
        model_used: 'demo-mode',
        _demo: true,
        _note: 'Demo mode active. Set DEMO_MODE=false and add API credits for real AI enrichment.'
      });
    }

    const prompt = `You are a product enrichment AI. Analyze this product and return structured metadata.

Product:
- Name: ${product.name}
- Description: ${product.description || 'N/A'}
- Brand: ${product.brand || 'N/A'}
- Price: ${product.price ? `${product.currency || ''} ${product.price}` : 'N/A'}

Return a JSON object with these fields:
{
  "tags": ["3-5 descriptive style keywords like 'bohemian', 'minimalist', 'handmade'"],
  "color_palette": ["2-5 colors found in/associated with the product, e.g. 'cream', 'terracotta', 'forest green'"],
  "material": "primary material if detectable (e.g., 'cotton', 'ceramic', 'wood')",
  "texture": "texture description (e.g., 'woven', 'smooth', 'textured')",
  "tone": "aesthetic mood (e.g., 'warm', 'cool', 'earthy', 'modern')",
  "category": "product category (e.g., 'home decor', 'furniture', 'textiles', 'lighting')"
}

Return ONLY valid JSON, no explanation.`;

    log.info({ productName: product.name }, 'Calling Claude for enrichment...');
    const aiResponse = await callClaude(prompt, { maxTokens: 500 });

    let enrichment;
    if (aiResponse.success && aiResponse.text) {
      log.info({ productName: product.name }, 'AI response received, parsing...');
      enrichment = parseJSONFromResponse(aiResponse.text);
    } else {
      log.warn({ productName: product.name, error: aiResponse.error }, 'AI call failed');
    }

    if (!enrichment) {
      log.warn({ productName: product.name, aiSuccess: aiResponse.success, hasText: !!aiResponse.text }, 'Failed to parse AI response, using defaults');
      enrichment = {
        tags: ['product'],
        color_palette: ['neutral'],
        material: null,
        texture: null,
        tone: 'neutral',
        category: 'general'
      };
    }

    const enrichedProduct: EnrichedProduct = {
      ...product,
      tags: enrichment.tags || [],
      color_palette: enrichment.color_palette || [],
      material: enrichment.material,
      texture: enrichment.texture,
      tone: enrichment.tone,
      category: enrichment.category,
      enriched_at: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      product: enrichedProduct,
      model_used: 'claude-via-edge-function',
      // Debug info (remove in production)
      _debug: {
        aiSuccess: aiResponse.success,
        aiError: aiResponse.error,
        usedDefaults: !aiResponse.success || !aiResponse.text
      }
    });
  } catch (error) {
    log.error({ error, productName: product.name }, 'Enrichment failed');
    return res.status(500).json({
      error: 'Enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
