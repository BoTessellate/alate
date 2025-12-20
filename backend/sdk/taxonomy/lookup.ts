/**
 * Taxonomy Lookup Module
 * Functions for tag matching, normalization, and category validation
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
export interface CategoryDefinition {
  description: string;
  subcategories: string[];
  tags: string[];
  aliases: Record<string, string>;
}

export interface Taxonomy {
  [category: string]: CategoryDefinition;
}

export interface TagMatchResult {
  original: string;
  canonical: string;
  category: string | null;
  isValid: boolean;
}

export interface NormalizationResult {
  canonical_tags: string[];
  unmatched_tags: string[];
  category: string | null;
  subcategory: string | null;
}

// Load taxonomy from JSON file
let taxonomyCache: Taxonomy | null = null;

export function loadTaxonomy(): Taxonomy {
  if (taxonomyCache) {
    return taxonomyCache;
  }

  const taxonomyPath = path.resolve(__dirname, '../../taxonomy/taxonomy.json');
  const content = fs.readFileSync(taxonomyPath, 'utf-8');
  taxonomyCache = JSON.parse(content) as Taxonomy;
  return taxonomyCache;
}

/**
 * Clear taxonomy cache (useful for testing)
 */
export function clearTaxonomyCache(): void {
  taxonomyCache = null;
}

/**
 * Get all valid categories
 */
export function getCategories(): string[] {
  const taxonomy = loadTaxonomy();
  return Object.keys(taxonomy);
}

/**
 * Get subcategories for a category
 */
export function getSubcategories(category: string): string[] {
  const taxonomy = loadTaxonomy();
  const normalizedCategory = category.toLowerCase();

  if (taxonomy[normalizedCategory]) {
    return taxonomy[normalizedCategory].subcategories;
  }

  return [];
}

/**
 * Get all valid tags for a category
 */
export function getCategoryTags(category: string): string[] {
  const taxonomy = loadTaxonomy();
  const normalizedCategory = category.toLowerCase();

  if (taxonomy[normalizedCategory]) {
    return taxonomy[normalizedCategory].tags;
  }

  return [];
}

/**
 * Get all valid tags across all categories
 */
export function getAllTags(): string[] {
  const taxonomy = loadTaxonomy();
  const allTags = new Set<string>();

  for (const category of Object.values(taxonomy)) {
    for (const tag of category.tags) {
      allTags.add(tag);
    }
  }

  return Array.from(allTags);
}

/**
 * Get aliases for a category
 */
export function getAliases(category: string): Record<string, string> {
  const taxonomy = loadTaxonomy();
  const normalizedCategory = category.toLowerCase();

  if (taxonomy[normalizedCategory]) {
    return taxonomy[normalizedCategory].aliases;
  }

  return {};
}

/**
 * Get all aliases across all categories
 */
export function getAllAliases(): Record<string, string> {
  const taxonomy = loadTaxonomy();
  const allAliases: Record<string, string> = {};

  for (const category of Object.values(taxonomy)) {
    Object.assign(allAliases, category.aliases);
  }

  return allAliases;
}

/**
 * Normalize a single tag using aliases
 * @param tag - Raw tag input
 * @param category - Optional category to scope alias lookup
 * @returns Normalized canonical tag
 */
export function normalizeTag(tag: string, category?: string): string {
  const normalizedInput = tag.toLowerCase().trim();

  // Check category-specific aliases first if category provided
  if (category) {
    const categoryAliases = getAliases(category);
    if (categoryAliases[normalizedInput]) {
      return categoryAliases[normalizedInput];
    }
  }

  // Check all aliases
  const allAliases = getAllAliases();
  if (allAliases[normalizedInput]) {
    return allAliases[normalizedInput];
  }

  // Return as-is if no alias found
  return normalizedInput;
}

/**
 * Match a tag to the taxonomy
 * @param tag - Raw tag input
 * @param category - Optional category to scope matching
 * @returns Match result with canonical tag and validation status
 */
export function matchTag(tag: string, category?: string): TagMatchResult {
  const normalizedTag = normalizeTag(tag, category);

  // If category provided, check that category first
  if (category) {
    const categoryTags = getCategoryTags(category);
    if (categoryTags.includes(normalizedTag)) {
      return {
        original: tag,
        canonical: normalizedTag,
        category: category.toLowerCase(),
        isValid: true
      };
    }
  }

  // Search all categories
  const taxonomy = loadTaxonomy();
  for (const [cat, definition] of Object.entries(taxonomy)) {
    if (definition.tags.includes(normalizedTag)) {
      return {
        original: tag,
        canonical: normalizedTag,
        category: cat,
        isValid: true
      };
    }
  }

  // Tag not found in taxonomy
  return {
    original: tag,
    canonical: normalizedTag,
    category: null,
    isValid: false
  };
}

/**
 * Validate and normalize a category
 * @param input - Raw category input
 * @returns Normalized category or null if invalid
 */
