/**
 * Filter & Sort Schema
 * Task 19: Unified Filter & Sort System
 *
 * Types and allowed values for product filtering and sorting
 */

import { EnrichedProduct } from '../../productEnrichment/types';

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Region filter - exact or fuzzy matching
 */
export interface RegionFilter {
  /** Exact region match */
  region?: string;
  /** Fuzzy region matching (includes aliases) */
  regionFuzzy?: boolean;
}

/**
 * Category filter options
 */
export type ProductCategory =
  | 'home'
  | 'womenswear'
  | 'menswear'
  | 'accessories'
  | 'beauty'
  | 'jewelry'
  | 'footwear'
  | 'bags'
  | 'kids'
  | 'lifestyle'
  | 'art'
  | 'other';

/**
 * Sub-tag filter options
 */
export type SubTag =
  | 'organic'
  | 'sustainable'
  | 'handmade'
  | 'vintage'
  | 'gifting'
  | 'luxury'
  | 'minimalist'
  | 'bohemian'
  | 'modern'
  | 'classic'
  | 'artisan'
  | 'eco-friendly';

/**
 * Color family for accessible palette matching
 */
export type ColorFamily =
  | 'neutrals'    // white, black, gray, beige, cream
  | 'earth'       // brown, tan, terracotta, olive
  | 'warm'        // red, orange, yellow, coral, peach
  | 'cool'        // blue, teal, cyan, aqua
  | 'jewel'       // emerald, ruby, sapphire, amethyst
  | 'pastel'      // soft pink, lavender, mint, baby blue
  | 'bold'        // bright, saturated colors
  | 'metallic';   // gold, silver, bronze, copper

/**
 * Price range filter
 */
export interface PriceRange {
  /** Minimum price (inclusive) */
  min?: number;
  /** Maximum price (inclusive) */
  max?: number;
}

/**
 * Complete filter configuration
 */
export interface ProductFilters {
  /** Region filter (exact or fuzzy) */
  region?: string;
  /** Enable fuzzy region matching */
  regionFuzzy?: boolean;

  /** Category filter (single or multi-select) */
  categories?: ProductCategory[];

  /** Sub-tags filter (multi-select) */
  tags?: SubTag[];

  /** Color family filter (multi-select) */
  colorFamilies?: ColorFamily[];

  /** Brand filter (multi-select) */
  brands?: string[];

  /** Price range filter */
  priceRange?: PriceRange;

  /** Text search across product name, brand, tags */
  searchText?: string;

  /** Only show products with images */
  hasImage?: boolean;

  /** Include out of stock products */
  includeOutOfStock?: boolean;
}

// ============================================================================
// Sort Types
// ============================================================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort field options
 */
export type SortField =
  | 'price'
  | 'colorMatch'
  | 'createdAt'
  | 'updatedAt'
  | 'brand'
  | 'productName'
  | 'popularity'   // Phase 2
  | 'relevance';   // For search results

/**
 * Sort configuration
 */
