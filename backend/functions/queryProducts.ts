/**
 * Query Products Function
 * Task 19: Unified Filter & Sort System
 *
 * Accepts query params for filters + sorting, returns filtered products
 * Used by Edge Function and direct API calls
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  filterAndSortProducts,
  getFilterMetadata,
} from '../sdk/searchEngine/filterEngine';
import {
  ProductFilters,
  SortConfig,
  ThemeColors,
  FilterResult,
  FilterMetadata,
  FilterSortQuery,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
} from '../sdk/searchEngine/schema/filters';
import { EnrichedProduct } from '../sdk/productEnrichment/types';

// ============================================================================
// Types
// ============================================================================

export interface QueryProductsRequest {
  /** Filter configuration */
  filters?: ProductFilters;
  /** Sort configuration */
  sort?: SortConfig;
  /** Theme colors for color match sorting */
  themeColors?: ThemeColors;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Include filter metadata in response */
  includeMetadata?: boolean;
  /** Brand ID to scope results */
  brandId?: string;
}

export interface QueryProductsResponse {
  success: boolean;
  data?: FilterResult;
  metadata?: FilterMetadata;
  error?: string;
}

// ============================================================================
// Main Query Function
// ============================================================================

/**
 * Query products with filters and sorting
 *
 * @param request - Query request with filters, sort, pagination
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service role key
 */
export async function queryProducts(
  request: QueryProductsRequest,
  supabaseUrl: string,
  supabaseKey: string
): Promise<QueryProductsResponse> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all products from database
    // In production, you might want to push some filters to the database query
    const products = await fetchProductsFromDb(supabase, request.brandId);

    // Apply filters, sort, and paginate
    const result = filterAndSortProducts(
      products,
      request.filters,
      request.sort,
      request.themeColors,
      request.page || DEFAULT_PAGE,
      request.limit || DEFAULT_LIMIT
    );

    // Optionally include filter metadata
    let metadata: FilterMetadata | undefined;
    if (request.includeMetadata) {
      // Get metadata from unfiltered products for accurate counts
      const allProducts = request.filters
        ? await fetchProductsFromDb(supabase, request.brandId)
        : products;
      metadata = getFilterMetadata(allProducts);
    }

    return {
      success: true,
      data: result,
      metadata,
    };
  } catch (error) {
    console.error('[queryProducts] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query products',
    };
  }
}

/**
 * Fetch products from Supabase
 */
async function fetchProductsFromDb(
  supabase: SupabaseClient,
  brandId?: string
): Promise<EnrichedProduct[]> {
  let query = supabase.from('products').select('*');

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return (data || []) as EnrichedProduct[];
}

// ============================================================================
// HTTP Handler (for direct API usage)
// ============================================================================

/**
 * HTTP request handler for queryProducts
 * Used by Express/Fastify routes
 */
export async function queryProductsHandler(
  req: { body: QueryProductsRequest; headers?: Record<string, string> },
  supabaseUrl: string,
  supabaseKey: string
): Promise<QueryProductsResponse> {
  const request = req.body;

  // Validate request
  if (!request) {
    return { success: false, error: 'Request body required' };
  }

  return queryProducts(request, supabaseUrl, supabaseKey);
}

// ============================================================================
// Edge Function Helper
// ============================================================================

/**
 * Parse filter query from URL search params
 * Used for GET requests
 */
export function parseFilterQueryFromParams(
  params: URLSearchParams
): FilterSortQuery {
  const query: FilterSortQuery = {};

  // Parse filters
  const filters: ProductFilters = {};

  const region = params.get('region');
  if (region) filters.region = region;

  const regionFuzzy = params.get('regionFuzzy');
  if (regionFuzzy === 'true') filters.regionFuzzy = true;

  const categories = params.get('categories');
  if (categories) {
    filters.categories = categories.split(',') as any;
  }

  const tags = params.get('tags');
  if (tags) {
    filters.tags = tags.split(',') as any;
  }

  const colorFamilies = params.get('colorFamilies');
  if (colorFamilies) {
    filters.colorFamilies = colorFamilies.split(',') as any;
  }

  const brands = params.get('brands');
  if (brands) {
    filters.brands = brands.split(',');
  }

  const minPrice = params.get('minPrice');
  const maxPrice = params.get('maxPrice');
  if (minPrice || maxPrice) {
    filters.priceRange = {
      min: minPrice ? parseFloat(minPrice) : undefined,
      max: maxPrice ? parseFloat(maxPrice) : undefined,
    };
  }

  const searchText = params.get('q') || params.get('search');
  if (searchText) filters.searchText = searchText;

  const hasImage = params.get('hasImage');
  if (hasImage === 'true') filters.hasImage = true;

  if (Object.keys(filters).length > 0) {
    query.filters = filters;
  }

  // Parse sort
  const sortField = params.get('sortBy');
  const sortDirection = params.get('sortDir') || 'asc';
  if (sortField) {
    query.sort = {
      field: sortField as any,
      direction: sortDirection as any,
    };
  }

  // Parse theme colors
  const themePrimary = params.get('themePrimary');
  if (themePrimary) {
    query.themeColors = {
      primary: themePrimary,
      secondary: params.get('themeSecondary') || undefined,
      accent: params.get('themeAccent') || undefined,
    };
  }

  // Parse pagination
  const page = params.get('page');
  if (page) query.page = parseInt(page, 10);

  const limit = params.get('limit');
  if (limit) query.limit = parseInt(limit, 10);

  return query;
}

// ============================================================================
// Quick Filter Presets
// ============================================================================

/**
 * Predefined filter presets for common use cases
 */
export const FILTER_PRESETS = {
  /** Only sustainable/eco products */
  sustainable: {
    tags: ['sustainable', 'organic', 'eco-friendly'],
  } as ProductFilters,

  /** Luxury brands only */
  luxury: {
    tags: ['luxury'],
  } as ProductFilters,

  /** Under $100 */
  budget: {
    priceRange: { max: 100 },
  } as ProductFilters,

  /** $100-$500 */
  midRange: {
    priceRange: { min: 100, max: 500 },
  } as ProductFilters,

  /** Over $500 */
  highEnd: {
    priceRange: { min: 500 },
  } as ProductFilters,

  /** Neutral colors only */
  neutrals: {
    colorFamilies: ['neutrals'],
  } as ProductFilters,

  /** Home category */
  home: {
    categories: ['home'],
  } as ProductFilters,

  /** Fashion (womenswear + menswear) */
  fashion: {
    categories: ['womenswear', 'menswear', 'accessories', 'footwear', 'bags'],
  } as ProductFilters,
};

/**
 * Apply a preset filter
 */
export function applyFilterPreset(
  presetName: keyof typeof FILTER_PRESETS,
  existingFilters?: ProductFilters
): ProductFilters {
  const preset = FILTER_PRESETS[presetName];
  if (!preset) return existingFilters || {};

  return {
    ...existingFilters,
    ...preset,
  };
}
