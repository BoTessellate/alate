/**
 * Product Enrichment Orchestrator
 * Handles single product enrichment with AI fallback chain and color extraction
 *
 * Extracted from backend/api/ai.ts (lines 444-674)
 */

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
import { extractAndNameColors } from '../colorExtractor';
import { withTimeout, isTimeoutError, TIMEOUT_CONFIGS } from '../../shared/timeout';
import { buildEnrichmentPrompt } from './promptBuilder';
import { parseEnrichmentResponse } from './responseParser';
import { getDemoEnrichment } from './demoMode';
import {
  getRecentTagCorrections,
  buildFewShotExamples
} from './tagFeedback';
import { inferBrand } from './brandInference';
import type {
  RawProduct,
  EnrichedProduct,
  AIEnrichmentResponse,
  EnrichmentOptions
} from './types';

const log = createModuleLogger('enricher');

/**
 * Enriches a single product with AI-generated metadata
 * Uses demo mode if configured, otherwise calls AI with fallback chain
 */
export async function enrichProduct(
  product: RawProduct,
  options?: EnrichmentOptions
): Promise<EnrichedProduct> {
  const demoMode = options?.demoMode || false;
  const sourceUrl = product.source_url;

  // Infer brand from URL or product name
  const inferredBrand = inferBrand(product.name, sourceUrl);
  log.info({ productName: product.name, inferredBrand }, 'Starting enrichment');

  // Extract colors from image using pixel-level analysis (if image available)
  let extractedColors = null;
  if (product.image_url) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_KEY || '';
      extractedColors = await extractAndNameColors(product.image_url, supabaseUrl, supabaseKey);
      if (extractedColors) {
        log.info({ productName: product.name, colors: extractedColors.colorNames }, 'Colors extracted');
      }
    } catch (colorError) {
      log.warn({ productName: product.name, error: colorError }, 'Color extraction failed, will use AI fallback');
    }
  }

  // Demo mode: return mock data
  if (demoMode) {
    const demoEnrichment = getDemoEnrichment(product.name);
    const enrichedProduct: EnrichedProduct = {
      ...product,
      brand: inferredBrand || product.brand,
      tags: demoEnrichment.tags,
      color_palette: extractedColors?.colorNames || demoEnrichment.color_palette,
      material: demoEnrichment.material,
      texture: demoEnrichment.texture,
      tone: extractedColors?.warmth || demoEnrichment.tone,
      category: demoEnrichment.category,
      enriched_at: new Date().toISOString()
    };

    log.info({ productName: product.name, brand: inferredBrand, demoMode: true }, 'Using demo enrichment data');
    return enrichedProduct;
  }

  // Fetch recent tag corrections for few-shot learning
  const recentCorrections = await getRecentTagCorrections(inferredBrand, undefined, 5);
  const fewShotExamples = buildFewShotExamples(recentCorrections);

  // Build enrichment prompt
  const hasImage = !!product.image_url;
  const colorContext = extractedColors
    ? `\nACCURATE COLORS (from pixel analysis): ${extractedColors.colorNames.join(', ')} (${extractedColors.warmth} palette)`
    : '';

  const prompt = buildEnrichmentPrompt({
    product,
    inferredBrand,
    sourceUrl,
    hasImage,
    colorContext,
    fewShotExamples
  });

  log.info({
    productName: product.name,
    inferredBrand,
    hasImage,
    fewShotCount: recentCorrections.length
  }, 'Calling AI for enrichment (Gemini → GPT-4o-mini → Claude)...');

  // Try AI providers with fallback chain
  let aiResponse: AIEnrichmentResponse;
  let modelUsed = 'gemini';

  try {
    if (hasImage) {
      // Try Gemini first with timeout
      aiResponse = await withTimeout(
        () => callGeminiWithVision(prompt, product.image_url!, { maxTokens: 1000 }),
        TIMEOUT_CONFIGS.AI,
        'Gemini vision enrichment'
      );
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'Gemini vision failed, trying GPT-4o-mini...');
        aiResponse = await withTimeout(
          () => callOpenAIWithVision(prompt, product.image_url!, { maxTokens: 1000 }),
          TIMEOUT_CONFIGS.AI,
          'GPT-4o-mini vision enrichment'
        );
        modelUsed = 'gpt-4o-mini';
      }
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'GPT-4o-mini vision failed, trying Claude...');
        aiResponse = await withTimeout(
          () => callClaudeWithVision(prompt, product.image_url!, { maxTokens: 1000 }),
          TIMEOUT_CONFIGS.AI,
          'Claude vision enrichment'
        );
        modelUsed = 'claude-fallback';
      }
    } else {
      // Text-only enrichment
      aiResponse = await withTimeout(
        () => callGemini(prompt, { maxTokens: 800 }),
        TIMEOUT_CONFIGS.AI,
        'Gemini enrichment'
      );
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'Gemini failed, trying GPT-4o-mini...');
        aiResponse = await withTimeout(
          () => callOpenAI(prompt, { maxTokens: 800 }),
          TIMEOUT_CONFIGS.AI,
          'GPT-4o-mini enrichment'
        );
        modelUsed = 'gpt-4o-mini';
      }
      if (!aiResponse.success) {
        log.warn({ productName: product.name, error: aiResponse.error }, 'GPT-4o-mini failed, trying Claude...');
        aiResponse = await withTimeout(
          () => callClaude(prompt, { maxTokens: 800 }),
          TIMEOUT_CONFIGS.AI,
          'Claude enrichment'
        );
        modelUsed = 'claude-fallback';
      }
    }
  } catch (error) {
    if (isTimeoutError(error)) {
      log.error({ productName: product.name }, 'AI enrichment timed out');
      throw new Error('ENRICHMENT_TIMEOUT');
    }
    throw error;
  }

  // Parse AI response
  const enrichment = parseEnrichmentResponse(aiResponse, inferredBrand, product.brand);
  if (!enrichment) {
    log.warn({ productName: product.name }, 'Failed to parse AI response, using defaults');
    modelUsed = 'defaults';
  }

  // Use pixel-extracted colors (accurate) over AI-suggested colors
  const finalColorPalette = extractedColors?.colorNames || enrichment?.color_palette || ['neutral'];

  const enrichedProduct: EnrichedProduct = {
    ...product,
    brand: enrichment?.brand || inferredBrand || product.brand || undefined,
    tags: enrichment?.tags || [],
    color_palette: finalColorPalette,
    material: enrichment?.material,
    texture: enrichment?.texture,
    tone: extractedColors?.warmth || enrichment?.tone || 'neutral',
    category: enrichment?.category || 'general',
    vibe_layer: enrichment?.vibe_layer,
    pairs_with: enrichment?.pairs_with || [],
    enriched_at: new Date().toISOString()
  };

  log.info({ productName: product.name, modelUsed }, 'Enrichment complete');

  return enrichedProduct;
}
