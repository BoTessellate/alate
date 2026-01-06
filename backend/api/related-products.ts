/**
 * Related Products API
 * Returns products similar to a given product based on:
 * - Metadata similarity (tags, colors, materials, tone)
 * - Vision similarity (when available)
 * - Category matching
 *
 * Supports both cached results and real-time computation
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';

const log = createModuleLogger('related-products');

interface Product {
  id: string;
  product_name: string;
  brand: string;
  category: string;
  tags: string[];
  color_palette: string[];
  material: string;
  texture: string;
  tone: string;
  price: number;
  image_url: string;
  vision_colors?: any[];
  vision_textures?: string[];
  vision_patterns?: string[];
  vision_materials?: string[];
  vision_style_tags?: string[];
  related_product_ids?: string[];
}

interface ScoredProduct extends Product {
  similarity_score: number;
  match_reasons: string[];
}

/**
 * Calculate similarity score between two products
 */
function calculateSimilarity(source: Product, target: Product): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Category match (high weight)
  if (source.category && target.category && source.category === target.category) {
    score += 25;
    reasons.push('same_category');
  }

  // Brand match
  if (source.brand && target.brand && source.brand.toLowerCase() === target.brand.toLowerCase()) {
    score += 10;
    reasons.push('same_brand');
  }

  // Tag overlap
  if (source.tags?.length && target.tags?.length) {
    const sourceTags = new Set(source.tags.map(t => t.toLowerCase()));
    const targetTags = new Set(target.tags.map(t => t.toLowerCase()));
    const overlap = [...sourceTags].filter(t => targetTags.has(t));
    if (overlap.length > 0) {
      score += Math.min(overlap.length * 5, 20);
      reasons.push(`${overlap.length}_tags_match`);
    }
  }

  // Color palette overlap
  if (source.color_palette?.length && target.color_palette?.length) {
    const sourceColors = new Set(source.color_palette.map(c => c.toLowerCase()));
    const targetColors = new Set(target.color_palette.map(c => c.toLowerCase()));
    const colorOverlap = [...sourceColors].filter(c => targetColors.has(c));
    if (colorOverlap.length > 0) {
      score += Math.min(colorOverlap.length * 5, 15);
      reasons.push(`${colorOverlap.length}_colors_match`);
    }
  }

  // Material match
  if (source.material && target.material && source.material.toLowerCase() === target.material.toLowerCase()) {
    score += 10;
    reasons.push('same_material');
  }

  // Texture match
  if (source.texture && target.texture && source.texture.toLowerCase() === target.texture.toLowerCase()) {
    score += 8;
    reasons.push('same_texture');
  }

  // Tone match
  if (source.tone && target.tone && source.tone.toLowerCase() === target.tone.toLowerCase()) {
    score += 12;
    reasons.push('same_tone');
  }

  // Vision-based matching (when available)
  if (source.vision_textures?.length && target.vision_textures?.length) {
    const overlap = source.vision_textures.filter(t => target.vision_textures!.includes(t));
    if (overlap.length > 0) {
      score += Math.min(overlap.length * 5, 15);
      reasons.push('vision_texture_match');
    }
  }

  if (source.vision_patterns?.length && target.vision_patterns?.length) {
    const overlap = source.vision_patterns.filter(p => target.vision_patterns!.includes(p));
    if (overlap.length > 0) {
      score += Math.min(overlap.length * 5, 15);
      reasons.push('vision_pattern_match');
    }
  }

  if (source.vision_style_tags?.length && target.vision_style_tags?.length) {
    const overlap = source.vision_style_tags.filter(s => target.vision_style_tags!.includes(s));
    if (overlap.length > 0) {
      score += Math.min(overlap.length * 5, 15);
      reasons.push('vision_style_match');
    }
  }

  // Price similarity (within 30% range)
  if (source.price && target.price) {
    const priceDiff = Math.abs(source.price - target.price) / source.price;
    if (priceDiff < 0.3) {
      score += 5;
      reasons.push('similar_price');
    }
  }

  return { score, reasons };
}

/**
 * Find related products for a given product
 */
