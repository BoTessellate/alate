/**
 * Category Tree Schema
 * Task 20: Category & Tag Taxonomy Builder
 *
 * TypeScript definitions for the controlled taxonomy
 */

// ============================================================================
// Category Types
// ============================================================================

/**
 * Top-level product categories
 */
export type TopCategory =
  | 'home'
  | 'fashion'
  | 'beauty'
  | 'art'
  | 'food'
  | 'kids'
  | 'tech'
  | 'wellness'
  | 'pets'
  | 'stationery';

/**
 * Home subcategories
 */
export type HomeSubcategory =
  | 'decor'
  | 'storage'
  | 'bedding'
  | 'lighting'
  | 'furniture'
  | 'kitchen'
  | 'bathroom'
  | 'outdoor';

/**
 * Fashion subcategories
 */
export type FashionSubcategory =
  | 'womenswear'
  | 'menswear'
  | 'kidswear'
  | 'accessories'
  | 'footwear'
  | 'jewelry'
  | 'bags';

/**
 * Beauty subcategories
 */
export type BeautySubcategory =
  | 'skincare'
  | 'makeup'
  | 'haircare'
  | 'fragrance'
  | 'bodycare'
  | 'nailcare'
  | 'tools';

/**
 * Art subcategories
 */
export type ArtSubcategory =
  | 'prints'
  | 'paintings'
  | 'photography'
  | 'sculptures'
  | 'digital'
  | 'mixed-media'
  | 'textiles';

/**
 * Union of all subcategories
 */
export type Subcategory =
  | HomeSubcategory
  | FashionSubcategory
  | BeautySubcategory
  | ArtSubcategory
  | string; // Allow other categories' subcategories

// ============================================================================
// Tag Family Types (Task 20 spec)
// ============================================================================

/**
 * Material tags
 */
export type MaterialTag =
  | 'cotton'
  | 'linen'
  | 'silk'
  | 'bamboo'
  | 'wool'
  | 'cashmere'
  | 'leather'
  | 'canvas'
  | 'ceramic'
  | 'wood'
  | 'metal'
  | 'glass'
  | 'plastic'
  | 'recycled'
  | 'upcycled';

/**
 * Origin tags
 */
export type OriginTag =
  | 'made-in-india'
  | 'japan-origin'
  | 'local-brand'
  | 'imported'
  | 'fair-trade'
  | 'single-origin'
  | 'artisan'
  | 'small-batch';

/**
 * Use-case tags
 */
export type UseCaseTag =
  | 'gifting'
  | 'summer'
  | 'winter'
  | 'spring'
  | 'fall'
  | 'festive'
  | 'everyday'
  | 'special-occasion'
  | 'wedding'
  | 'travel'
  | 'work'
  | 'home'
  | 'outdoor';

/**
 * Sustainability tags
 */
export type SustainabilityTag =
  | 'organic'
  | 'sustainable'
  | 'eco-friendly'
  | 'handwoven'
  | 'handmade'
  | 'upcycled'
  | 'recycled'
  | 'plastic-free'
  | 'vegan'
  | 'cruelty-free'
  | 'fair-trade'
  | 'carbon-neutral';

/**
 * Style tags
 */
export type StyleTag =
  | 'earthy'
  | 'bold'
  | 'monochrome'
  | 'layered'
  | 'minimalist'
  | 'maximalist'
  | 'bohemian'
  | 'modern'
  | 'vintage'
  | 'retro'
  | 'classic'
  | 'contemporary'
  | 'scandinavian'
  | 'industrial'
  | 'rustic'
  | 'coastal'
  | 'farmhouse'
  | 'mid-century'
  | 'eclectic'
  | 'luxurious';

/**
 * All tag families combined
 */
export type TagFamily =
  | 'material'
  | 'origin'
  | 'use-case'
  | 'sustainability'
  | 'style';

/**
 * Union of all tag types
 */
export type TaxonomyTag =
  | MaterialTag
  | OriginTag
  | UseCaseTag
  | SustainabilityTag
  | StyleTag;

// ============================================================================
// Category Tree Structure
// ============================================================================

/**
 * Category definition with subcategories and tags
 */