export interface SortConfig {
  /** Field to sort by */
  field: SortField;
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Predefined sort options for UI
 */
export const SORT_OPTIONS: { label: string; value: SortConfig }[] = [
  { label: 'Price: Low to High', value: { field: 'price', direction: 'asc' } },
  { label: 'Price: High to Low', value: { field: 'price', direction: 'desc' } },
  { label: 'Color Match', value: { field: 'colorMatch', direction: 'desc' } },
  { label: 'Recently Added', value: { field: 'createdAt', direction: 'desc' } },
  { label: 'Brand A-Z', value: { field: 'brand', direction: 'asc' } },
  { label: 'Brand Z-A', value: { field: 'brand', direction: 'desc' } },
  { label: 'Name A-Z', value: { field: 'productName', direction: 'asc' } },
  { label: 'Name Z-A', value: { field: 'productName', direction: 'desc' } },
];

// ============================================================================
// Color Match Types
// ============================================================================

/**
 * Theme colors for color matching
 */
export interface ThemeColors {
  /** Primary theme color (hex) */
  primary: string;
  /** Secondary theme color (hex) */
  secondary?: string;
  /** Accent theme color (hex) */
  accent?: string;
}

/**
 * Color match score result
 */
export interface ColorMatchScore {
  /** Product ID */
  productId: string;
  /** Match score 0-100 */
  score: number;
  /** Matching colors from product palette */
  matchingColors: string[];
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Complete filter and sort query
 */
export interface FilterSortQuery {
  /** Filter configuration */
  filters?: ProductFilters;
  /** Sort configuration */
  sort?: SortConfig;
  /** Theme colors for color match sorting */
  themeColors?: ThemeColors;
  /** Pagination: page number (1-indexed) */
  page?: number;
  /** Pagination: items per page */
  limit?: number;
}

/**
 * Filter result with pagination metadata
 */
export interface FilterResult {
  /** Filtered and sorted products */
  products: EnrichedProduct[];
  /** Total count before pagination */
  totalCount: number;
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
  /** Total pages */
  totalPages: number;
  /** Applied filters */
  appliedFilters: ProductFilters;
  /** Applied sort */
  appliedSort?: SortConfig;
}

// ============================================================================
// Filter Metadata (for UI)
// ============================================================================

/**
 * Available filter options with counts
 * Used for dynamic filter UI rendering
 */
export interface FilterMetadata {
  /** Available categories with product counts */
  categories: { value: ProductCategory; count: number }[];
  /** Available brands with product counts */
  brands: { value: string; count: number }[];
  /** Available tags with product counts */
  tags: { value: SubTag; count: number }[];
  /** Available color families with counts */
  colorFamilies: { value: ColorFamily; count: number }[];
  /** Available regions with counts */
  regions: { value: string; count: number }[];
  /** Price range in dataset */
  priceRange: { min: number; max: number };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All available categories
 */
export const CATEGORIES: ProductCategory[] = [
  'home',
  'womenswear',
  'menswear',
  'accessories',
  'beauty',
  'jewelry',
  'footwear',
  'bags',
  'kids',
  'lifestyle',
  'art',
  'other',
];

/**
 * All available sub-tags
 */
export const SUB_TAGS: SubTag[] = [
  'organic',
  'sustainable',
  'handmade',
  'vintage',
  'gifting',
  'luxury',
  'minimalist',
  'bohemian',
  'modern',
  'classic',
  'artisan',
  'eco-friendly',
];

/**
 * All available color families
 */
export const COLOR_FAMILIES: ColorFamily[] = [
  'neutrals',
  'earth',
  'warm',
  'cool',
  'jewel',
  'pastel',
  'bold',
  'metallic',
];

/**
 * Color family to hex range mapping
 * Used for palette matching
 */
export const COLOR_FAMILY_KEYWORDS: Record<ColorFamily, string[]> = {
  neutrals: ['white', 'black', 'gray', 'grey', 'beige', 'cream', 'ivory', 'charcoal'],
  earth: ['brown', 'tan', 'terracotta', 'olive', 'khaki', 'camel', 'sand', 'rust'],
  warm: ['red', 'orange', 'yellow', 'coral', 'peach', 'salmon', 'burgundy', 'maroon'],
  cool: ['blue', 'teal', 'cyan', 'aqua', 'navy', 'sky', 'cobalt', 'turquoise'],
  jewel: ['emerald', 'ruby', 'sapphire', 'amethyst', 'jade', 'garnet', 'topaz'],
  pastel: ['pink', 'lavender', 'mint', 'baby blue', 'blush', 'lilac', 'soft'],
  bold: ['bright', 'vibrant', 'neon', 'electric', 'hot', 'vivid'],
  metallic: ['gold', 'silver', 'bronze', 'copper', 'chrome', 'platinum', 'rose gold'],
};

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT = 100;
