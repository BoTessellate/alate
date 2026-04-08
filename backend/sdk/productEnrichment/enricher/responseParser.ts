/**
 * Response Parser for AI Enrichment
 * Parses and validates AI responses for product enrichment
 *
 * Extracted from backend/api/ai.ts (lines 607-626)
 */

import { parseJSONFromResponse } from '../../shared/secureAI';
import type { AIEnrichmentResponse, ParsedEnrichment } from './types';

/**
 * Parses AI enrichment response and returns structured data
 * Falls back to defaults if parsing fails
 */
export function parseEnrichmentResponse(
  aiResponse: AIEnrichmentResponse,
  inferredBrand?: string,
  productBrand?: string
): ParsedEnrichment | null {
  if (!aiResponse.success || !aiResponse.text) {
    return null;
  }

  try {
    const enrichment = parseJSONFromResponse(aiResponse.text);
    return enrichment;
  } catch (error) {
    // Return defaults if parsing fails
    return {
      brand: inferredBrand || productBrand || 'Unknown',
      tags: ['product', 'fashion'],
      material: undefined,
      texture: undefined,
      tone: 'neutral',
      category: 'general'
    };
  }
}
