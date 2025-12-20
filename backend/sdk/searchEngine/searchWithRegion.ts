/**
 * Region-Enhanced Product Search
 * Task 16: Region-Aware Product Recommendation
 *
 * Extends tag-based search with region scoring and boosting.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TagSearchInput, SearchResult, ClaudeSearchParams } from './types';
import { EnrichedProduct } from '../productEnrichment/types';
import {
  RegionMatcher,
  createRegionMatcher,
  RegionSearchContext,
  RegionExtraction,
} from '../region';

/**
 * Extended search input with region context
 */
export interface RegionSearchInput extends TagSearchInput {
  /** User's account/preference region */
  userRegion?: string;
  /** Whether to apply region scoring (default: true) */
  applyRegionScoring?: boolean;
  /** Minimum region score threshold (0-1) */
  minRegionScore?: number;
}

/**
 * Extended search result with region information
 */
export interface RegionSearchResult extends SearchResult {
  /** Extracted region from query */
  regionExtraction?: RegionExtraction;
  /** Products with region scores */
  scoredResults?: Array<EnrichedProduct & { regionScore: number }>;
}

/**
 * Region-Enhanced Search Engine
 */
export class RegionSearchEngine {
  private supabase: SupabaseClient;
  private regionMatcher: RegionMatcher;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.regionMatcher = createRegionMatcher();
  }

  /**
   * Search with region-aware scoring
   */
  async searchWithRegionScoring(
    searchParams: RegionSearchInput
  ): Promise<RegionSearchResult> {
    const {
      category,
      tags,
      region,
      userRegion,
      limit = 50,
      applyRegionScoring = true,
      minRegionScore = 0,
    } = searchParams;

    // Build base query
    let query = this.supabase.from('enriched_products').select('*');

    if (category) {
      query = query.eq('category', category);
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    // Don't filter by exact region - we'll score instead
    // Fetch more results to allow for scoring and filtering
    const fetchLimit = applyRegionScoring ? Math.min(limit * 3, 200) : limit;
    query = query.limit(fetchLimit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Region search failed: ${error.message}`);
    }

    const products = (data as EnrichedProduct[]) || [];

    // If no region scoring needed, return as-is
    if (!applyRegionScoring) {
      return {
        results: products.slice(0, limit),
        count: products.length,
        query: searchParams,
      };
    }

    // Build region context
    const queryRegions: string[] = [];
    if (region) {
      queryRegions.push(region);
      // Also add related regions
      const related = this.regionMatcher.getRelatedRegions(region);
      queryRegions.push(...related);
    }

    const context: RegionSearchContext = {
      query: tags?.join(' ') || '',
      queryRegions: [...new Set(queryRegions)],
      userRegion,
      preferLocal: !!userRegion,
    };

    // Score and sort products by region
    const scoredProducts = products
      .map((product) => ({
        ...product,
        regionScore: this.regionMatcher.calculateRegionScore(
          product.region,
          context
        ),
      }))
      .filter((p) => p.regionScore >= minRegionScore)
      .sort((a, b) => b.regionScore - a.regionScore)
      .slice(0, limit);

    return {
      results: scoredProducts,
      count: scoredProducts.length,
      query: searchParams,
      scoredResults: scoredProducts,
    };
  }

  /**
   * Search by natural language prompt with region extraction
   */
  async searchByPromptWithRegion(
    prompt: string,
    parsedParams: ClaudeSearchParams,
    options?: {
      userRegion?: string;
      limit?: number;
    }
  ): Promise<RegionSearchResult> {
    // Extract regions from prompt
    const regionExtraction = this.regionMatcher.extractRegionFromText(prompt);

    // Combine parsed region with extracted regions
    const allRegions = new Set<string>();
    if (parsedParams.region) {
      allRegions.add(parsedParams.region);
    }
    regionExtraction.regions.forEach((r) => allRegions.add(r));

    // Build search params
    const searchParams: RegionSearchInput = {
      category: parsedParams.category || undefined,
      tags: parsedParams.tags,
      region: regionExtraction.primary || parsedParams.region || undefined,
      userRegion: options?.userRegion,
      limit: options?.limit || 50,
      applyRegionScoring: true,
    };

    const result = await this.searchWithRegionScoring(searchParams);

    return {
      ...result,
      regionExtraction,
    };
  }

  /**
   * Get products from a specific region with related regions
   */
  async getProductsByRegion(
    region: string,
    options?: {
      includeRelated?: boolean;
      limit?: number;
    }
  ): Promise<RegionSearchResult> {
    const { includeRelated = true, limit = 50 } = options || {};

    // Get related regions
    const regions = includeRelated
      ? this.regionMatcher.getRelatedRegions(region)
      : [region];

    // Query products from any of these regions
    const { data, error } = await this.supabase
      .from('enriched_products')
      .select('*')
      .in('region', regions)
      .limit(limit);

    if (error) {
      throw new Error(`Region product search failed: ${error.message}`);
    }

    const products = (data as EnrichedProduct[]) || [];

    // Score by proximity to requested region
    const context: RegionSearchContext = {
      query: region,
      queryRegions: [region],
    };

    const scoredProducts = products
      .map((product) => ({
        ...product,
        regionScore: this.regionMatcher.calculateRegionScore(
          product.region,
          context
        ),
      }))
      .sort((a, b) => b.regionScore - a.regionScore);

    return {
      results: scoredProducts,
      count: scoredProducts.length,
      query: { region, limit },
      scoredResults: scoredProducts,
    };
  }

  /**
   * Get global products (no specific region or multi-region)
   */
  async getGlobalProducts(limit: number = 50): Promise<SearchResult> {
    const { data, error } = await this.supabase
      .from('enriched_products')
      .select('*')
      .or('region.is.null,region.eq.Global')
      .limit(limit);

    if (error) {
      throw new Error(`Global product search failed: ${error.message}`);
    }

    return {
      results: (data as EnrichedProduct[]) || [],
      count: data?.length || 0,
      query: { limit },
    };
  }

  /**
   * Get region distribution of products
   */
  async getRegionDistribution(): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('enriched_products')
      .select('region');

    if (error) {
      throw new Error(`Region distribution query failed: ${error.message}`);
    }

    const distribution: Record<string, number> = {};
    for (const product of data || []) {
      const region = product.region || 'Unspecified';
      distribution[region] = (distribution[region] || 0) + 1;
    }

    return distribution;
  }
}

/**
 * Factory function
 */
export function createRegionSearchEngine(
  supabaseUrl: string,
  supabaseKey: string
): RegionSearchEngine {
  return new RegionSearchEngine(supabaseUrl, supabaseKey);
}
