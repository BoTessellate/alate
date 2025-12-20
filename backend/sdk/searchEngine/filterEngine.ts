/**
 * Filter Engine
 * Task 19: Unified Filter & Sort System
 *
 * Core filter/sort logic using pure functions
 * Frontend-agnostic, reusable across native app, Canva plugin, and web views
 */

import { EnrichedProduct } from '../productEnrichment/types';
import { RegionMatcher } from '../region/regionMatcher';
import {
  ProductFilters,
  SortConfig,
  SortField,
  SortDirection,
  ThemeColors,
  ColorFamily,
  FilterResult,
  FilterMetadata,
  COLOR_FAMILY_KEYWORDS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  ProductCategory,
  SubTag,
} from './schema/filters';

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Filter products by region (exact or fuzzy)
 */
export function filterByRegion(
  products: EnrichedProduct[],
  region: string,
  fuzzy: boolean = false
): EnrichedProduct[] {
  if (!region) return products;

  if (fuzzy) {
    const matcher = new RegionMatcher();
    return products.filter((p) => {
      if (!p.region) return false;
      const match = matcher.matchRegion(p.region, region);
      return match.score > 0.3; // Threshold for fuzzy match
    });
  }

  const regionLower = region.toLowerCase();
  return products.filter(
    (p) => p.region?.toLowerCase() === regionLower
  );
}

/**
 * Filter products by categories (multi-select)
 */
export function filterByCategories(
  products: EnrichedProduct[],
  categories: ProductCategory[]
): EnrichedProduct[] {
  if (!categories || categories.length === 0) return products;

  const categorySet = new Set(categories.map((c) => c.toLowerCase()));
  return products.filter((p) =>
    categorySet.has(p.category?.toLowerCase() || '')
  );
}

/**
 * Filter products by tags (multi-select, any match)
 */
export function filterByTags(
  products: EnrichedProduct[],
  tags: SubTag[]
): EnrichedProduct[] {
  if (!tags || tags.length === 0) return products;

  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  return products.filter((p) => {
    const productTags = (p.tags || []).map((t) => t.toLowerCase());
    return productTags.some((t) => tagSet.has(t));
  });
}

/**
 * Map a color string to its color family
 */
export function getColorFamily(color: string): ColorFamily | null {
  const colorLower = color.toLowerCase();

  for (const [family, keywords] of Object.entries(COLOR_FAMILY_KEYWORDS)) {
    if (keywords.some((kw) => colorLower.includes(kw))) {
      return family as ColorFamily;
    }
  }

  return null;
}

/**
 * Filter products by color families
 */
export function filterByColorFamilies(
  products: EnrichedProduct[],
  colorFamilies: ColorFamily[]
): EnrichedProduct[] {
  if (!colorFamilies || colorFamilies.length === 0) return products;

  const familySet = new Set(colorFamilies);

  return products.filter((p) => {
    const palette = p.color_palette || [];
    return palette.some((color) => {
      const family = getColorFamily(color);
      return family && familySet.has(family);
    });
  });
}

/**
 * Filter products by brands (multi-select)
 */
export function filterByBrands(
  products: EnrichedProduct[],
  brands: string[]
): EnrichedProduct[] {
  if (!brands || brands.length === 0) return products;

  const brandSet = new Set(brands.map((b) => b.toLowerCase()));
  return products.filter((p) =>
    brandSet.has(p.brand?.toLowerCase() || '')
  );
}

/**
 * Filter products by price range
 */
export function filterByPriceRange(
  products: EnrichedProduct[],
  min?: number,
  max?: number
): EnrichedProduct[] {
  return products.filter((p) => {
    const price = p.price;
    if (price === undefined || price === null) return false;

    if (min !== undefined && price < min) return false;
    if (max !== undefined && price > max) return false;

    return true;
  });
}

/**
 * Filter products by text search
 */
