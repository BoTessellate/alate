/**
 * Batch Product Enrichment
 * Processes multiple products with AI enrichment
 *
 * Extracted from backend/api/ai.ts (lines 680-872)
 */

import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../../shared/logger';
import {
  callClaude,
  callClaudeWithVision,
  callGemini,
  callGeminiWithVision,
  callOpenAI,
  callOpenAIWithVision,
  parseJSONFromResponse
} from '../../shared/secureAI';
import { withTimeout, TIMEOUT_CONFIGS } from '../../shared/timeout';
import type { AIEnrichmentResponse, BatchEnrichmentResult, PendingProduct } from './types';

const log = createModuleLogger('batch-enricher');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

/**
 * Batch enrich all pending products without enriched_at timestamp
 * Used by admin dashboard to retry enrichment
 */
export async function enrichProductBatch(options?: {
  limit?: number;
}): Promise<BatchEnrichmentResult> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database not configured');
  }

  const startTime = Date.now();
  const limit = options?.limit || 20;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get products without enriched_at
  const { data: pendingProducts, error: fetchError } = await supabase
    .from('enriched_products')
    .select('id, product_name, brand, image_url, source_url, price, description')
    .is('enriched_at', null)
    .limit(limit);

  if (fetchError) {
    log.error({ error: fetchError }, 'Failed to fetch pending products');
    throw new Error('Failed to fetch pending products');
  }

  if (!pendingProducts || pendingProducts.length === 0) {
    return {
      success: true,
      message: 'No products pending enrichment',
      enriched_count: 0,
      failed_count: 0,
      total_processed: 0,
      duration_ms: Date.now() - startTime,
      results: []
    };
  }

  log.info({ count: pendingProducts.length }, 'Starting batch enrichment...');

  let enrichedCount = 0;
  let failedCount = 0;
  const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

  // Process each product
  for (const product of pendingProducts as PendingProduct[]) {
    try {
      log.info({ id: product.id, name: product.product_name }, 'Enriching product...');

      // Build enrichment prompt
      const hasImage = !!product.image_url;
      const prompt = buildBatchEnrichmentPrompt(product, hasImage);

      // Try Gemini → GPT-4o-mini → Claude fallback chain with timeout
      let aiResponse: AIEnrichmentResponse;
      let modelUsed = 'gemini';

      if (hasImage) {
        aiResponse = await withTimeout(
          () => callGeminiWithVision(prompt, product.image_url!, { maxTokens: 800 }),
          TIMEOUT_CONFIGS.AI,
          'Batch Gemini vision'
        );
        if (!aiResponse.success) {
          aiResponse = await withTimeout(
            () => callOpenAIWithVision(prompt, product.image_url!, { maxTokens: 800 }),
            TIMEOUT_CONFIGS.AI,
            'Batch GPT-4o-mini vision'
          );
          modelUsed = 'gpt-4o-mini';
        }
        if (!aiResponse.success) {
          aiResponse = await withTimeout(
            () => callClaudeWithVision(prompt, product.image_url!, { maxTokens: 800 }),
            TIMEOUT_CONFIGS.AI,
            'Batch Claude vision'
          );
          modelUsed = 'claude';
        }
      } else {
        aiResponse = await withTimeout(
          () => callGemini(prompt, { maxTokens: 600 }),
          TIMEOUT_CONFIGS.AI,
          'Batch Gemini'
        );
        if (!aiResponse.success) {
          aiResponse = await withTimeout(
            () => callOpenAI(prompt, { maxTokens: 600 }),
            TIMEOUT_CONFIGS.AI,
            'Batch GPT-4o-mini'
          );
          modelUsed = 'gpt-4o-mini';
        }
        if (!aiResponse.success) {
          aiResponse = await withTimeout(
            () => callClaude(prompt, { maxTokens: 600 }),
            TIMEOUT_CONFIGS.AI,
            'Batch Claude'
          );
          modelUsed = 'claude';
        }
      }

      let enrichment = null;
      if (aiResponse.success && aiResponse.text) {
        enrichment = parseJSONFromResponse(aiResponse.text);
      }

      if (!enrichment) {
        enrichment = {
          tags: ['product'],
          material: null,
          texture: null,
          tone: 'neutral',
          category: 'general',
        };
        modelUsed = 'defaults';
      }

      // Update the product with enrichment data
      const { error: updateError } = await supabase
        .from('enriched_products')
        .update({
          tags: enrichment.tags || [],
          material: enrichment.material || null,
          texture: enrichment.texture || null,
          tone: enrichment.tone || null,
          category: enrichment.category || 'general',
          vibe_layer: enrichment.vibe_layer || null,
          pairs_with: enrichment.pairs_with || [],
          enriched_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      enrichedCount++;
      results.push({ id: product.id, name: product.product_name, success: true });
      log.info({ id: product.id, name: product.product_name, modelUsed }, 'Product enriched successfully');

    } catch (productError) {
      failedCount++;
      results.push({
        id: product.id,
        name: product.product_name,
        success: false,
        error: productError instanceof Error ? productError.message : 'Unknown error',
      });
      log.error({ id: product.id, error: productError }, 'Failed to enrich product');
    }
  }

  const duration = Date.now() - startTime;
  log.info({ enrichedCount, failedCount, duration }, 'Batch enrichment complete');

  return {
    success: true,
    message: `Enriched ${enrichedCount} products${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
    enriched_count: enrichedCount,
    failed_count: failedCount,
    total_processed: pendingProducts.length,
    duration_ms: duration,
    results,
  };
}

/**
 * Builds a simplified enrichment prompt for batch operations
 */
function buildBatchEnrichmentPrompt(product: PendingProduct, hasImage: boolean): string {
  return `You are a luxury lifestyle and product analyst. Analyze this product and return comprehensive metadata.
${hasImage ? '\nIMPORTANT: A product image is provided. Use visual analysis to identify textures, materials, and style details.' : ''}
Product Information:
- Name: ${product.product_name || 'Unknown'}
- Brand: ${product.brand || 'Unknown'}
- Description: ${product.description || 'N/A'}
- Price: ${product.price || 'N/A'}
- Source: ${product.source_url || 'N/A'}

Return a JSON object with these fields:
{
  "tags": ["10-15 descriptive tags covering style, occasion, season, aesthetic, mood"],
  "material": "primary material",
  "texture": "tactile quality",
  "tone": "overall mood/atmosphere",
  "category": "specific category (e.g., blazers-jackets, dresses, tops, bottoms, accessories, furniture, lighting)",
  "vibe_layer": "how this fits into a lifestyle mood board",
  "pairs_with": ["2-3 complementary categories"]
}
Return ONLY valid JSON.`;
}
