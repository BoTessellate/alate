/**
 * Tag-Based Product Search
 * Query enriched products by category, tags, and region
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TagSearchInput, SearchResult } from './types';
import { EnrichedProduct } from '../productEnrichment/types';

export class TagSearchEngine {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Search enriched products by tags, category, and region
   * @param searchParams - Tag search parameters
   * @returns Search results with matched products
   */
  async searchByTag(searchParams: TagSearchInput): Promise<SearchResult> {
    const { category, tags, region, limit = 50 } = searchParams;

    // Build query
    let query = this.supabase
      .from('enriched_products')
      .select('*');

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Filter by tags (array contains at least one input tag)
    if (tags && tags.length > 0) {
      // Use overlaps operator for array matching
      query = query.overlaps('tags', tags);
    }

    // Filter by region
    if (region) {
      query = query.eq('region', region);
    }

    // Apply limit
    query = query.limit(limit);

    // Execute query
    const { data, error } = await query;

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return {
      results: (data as EnrichedProduct[]) || [],
      count: data?.length || 0,
      query: searchParams
    };
  }

  /**
   * Search by single tag
   * @param tag - Single tag to search
   * @param limit - Maximum results
   */
  async searchByOneTag(tag: string, limit: number = 20): Promise<SearchResult> {
    return this.searchByTag({ tags: [tag], limit });
  }

  /**
   * Search by category only
   * @param category - Category to filter
   * @param limit - Maximum results
   */
  async searchByCategory(category: string, limit: number = 20): Promise<SearchResult> {
    return this.searchByTag({ category, limit });
  }

  /**
   * Search by region only
   * @param region - Region to filter
   * @param limit - Maximum results
   */
  async searchByRegion(region: string, limit: number = 20): Promise<SearchResult> {
    return this.searchByTag({ region, limit });
  }

  /**
   * Advanced search with multiple filters and sorting
   * @param searchParams - Search parameters
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort direction
   */
  async advancedSearch(
    searchParams: TagSearchInput,
    sortBy: 'created_at' | 'price' | 'product_name' = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<SearchResult> {
    const { category, tags, region, limit = 50 } = searchParams;

    let query = this.supabase
      .from('enriched_products')
      .select('*');

    if (category) {
      query = query.eq('category', category);
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    if (region) {
      query = query.eq('region', region);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Advanced search failed: ${error.message}`);
    }

    return {
      results: (data as EnrichedProduct[]) || [],
      count: data?.length || 0,
      query: searchParams
    };
  }
}

/**
 * Factory function to create TagSearchEngine
 */
export function createTagSearchEngine(supabaseUrl: string, supabaseKey: string): TagSearchEngine {
  return new TagSearchEngine(supabaseUrl, supabaseKey);
}