export function validateCategory(input: string): string | null {
  const taxonomy = loadTaxonomy();
  const normalized = input.toLowerCase().trim();

  if (taxonomy[normalized]) {
    return normalized;
  }

  return null;
}

/**
 * Validate and normalize a subcategory within a category
 * @param category - Parent category
 * @param subcategory - Subcategory to validate
 * @returns Normalized subcategory or null if invalid
 */
export function validateSubcategory(category: string, subcategory: string): string | null {
  const subcategories = getSubcategories(category);
  const normalized = subcategory.toLowerCase().trim();

  if (subcategories.includes(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Normalize an array of tags
 * @param tags - Array of raw tags
 * @param category - Optional category to scope normalization
 * @returns Normalization result with canonical and unmatched tags
 */
export function normalizeTags(tags: string[], category?: string): NormalizationResult {
  const canonical_tags: string[] = [];
  const unmatched_tags: string[] = [];
  let detectedCategory: string | null = null;
  let detectedSubcategory: string | null = null;

  // Validate category if provided
  if (category) {
    detectedCategory = validateCategory(category);
  }

  for (const tag of tags) {
    const result = matchTag(tag, category);

    if (result.isValid) {
      // Add to canonical if not already present
      if (!canonical_tags.includes(result.canonical)) {
        canonical_tags.push(result.canonical);
      }

      // Detect category from first valid tag if not provided
      if (!detectedCategory && result.category) {
        detectedCategory = result.category;
      }
    } else {
      // Keep track of unmatched tags
      if (!unmatched_tags.includes(result.canonical)) {
        unmatched_tags.push(result.canonical);
      }
    }
  }

  return {
    canonical_tags,
    unmatched_tags,
    category: detectedCategory,
    subcategory: detectedSubcategory
  };
}

/**
 * Find best matching category for a set of tags
 * @param tags - Array of tags
 * @returns Best matching category or null
 */
export function detectCategory(tags: string[]): string | null {
  const taxonomy = loadTaxonomy();
  const categoryScores: Record<string, number> = {};

  for (const tag of tags) {
    const normalizedTag = normalizeTag(tag);

    for (const [cat, definition] of Object.entries(taxonomy)) {
      if (definition.tags.includes(normalizedTag)) {
        categoryScores[cat] = (categoryScores[cat] || 0) + 1;
      }
    }
  }

  // Return category with highest score
  let bestCategory: string | null = null;
  let bestScore = 0;

  for (const [cat, score] of Object.entries(categoryScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

/**
 * Suggest valid tags based on partial input
 * @param partial - Partial tag input
 * @param category - Optional category to scope suggestions
 * @param limit - Maximum suggestions to return
 * @returns Array of suggested canonical tags
 */
export function suggestTags(partial: string, category?: string, limit: number = 5): string[] {
  const normalized = partial.toLowerCase().trim();
  const suggestions: string[] = [];

  // Get tags to search
  const tagsToSearch = category ? getCategoryTags(category) : getAllTags();

  // First: exact prefix matches
  for (const tag of tagsToSearch) {
    if (tag.startsWith(normalized) && !suggestions.includes(tag)) {
      suggestions.push(tag);
    }
    if (suggestions.length >= limit) return suggestions;
  }

  // Second: contains matches
  for (const tag of tagsToSearch) {
    if (tag.includes(normalized) && !suggestions.includes(tag)) {
      suggestions.push(tag);
    }
    if (suggestions.length >= limit) return suggestions;
  }

  return suggestions;
}

/**
 * Get related tags (tags commonly found in the same category)
 * @param tag - Input tag
 * @returns Array of related tags from the same category
 */
export function getRelatedTags(tag: string): string[] {
  const result = matchTag(tag);

  if (result.isValid && result.category) {
    const categoryTags = getCategoryTags(result.category);
    // Return all tags except the input tag
    return categoryTags.filter(t => t !== result.canonical);
  }

  return [];
}

/**
 * Validate a complete product taxonomy assignment
 * @param category - Product category
 * @param subcategory - Product subcategory
 * @param tags - Product tags
 * @returns Validation result
 */
export function validateProductTaxonomy(
  category: string,
  subcategory?: string,
  tags?: string[]
): { isValid: boolean; errors: string[]; normalized: NormalizationResult } {
  const errors: string[] = [];

  // Validate category
  const validCategory = validateCategory(category);
  if (!validCategory) {
    errors.push(`Invalid category: "${category}"`);
  }

  // Validate subcategory if provided
  if (subcategory && validCategory) {
    const validSubcategory = validateSubcategory(validCategory, subcategory);
    if (!validSubcategory) {
      errors.push(`Invalid subcategory "${subcategory}" for category "${validCategory}"`);
    }
  }

  // Normalize and validate tags
  const normalized = normalizeTags(tags || [], validCategory || undefined);

  if (normalized.unmatched_tags.length > 0) {
    errors.push(`Unknown tags: ${normalized.unmatched_tags.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalized
  };
}