async function findRelatedProducts(
  supabase: any,
  productId: string,
  limit: number = 10,
  useCache: boolean = true
): Promise<ScoredProduct[]> {
  // Fetch the source product
  const { data: sourceProduct, error: sourceError } = await supabase
    .from('enriched_products')
    .select('*')
    .eq('id', productId)
    .single() as { data: Product | null; error: any };

  if (sourceError || !sourceProduct) {
    throw new Error(`Product not found: ${productId}`);
  }

  // Check cache first
  if (useCache && sourceProduct.related_product_ids && sourceProduct.related_product_ids.length > 0) {
    const { data: cachedProducts } = await supabase
      .from('enriched_products')
      .select('*')
      .in('id', sourceProduct.related_product_ids.slice(0, limit)) as { data: Product[] | null; error: any };

    if (cachedProducts && cachedProducts.length > 0) {
      log.info({ productId, cachedCount: cachedProducts.length }, 'Using cached related products');
      return cachedProducts.map((p: Product) => ({
        ...p,
        similarity_score: 1, // Cached, so we don't have exact scores
        match_reasons: ['cached']
      }));
    }
  }

  // Build query for candidate products - fetch all and filter in memory to avoid type issues
  const { data: allCandidates, error: candidateError } = await supabase
    .from('enriched_products')
    .select('*')
    .neq('id', productId)
    .limit(200) as { data: Product[] | null; error: any }; // Get a larger pool to score

  // Filter by category in memory if available
  let candidates = allCandidates;
  if (candidates && sourceProduct.category) {
    const sourceCategory = sourceProduct.category.toLowerCase();
    candidates = candidates.filter((p: Product) =>
      (p.category && p.category.toLowerCase() === sourceCategory) ||
      (p.tags && p.tags.some(t => t.toLowerCase() === sourceCategory))
    );
    // If filtering reduced too much, fall back to all candidates
    if (candidates.length < 10 && allCandidates) {
      candidates = allCandidates;
    }
  }

  if (candidateError) {
    throw new Error(`Failed to fetch candidates: ${candidateError.message}`);
  }

  if (!candidates || candidates.length === 0) {
    return [];
  }

  // Score all candidates
  const scored: ScoredProduct[] = candidates
    .map((candidate: Product) => {
      const { score, reasons } = calculateSimilarity(sourceProduct as Product, candidate);
      return {
        ...candidate,
        similarity_score: score,
        match_reasons: reasons
      };
    })
    .filter((p: ScoredProduct) => p.similarity_score > 0)
    .sort((a: ScoredProduct, b: ScoredProduct) => b.similarity_score - a.similarity_score)
    .slice(0, limit);

  // Cache the results
  if (scored.length > 0) {
    const relatedIds = scored.map((p: ScoredProduct) => p.id);
    await supabase
      .from('enriched_products')
      .update({ related_product_ids: relatedIds } as any)
      .eq('id', productId);

    log.info({ productId, relatedCount: relatedIds.length }, 'Cached related product IDs');
  }

  return scored;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply middleware
  const handled = await applyMiddleware(req, res);
  if (handled) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get parameters
  const productId = (req.method === 'GET' ? req.query.product_id : req.body?.product_id) as string;
  const limit = parseInt((req.method === 'GET' ? req.query.limit : req.body?.limit) as string || '10', 10);
  const useCache = (req.method === 'GET' ? req.query.cache !== 'false' : req.body?.cache !== false);

  if (!productId) {
    return res.status(400).json({
      error: 'Missing product_id parameter',
      usage: 'GET /api/related-products?product_id=xxx&limit=10'
    });
  }

  try {
    const startTime = Date.now();
    const related = await findRelatedProducts(supabase, productId, limit, useCache);

    log.info({
      productId,
      resultCount: related.length,
      duration: Date.now() - startTime
    }, 'Related products found');

    return res.status(200).json({
      success: true,
      product_id: productId,
      related_products: related.map(p => ({
        id: p.id,
        product_name: p.product_name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        image_url: p.image_url,
        similarity_score: p.similarity_score,
        match_reasons: p.match_reasons,
        tags: p.tags,
        color_palette: p.color_palette
      })),
      total: related.length
    });

  } catch (error) {
    log.error({ error, productId }, 'Related products lookup failed');
    return res.status(500).json({
      error: 'Failed to find related products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
