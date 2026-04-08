/**
 * Product Tagger Module
 * Task 20: Category & Tag Taxonomy Builder
 *
 * Normalizes raw input to valid tag paths using the taxonomy
 * Handles Claude-prompt-based and local fallback tagging
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeTag,
  matchTag,
  normalizeTags,
  validateCategory,
  detectCategory,
  suggestTags,
  getRelatedTags,
  TagMatchResult,
  NormalizationResult
} from '../taxonomy';
import {
  TopCategory,
  TagFamily,
  getTagFamily,
  groupTagsByFamily,
  TAG_FAMILIES
} from '../taxonomy/categoryTree';

// ============================================================================
// Types
// ============================================================================

export interface TagGlossaryEntry {
  definition: string;
  synonyms: string[];
}

export interface TagGlossary {
  version: string;
  description: string;
  tags: Record<TagFamily, Record<string, TagGlossaryEntry>>;
  global_aliases: Record<string, string>;
}

export interface TaggerResult {
  /** Normalized canonical tags */
  tags: string[];
  /** Detected or validated category */
  category: string | null;
  /** Detected subcategory */
  subcategory: string | null;
  /** Tags grouped by family */
  tagsByFamily: Record<TagFamily, string[]>;
  /** Tags that couldn't be matched */
  unmatchedTags: string[];
  /** Suggestions for unmatched tags */
  suggestions: Record<string, string[]>;
}

export interface TaggerOptions {
  /** Category to scope tag matching */
  category?: string;
  /** Auto-detect category from tags */
  autoDetectCategory?: boolean;
  /** Include suggestions for unmatched tags */
  includeSuggestions?: boolean;
  /** Maximum suggestions per unmatched tag */
  maxSuggestions?: number;
}

// ============================================================================
// Glossary Loading
// ============================================================================

let glossaryCache: TagGlossary | null = null;

/**
 * Load the tag glossary from JSON
 */
export function loadGlossary(): TagGlossary {
  if (glossaryCache) {
    return glossaryCache;
  }

  const glossaryPath = path.resolve(__dirname, '../../taxonomy/tagGlossary.json');
  const content = fs.readFileSync(glossaryPath, 'utf-8');
  glossaryCache = JSON.parse(content) as TagGlossary;
  return glossaryCache;
}

/**
 * Clear glossary cache (for testing)
 */
export function clearGlossaryCache(): void {
  glossaryCache = null;
}

/**
 * Get tag definition from glossary
 */
export function getTagDefinition(tag: string): TagGlossaryEntry | null {
  const glossary = loadGlossary();
  const normalizedTag = tag.toLowerCase();

  for (const familyTags of Object.values(glossary.tags)) {
    if (familyTags[normalizedTag]) {
      return familyTags[normalizedTag];
    }
  }

  return null;
}

// ============================================================================
// Main Tagger Functions
// ============================================================================

/**
 * Tag a product with normalized taxonomy tags
 *
 * @param rawTags - Raw tags from input or Claude enrichment
 * @param options - Tagger options
 * @returns Tagger result with normalized tags and metadata
 */
export function tagProduct(
  rawTags: string[],
  options: TaggerOptions = {}
): TaggerResult {
  const {
    category,
    autoDetectCategory = true,
    includeSuggestions = true,
    maxSuggestions = 3
  } = options;

  // Step 1: Normalize tags using taxonomy
  const normalization = normalizeTags(rawTags, category);

  // Step 2: Detect category if not provided and auto-detect enabled
  let detectedCategory = normalization.category;
  if (!detectedCategory && autoDetectCategory && normalization.canonical_tags.length > 0) {
    detectedCategory = detectCategory(normalization.canonical_tags);
  }

  // Step 3: Group tags by family
  const tagsByFamily = groupTagsByFamily(normalization.canonical_tags);

  // Step 4: Get suggestions for unmatched tags
  const suggestions: Record<string, string[]> = {};
  if (includeSuggestions && normalization.unmatched_tags.length > 0) {
    for (const unmatchedTag of normalization.unmatched_tags) {
      const tagSuggestions = suggestTags(unmatchedTag, detectedCategory || undefined, maxSuggestions);
      if (tagSuggestions.length > 0) {
        suggestions[unmatchedTag] = tagSuggestions;
      }
    }
  }

  return {
    tags: normalization.canonical_tags,
    category: detectedCategory,
    subcategory: normalization.subcategory,
    tagsByFamily,
    unmatchedTags: normalization.unmatched_tags,
    suggestions
  };
}

