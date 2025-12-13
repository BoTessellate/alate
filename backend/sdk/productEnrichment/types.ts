/**
 * Product Enrichment Types
 * Moodlayer SDK - Day 1
 */

export interface RawProductInput {
  product_name: string;
  brand: string;
  category: string;
  price?: number;
  region?: string;
  dimensions?: string;
}

export interface EnrichedProductFields {
  color_palette: string[];
  tags: string[];
  texture: string;
  material: string;
  tone: string;
  flags?: string[];
}

export interface EnrichedProduct extends RawProductInput, EnrichedProductFields {
  id?: string;
  enriched_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClaudeEnrichmentResponse {
  color_palette: string[];
  tags: string[];
  texture: string;
  material: string;
  tone: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface EnrichmentConfig {
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  model?: string;
}