export function filterBySearchText(
  products: EnrichedProduct[],
  searchText: string
): EnrichedProduct[] {
  if (!searchText || searchText.trim() === '') return products;

  const query = searchText.toLowerCase().trim();
  const terms = query.split(/\s+/);

  return products.filter((p) => {
    const searchableText = [
      p.product_name,
      p.brand,
      p.category,
      ...(p.tags || []),
      p.material,
      p.texture,
      p.tone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return terms.every((term) => searchableText.includes(term));
  });
}

/**
 * Apply all filters to products
 */
export function applyFilters(
  products: EnrichedProduct[],
  filters: ProductFilters
): EnrichedProduct[] {
  let result = [...products];

  // Region filter
  if (filters.region) {
    result = filterByRegion(result, filters.region, filters.regionFuzzy);
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    result = filterByCategories(result, filters.categories);
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    result = filterByTags(result, filters.tags);
  }

  // Color family filter
  if (filters.colorFamilies && filters.colorFamilies.length > 0) {
    result = filterByColorFamilies(result, filters.colorFamilies);
  }

  // Brand filter
  if (filters.brands && filters.brands.length > 0) {
    result = filterByBrands(result, filters.brands);
  }

  // Price range filter
  if (filters.priceRange) {
    result = filterByPriceRange(
      result,
      filters.priceRange.min,
      filters.priceRange.max
    );
  }

  // Text search filter
  if (filters.searchText) {
    result = filterBySearchText(result, filters.searchText);
  }

  // Has image filter
  if (filters.hasImage) {
    result = result.filter((p) => {
      // Check for any image source - could be in variants or a direct property
      return p.variants?.some((v) => v.image_url) || Boolean((p as any).image_url);
    });
  }

  return result;
}

// ============================================================================
// Sort Functions
// ============================================================================

/**
 * Calculate color match score against theme colors
 */
export function calculateColorMatchScore(
  product: EnrichedProduct,
  themeColors: ThemeColors
): number {
  const palette = product.color_palette || [];
  if (palette.length === 0) return 0;

  const themeColorList = [
    themeColors.primary,
    themeColors.secondary,
    themeColors.accent,
  ].filter(Boolean) as string[];

  if (themeColorList.length === 0) return 0;

  // Simple color name matching (for more accurate matching, use a color distance library)
  let matchScore = 0;

  for (const paletteColor of palette) {
    const paletteFamily = getColorFamily(paletteColor);
    if (!paletteFamily) continue;

    for (const themeColor of themeColorList) {
      const themeFamily = getColorFamily(themeColor);
      if (themeFamily === paletteFamily) {
        matchScore += 25; // Same family match
      }
    }
  }

  return Math.min(100, matchScore);
}

/**
 * Sort products by a single field
 */
export function sortProducts(
  products: EnrichedProduct[],
  sortConfig: SortConfig,
  themeColors?: ThemeColors
): EnrichedProduct[] {
  const { field, direction } = sortConfig;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...products].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'price':
        const priceA = a.price ?? Infinity;
        const priceB = b.price ?? Infinity;
        comparison = priceA - priceB;
        break;

      case 'colorMatch':
        if (!themeColors) return 0;
        const scoreA = calculateColorMatchScore(a, themeColors);
        const scoreB = calculateColorMatchScore(b, themeColors);
        comparison = scoreA - scoreB;
        break;

      case 'createdAt':
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        comparison = dateA - dateB;
        break;

      case 'updatedAt':
        const updateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const updateB = new Date(b.updated_at || b.created_at || 0).getTime();
        comparison = updateA - updateB;
        break;

      case 'brand':
        comparison = (a.brand || '').localeCompare(b.brand || '');
        break;

      case 'productName':
        comparison = (a.product_name || '').localeCompare(b.product_name || '');
        break;

      case 'popularity':
        // Phase 2: implement with view/purchase counts
        comparison = 0;
        break;

      case 'relevance':
        // For search results, maintain original order (relevance from search)
        comparison = 0;
        break;

      default:
        comparison = 0;
    }

    return comparison * multiplier;
  });
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Paginate products
 */
export function paginateProducts(
  products: EnrichedProduct[],
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT
): { products: EnrichedProduct[]; totalPages: number } {
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const safePage = Math.max(1, page);

  const totalPages = Math.ceil(products.length / safeLimit);
  const startIndex = (safePage - 1) * safeLimit;
  const endIndex = startIndex + safeLimit;

  return {
    products: products.slice(startIndex, endIndex),
    totalPages,
  };
}

// ============================================================================
// Main Filter & Sort Function
// ============================================================================

/**
 * Apply filters, sort, and paginate products
 * Main entry point for the filter engine
 */
export function filterAndSortProducts(
  products: EnrichedProduct[],
  filters?: ProductFilters,
  sort?: SortConfig,
  themeColors?: ThemeColors,
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT
): FilterResult {
  // Step 1: Apply filters
  let result = filters ? applyFilters(products, filters) : [...products];
  const totalCount = result.length;

  // Step 2: Sort
  if (sort) {
    result = sortProducts(result, sort, themeColors);
  }

  // Step 3: Paginate
  const { products: paginatedProducts, totalPages } = paginateProducts(
    result,
    page,
    limit
  );

  return {
    products: paginatedProducts,
    totalCount,
    page,
    limit,
    totalPages,
    appliedFilters: filters || {},
    appliedSort: sort,
  };
}

// ============================================================================
// Metadata Functions
// ============================================================================

/**
 * Extract available filter options from products
 * Used for dynamic filter UI rendering
 */
export function getFilterMetadata(products: EnrichedProduct[]): FilterMetadata {
  const categoryCounts = new Map<ProductCategory, number>();
  const brandCounts = new Map<string, number>();
  const tagCounts = new Map<SubTag, number>();
  const colorFamilyCounts = new Map<ColorFamily, number>();
  const regionCounts = new Map<string, number>();
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const product of products) {
    // Category
    if (product.category) {
      const cat = product.category.toLowerCase() as ProductCategory;
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    }

    // Brand
    if (product.brand) {
      brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
    }

    // Tags
    for (const tag of product.tags || []) {
      const tagLower = tag.toLowerCase() as SubTag;
      tagCounts.set(tagLower, (tagCounts.get(tagLower) || 0) + 1);
    }

    // Color families
    for (const color of product.color_palette || []) {
      const family = getColorFamily(color);
      if (family) {
        colorFamilyCounts.set(family, (colorFamilyCounts.get(family) || 0) + 1);
      }
    }

    // Region
    if (product.region) {
      regionCounts.set(product.region, (regionCounts.get(product.region) || 0) + 1);
    }

    // Price range
    if (product.price !== undefined && product.price !== null) {
      minPrice = Math.min(minPrice, product.price);
      maxPrice = Math.max(maxPrice, product.price);
    }
  }

  // Convert maps to sorted arrays
  const mapToArray = <T>(map: Map<T, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    categories: mapToArray(categoryCounts) as { value: ProductCategory; count: number }[],
    brands: mapToArray(brandCounts) as { value: string; count: number }[],
    tags: mapToArray(tagCounts) as { value: SubTag; count: number }[],
    colorFamilies: mapToArray(colorFamilyCounts) as { value: ColorFamily; count: number }[],
    regions: mapToArray(regionCounts),
    priceRange: {
      min: minPrice === Infinity ? 0 : minPrice,
      max: maxPrice === -Infinity ? 0 : maxPrice,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  ProductFilters,
  SortConfig,
  SortField,
  SortDirection,
  ThemeColors,
  ColorFamily,
  FilterResult,
  FilterMetadata,
} from './schema/filters';
