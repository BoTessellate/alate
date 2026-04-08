/**
 * Types for product enrichment orchestrator
 */

export interface RawProduct {
  name: string;
  description?: string;
  brand?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  source_url?: string;
}

export interface EnrichedProduct extends RawProduct {
  tags: string[];
  color_palette: string[];
  material?: string;
  texture?: string;
  tone?: string;
  category?: string;
  vibe_layer?: string;
  pairs_with?: string[];
  enriched_at?: string;
}

export interface AIEnrichmentResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface EnrichmentOptions {
  demoMode?: boolean;
}

export interface PromptBuildOptions {
  product: RawProduct;
  inferredBrand?: string;
  sourceUrl?: string;
  hasImage: boolean;
  colorContext: string;
  fewShotExamples: string;
}

export interface ParsedEnrichment {
  brand?: string;
  tags?: string[];
  color_palette?: string[];
  material?: string;
  texture?: string;
  tone?: string;
  category?: string;
  vibe_layer?: string;
  pairs_with?: string[];
}

export interface TagCorrection {
  product_id: string;
  brand?: string;
  category?: string;
  ai_generated_tags: string[];
  user_final_tags: string[];
  created_at: string;
}

export interface BatchEnrichmentResult {
  success: boolean;
  message: string;
  enriched_count: number;
  failed_count: number;
  total_processed: number;
  duration_ms: number;
  results: Array<{
    id: string;
    name: string;
    success: boolean;
    error?: string;
  }>;
}

export interface PendingProduct {
  id: string;
  product_name: string;
  brand?: string;
  image_url?: string;
  source_url?: string;
  price?: number;
  description?: string;
}