/**
 * Normalize a single tag with full context
 */
export function normalizeProductTag(
  tag: string,
  category?: string
): TagMatchResult & { family: TagFamily | null; definition: string | null } {
  const result = matchTag(tag, category);
  const family = result.isValid ? getTagFamily(result.canonical) : null;
  const glossaryEntry = getTagDefinition(result.canonical);

  return {
    ...result,
    family,
    definition: glossaryEntry?.definition || null
  };
}

/**
 * Resolve synonyms from the glossary
 */
export function resolveSynonym(input: string): string {
  const glossary = loadGlossary();
  const normalized = input.toLowerCase().trim();

  // Check global aliases first
  if (glossary.global_aliases[normalized]) {
    return glossary.global_aliases[normalized];
  }

  // Check synonyms in each tag family
  for (const familyTags of Object.values(glossary.tags)) {
    for (const [canonicalTag, entry] of Object.entries(familyTags)) {
      if (entry.synonyms.some(s => s.toLowerCase() === normalized)) {
        return canonicalTag;
      }
    }
  }

  // Return original if no synonym found
  return normalized;
}

/**
 * Enrich tags by adding related tags from the same family
 */
export function enrichTags(
  tags: string[],
  maxPerFamily: number = 2
): string[] {
  const enriched = new Set(tags);
  const byFamily = groupTagsByFamily(tags);

  // For each family with tags, add related tags
  for (const [family, familyTags] of Object.entries(byFamily)) {
    if (familyTags.length > 0) {
      // Get related tags for the first tag in each family
      const related = getRelatedTags(familyTags[0]);
      let added = 0;
      for (const relatedTag of related) {
        if (!enriched.has(relatedTag) && added < maxPerFamily) {
          enriched.add(relatedTag);
          added++;
        }
      }
    }
  }

  return Array.from(enriched);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that tags are from approved taxonomy
 */
export function validateTags(tags: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const tag of tags) {
    const result = matchTag(tag);
    if (result.isValid) {
      valid.push(result.canonical);
    } else {
      invalid.push(tag);
    }
  }

  return { valid, invalid };
}

/**
 * Check if all tags are from the approved taxonomy
 */
export function areTagsValid(tags: string[]): boolean {
  const { invalid } = validateTags(tags);
  return invalid.length === 0;
}

/**
 * Get all valid tags for a category
 */
export function getValidTagsForCategory(category: string): string[] {
  const validCategory = validateCategory(category);
  if (!validCategory) {
    return [];
  }

  // Combine category-specific tags with global tags from each family
  const allTags = new Set<string>();

  for (const familyTags of Object.values(TAG_FAMILIES)) {
    for (const tag of familyTags) {
      allTags.add(tag);
    }
  }

  return Array.from(allTags);
}

// ============================================================================
// Claude Integration Helper
// ============================================================================

/**
 * Build a prompt hint for Claude with valid tag examples
 *
 * @param category - Product category
 * @returns Tag examples for Claude prompt
 */
export function getTagPromptHint(category?: string): string {
  const families = Object.entries(TAG_FAMILIES);

  const examples = families.map(([family, tags]) => {
    const sampleTags = tags.slice(0, 4).join(', ');
    return `- ${family}: ${sampleTags}...`;
  }).join('\n');

  return `Use tags from these families:\n${examples}`;
}

/**
 * Post-process Claude's tag output to normalize against taxonomy
 */
export function processClaudeTags(
  claudeTags: string[],
  category?: string
): TaggerResult {
  // First resolve any synonyms
  const resolvedTags = claudeTags.map(resolveSynonym);

  // Then run through the tagger
  return tagProduct(resolvedTags, {
    category,
    autoDetectCategory: true,
    includeSuggestions: true
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  TagMatchResult,
  NormalizationResult
} from '../taxonomy';

export {
  TopCategory,
  TagFamily,
  TAG_FAMILIES,
  getTagFamily,
  groupTagsByFamily
} from '../taxonomy/categoryTree';