export interface CategoryDefinition {
  /** Human-readable description */
  description: string;
  /** Valid subcategories */
  subcategories: string[];
  /** Valid tags for this category */
  tags: string[];
  /** Tag aliases (e.g., "boho" -> "bohemian") */
  aliases: Record<string, string>;
}

/**
 * Complete taxonomy structure
 */
export interface CategoryTree {
  [category: string]: CategoryDefinition;
}

// ============================================================================
// Product Taxonomy Assignment
// ============================================================================

/**
 * Product taxonomy output (from enrichment)
 */
export interface ProductTaxonomy {
  /** Top-level category */
  category: TopCategory | string;
  /** Subcategory within the category */
  subcategory?: Subcategory;
  /** Normalized tags from the taxonomy */
  tags: string[];
  /** Original tags before normalization */
  raw_tags?: string[];
  /** Tags that couldn't be matched */
  unmatched_tags?: string[];
}

// ============================================================================
// Tag Family Mappings
// ============================================================================

/**
 * Tag to family mapping
 */
export const TAG_FAMILIES: Record<TagFamily, string[]> = {
  material: [
    'cotton', 'linen', 'silk', 'bamboo', 'wool', 'cashmere',
    'leather', 'canvas', 'ceramic', 'wood', 'metal', 'glass',
    'plastic', 'recycled', 'upcycled'
  ],
  origin: [
    'made-in-india', 'japan-origin', 'local-brand', 'imported',
    'fair-trade', 'single-origin', 'artisan', 'small-batch'
  ],
  'use-case': [
    'gifting', 'summer', 'winter', 'spring', 'fall', 'festive',
    'everyday', 'special-occasion', 'wedding', 'travel', 'work',
    'home', 'outdoor'
  ],
  sustainability: [
    'organic', 'sustainable', 'eco-friendly', 'handwoven', 'handmade',
    'upcycled', 'recycled', 'plastic-free', 'vegan', 'cruelty-free',
    'fair-trade', 'carbon-neutral'
  ],
  style: [
    'earthy', 'bold', 'monochrome', 'layered', 'minimalist', 'maximalist',
    'bohemian', 'modern', 'vintage', 'retro', 'classic', 'contemporary',
    'scandinavian', 'industrial', 'rustic', 'coastal', 'farmhouse',
    'mid-century', 'eclectic', 'luxurious'
  ]
};

/**
 * Get the family for a tag
 */
export function getTagFamily(tag: string): TagFamily | null {
  const normalizedTag = tag.toLowerCase();

  for (const [family, tags] of Object.entries(TAG_FAMILIES)) {
    if (tags.includes(normalizedTag)) {
      return family as TagFamily;
    }
  }

  return null;
}

/**
 * Group tags by family
 */
export function groupTagsByFamily(tags: string[]): Record<TagFamily, string[]> {
  const grouped: Record<TagFamily, string[]> = {
    material: [],
    origin: [],
    'use-case': [],
    sustainability: [],
    style: []
  };

  for (const tag of tags) {
    const family = getTagFamily(tag);
    if (family) {
      grouped[family].push(tag);
    }
  }

  return grouped;
}

// ============================================================================
// Category Constants
// ============================================================================

/**
 * All valid top-level categories
 */
export const TOP_CATEGORIES: TopCategory[] = [
  'home',
  'fashion',
  'beauty',
  'art',
  'food',
  'kids',
  'tech',
  'wellness',
  'pets',
  'stationery'
];

/**
 * Category display names
 */
export const CATEGORY_DISPLAY_NAMES: Record<TopCategory, string> = {
  home: 'Home & Living',
  fashion: 'Fashion',
  beauty: 'Beauty & Personal Care',
  art: 'Art & Prints',
  food: 'Food & Beverages',
  kids: 'Kids & Baby',
  tech: 'Technology',
  wellness: 'Health & Wellness',
  pets: 'Pets',
  stationery: 'Stationery & Office'
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a string is a valid top category
 */
export function isValidCategory(category: string): category is TopCategory {
  return TOP_CATEGORIES.includes(category.toLowerCase() as TopCategory);
}

/**
 * Check if a tag belongs to a specific family
 */
export function isTagInFamily(tag: string, family: TagFamily): boolean {
  return TAG_FAMILIES[family].includes(tag.toLowerCase());
}
