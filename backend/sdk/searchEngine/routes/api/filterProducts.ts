/**
 * Filter Products API Endpoint
 * Task 19: Unified Filter & Sort System
 *
 * REST API for product filtering, sorting, and metadata
 * Exposes filter API for all clients (native app, Canva plugin, web)
 */

import { Request, Response } from 'express';
import {
  queryProducts,
  parseFilterQueryFromParams,
  QueryProductsRequest,
  FILTER_PRESETS,
  applyFilterPreset,
} from '../../../../functions/queryProducts';
import {
  filterAndSortProducts,
  getFilterMetadata,
} from '../../filterEngine';
import {
  SORT_OPTIONS,
  CATEGORIES,
  SUB_TAGS,
  COLOR_FAMILIES,
} from '../../schema/filters';

// ============================================================================
// Filter Products Handler
// ============================================================================

/**
 * POST /api/products/filter
 * Apply filters and sorting to products
 *
 * Request body:
 * {
 *   filters?: {
 *     region?: string,
 *     regionFuzzy?: boolean,
 *     categories?: string[],
 *     tags?: string[],
 *     colorFamilies?: string[],
 *     brands?: string[],
 *     priceRange?: { min?: number, max?: number },
 *     searchText?: string,
 *     hasImage?: boolean
 *   },
 *   sort?: { field: string, direction: 'asc' | 'desc' },
 *   themeColors?: { primary: string, secondary?: string, accent?: string },
 *   page?: number,
 *   limit?: number,
 *   includeMetadata?: boolean,
 *   brandId?: string
 * }
 */
export async function filterProductsHandler(req: Request, res: Response) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Supabase credentials missing',
      });
    }

    const request: QueryProductsRequest = req.body || {};

    const result = await queryProducts(request, supabaseUrl, supabaseKey);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[filterProducts] Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Filter operation failed',
      message: error.message,
    });
  }
}

/**
 * GET /api/products/filter
 * Apply filters via query parameters
 *
 * Query parameters:
 * - region: string
 * - regionFuzzy: boolean
 * - categories: comma-separated
 * - tags: comma-separated
 * - colorFamilies: comma-separated
 * - brands: comma-separated
 * - minPrice: number
 * - maxPrice: number
 * - q / search: text search
 * - hasImage: boolean
 * - sortBy: field name
 * - sortDir: asc | desc
 * - themePrimary: hex color
 * - themeSecondary: hex color
 * - themeAccent: hex color
 * - page: number
 * - limit: number
 * - preset: preset name
 * - brandId: string
 */
export async function filterProductsGetHandler(req: Request, res: Response) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Supabase credentials missing',
      });
    }

    // Parse filters from query params
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const query = parseFilterQueryFromParams(params);

    // Apply preset if specified
    const presetName = params.get('preset');
    if (presetName && presetName in FILTER_PRESETS) {
      query.filters = applyFilterPreset(
        presetName as keyof typeof FILTER_PRESETS,
        query.filters
      );
    }

    const request: QueryProductsRequest = {
      filters: query.filters,
      sort: query.sort,
      themeColors: query.themeColors,
      page: query.page,
      limit: query.limit,
      includeMetadata: params.get('includeMetadata') === 'true',
      brandId: params.get('brandId') || undefined,
    };

    const result = await queryProducts(request, supabaseUrl, supabaseKey);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[filterProducts GET] Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Filter operation failed',
      message: error.message,
    });
  }
}

// ============================================================================
// Filter Metadata Handler
// ============================================================================

/**
 * GET /api/products/filter/metadata
 * Get available filter options with counts
 *
 * Query parameters:
 * - brandId: scope to specific brand
 */
export async function filterMetadataHandler(req: Request, res: Response) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
      });
    }

    const brandId = req.query.brandId as string | undefined;

    // Get products and extract metadata
    const result = await queryProducts(
      { includeMetadata: true, brandId },
      supabaseUrl,
      supabaseKey
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error('[filterMetadata] Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to get filter metadata',
    });
  }
}

// ============================================================================
// Filter Options Handler
// ============================================================================

/**
 * GET /api/products/filter/options
 * Get all available filter and sort options (static)
 */
export async function filterOptionsHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    options: {
      categories: CATEGORIES,
      tags: SUB_TAGS,
      colorFamilies: COLOR_FAMILIES,
      sortOptions: SORT_OPTIONS,
      presets: Object.keys(FILTER_PRESETS),
    },
  });
}

// ============================================================================
// Filter Presets Handler
// ============================================================================

/**
 * GET /api/products/filter/presets
 * Get all available filter presets
 */
export async function filterPresetsHandler(_req: Request, res: Response) {
  const presetsWithDetails = Object.entries(FILTER_PRESETS).map(
    ([name, filters]) => ({
      name,
      filters,
      description: getPresetDescription(name),
    })
  );

  return res.json({
    success: true,
    presets: presetsWithDetails,
  });
}

/**
 * Get human-readable description for preset
 */
function getPresetDescription(presetName: string): string {
  const descriptions: Record<string, string> = {
    sustainable: 'Eco-friendly and sustainable products',
    luxury: 'Premium luxury items',
    budget: 'Products under $100',
    midRange: 'Products between $100-$500',
    highEnd: 'Premium products over $500',
    neutrals: 'Neutral color palette',
    home: 'Home decor and furnishings',
    fashion: 'Fashion and apparel',
  };

  return descriptions[presetName] || presetName;
}

// ============================================================================
// Route Setup
// ============================================================================

/**
 * Express route setup for filter API
 */
export function setupFilterRoutes(app: any) {
  // Main filter endpoints
  app.post('/api/products/filter', filterProductsHandler);
  app.get('/api/products/filter', filterProductsGetHandler);

  // Metadata and options
  app.get('/api/products/filter/metadata', filterMetadataHandler);
  app.get('/api/products/filter/options', filterOptionsHandler);
  app.get('/api/products/filter/presets', filterPresetsHandler);
}

// ============================================================================
// Export Types for Frontend
// ============================================================================

export {
  ProductFilters,
  SortConfig,
  ThemeColors,
  FilterResult,
  FilterMetadata,
  ColorFamily,
  ProductCategory,
  SubTag,
  SortField,
  SortDirection,
  SORT_OPTIONS,
  CATEGORIES,
  SUB_TAGS,
  COLOR_FAMILIES,
} from '../../schema/filters';
