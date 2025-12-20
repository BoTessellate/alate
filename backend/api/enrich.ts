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

    const aiResponse = await callClaude(prompt, { maxTokens: 500 });

    let enrichment;
    if (aiResponse.success && aiResponse.text) {
      enrichment = parseJSONFromResponse(aiResponse.text);
    }

    if (!enrichment) {
      log.warn({ productName: product.name }, 'Failed to parse AI response, using defaults');
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
      model_used: 'claude-via-edge-function'
    });
  } catch (error) {
    log.error({ error, productName: product.name }, 'Enrichment failed');
    return res.status(500).json({
      error: 'Enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
