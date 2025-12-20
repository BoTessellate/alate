/**
 * Taxonomy Lookup Tests
 * Tests for tag matching, normalization, and category validation
 */

import {
  loadTaxonomy,
  clearTaxonomyCache,
  getCategories,
  getSubcategories,
  getCategoryTags,
  getAllTags,
  getAliases,
  getAllAliases,
  normalizeTag,
  matchTag,
  validateCategory,
  validateSubcategory,
  normalizeTags,
  detectCategory,
  suggestTags,
  getRelatedTags,
  validateProductTaxonomy
} from './lookup';

describe('Taxonomy Lookup', () => {
  beforeEach(() => {
    clearTaxonomyCache();
  });

  describe('loadTaxonomy', () => {
    it('should load taxonomy from JSON file', () => {
      const taxonomy = loadTaxonomy();
      expect(taxonomy).toBeDefined();
      expect(typeof taxonomy).toBe('object');
    });

    it('should cache taxonomy on subsequent calls', () => {
      const first = loadTaxonomy();
      const second = loadTaxonomy();
      expect(first).toBe(second);
    });
  });

  describe('getCategories', () => {
    it('should return all category names', () => {
      const categories = getCategories();
      expect(categories).toContain('home');
      expect(categories).toContain('fashion');
      expect(categories).toContain('beauty');
      expect(categories).toContain('art');
      expect(categories.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('getSubcategories', () => {
    it('should return subcategories for a valid category', () => {
      const subs = getSubcategories('home');
      expect(subs).toContain('decor');
      expect(subs).toContain('furniture');
    });

    it('should return empty array for invalid category', () => {
      const subs = getSubcategories('nonexistent');
      expect(subs).toEqual([]);
    });

    it('should handle case-insensitive input', () => {
      const subs = getSubcategories('HOME');
      expect(subs.length).toBeGreaterThan(0);
    });
  });

  describe('getCategoryTags', () => {
    it('should return tags for a valid category', () => {
      const tags = getCategoryTags('fashion');
      expect(tags).toContain('organic');
      expect(tags).toContain('casual');
      expect(tags).toContain('vintage');
    });

    it('should return empty array for invalid category', () => {
      const tags = getCategoryTags('nonexistent');
      expect(tags).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    it('should return tags from all categories', () => {
      const tags = getAllTags();
      expect(tags.length).toBeGreaterThan(50);
      // Tags from different categories
      expect(tags).toContain('minimalist'); // home, fashion, art
      expect(tags).toContain('organic'); // home, fashion, food
      expect(tags).toContain('vegan'); // beauty, food
    });

    it('should not contain duplicates', () => {
      const tags = getAllTags();
      const uniqueTags = new Set(tags);
      expect(tags.length).toBe(uniqueTags.size);
    });
  });

  describe('getAliases', () => {
    it('should return aliases for a category', () => {
      const aliases = getAliases('home');
      expect(aliases['boho']).toBe('bohemian');
      expect(aliases['scandi']).toBe('scandinavian');
    });

    it('should return empty object for invalid category', () => {
      const aliases = getAliases('nonexistent');
      expect(aliases).toEqual({});
    });
  });

  describe('getAllAliases', () => {
    it('should return aliases from all categories', () => {
      const aliases = getAllAliases();
      expect(aliases['boho']).toBe('bohemian');
      expect(aliases['k-beauty']).toBe('korean');
      expect(aliases['gluten free']).toBe('gluten-free');
    });
  });

  describe('normalizeTag', () => {
    it('should normalize using alias', () => {
      expect(normalizeTag('boho')).toBe('bohemian');
      expect(normalizeTag('k-beauty')).toBe('korean');
      expect(normalizeTag('eco friendly')).toBe('eco-friendly');
    });

    it('should handle case and whitespace', () => {
      expect(normalizeTag('  BOHO  ')).toBe('bohemian');
      expect(normalizeTag('Eco Friendly')).toBe('eco-friendly');
    });

    it('should return as-is if no alias exists', () => {
      expect(normalizeTag('minimalist')).toBe('minimalist');
      expect(normalizeTag('organic')).toBe('organic');
    });

    it('should prioritize category-specific aliases', () => {
      // Both should resolve correctly
      expect(normalizeTag('boho', 'home')).toBe('bohemian');
      expect(normalizeTag('boho', 'fashion')).toBe('bohemian');
    });
  });

  describe('matchTag', () => {
    it('should match valid tag and return category', () => {
      const result = matchTag('minimalist');
      expect(result.isValid).toBe(true);
      expect(result.canonical).toBe('minimalist');
      expect(result.category).toBeDefined();
    });

    it('should normalize alias and match', () => {
      const result = matchTag('boho');
      expect(result.isValid).toBe(true);
      expect(result.canonical).toBe('bohemian');
      expect(result.original).toBe('boho');
    });

    it('should handle invalid tag', () => {
      const result = matchTag('completely-invalid-tag-xyz');
      expect(result.isValid).toBe(false);
      expect(result.category).toBeNull();
    });

    it('should match within specific category if provided', () => {
      const result = matchTag('sustainable', 'home');
      expect(result.isValid).toBe(true);
      expect(result.category).toBe('home');
    });
  });

  describe('validateCategory', () => {
    it('should validate existing category', () => {
      expect(validateCategory('home')).toBe('home');
      expect(validateCategory('fashion')).toBe('fashion');
      expect(validateCategory('BEAUTY')).toBe('beauty');
    });

    it('should return null for invalid category', () => {
      expect(validateCategory('nonexistent')).toBeNull();
    });
  });

  describe('validateSubcategory', () => {
    it('should validate existing subcategory', () => {
      expect(validateSubcategory('home', 'decor')).toBe('decor');
      expect(validateSubcategory('fashion', 'womenswear')).toBe('womenswear');
    });

    it('should return null for invalid subcategory', () => {
      expect(validateSubcategory('home', 'invalid')).toBeNull();
      expect(validateSubcategory('fashion', 'decor')).toBeNull();
    });
  });

  describe('normalizeTags', () => {
    it('should normalize multiple tags', () => {
      const result = normalizeTags(['boho', 'sustainable', 'minimalist']);
      expect(result.canonical_tags).toContain('bohemian');
      expect(result.canonical_tags).toContain('sustainable');
      expect(result.canonical_tags).toContain('minimalist');
    });

    it('should track unmatched tags', () => {
      const result = normalizeTags(['minimalist', 'xyz-invalid', 'organic']);
      expect(result.canonical_tags).toContain('minimalist');
      expect(result.canonical_tags).toContain('organic');
      expect(result.unmatched_tags).toContain('xyz-invalid');
    });

    it('should deduplicate canonical tags', () => {
      const result = normalizeTags(['boho', 'bohemian', 'BOHO']);
      expect(result.canonical_tags).toEqual(['bohemian']);
    });

    it('should scope to category if provided', () => {
      const result = normalizeTags(['sustainable', 'minimalist'], 'home');
      expect(result.category).toBe('home');
    });
  });

  describe('detectCategory', () => {
    it('should detect category from tags', () => {
      const result = detectCategory(['skincare', 'vegan', 'korean', 'hydrating']);
      expect(result).toBe('beauty');
    });

    it('should detect category with mixed tags', () => {
      const result = detectCategory(['decor', 'furniture', 'cozy']);
      expect(result).toBe('home');
    });

    it('should return null for no matching tags', () => {
      const result = detectCategory(['xyz', 'invalid', 'tags']);
      expect(result).toBeNull();
    });
  });

  describe('suggestTags', () => {
    it('should suggest tags starting with prefix', () => {
      const suggestions = suggestTags('min');
      expect(suggestions).toContain('minimalist');
    });

    it('should suggest tags containing substring', () => {
      const suggestions = suggestTags('free');
      expect(suggestions.some(s => s.includes('free'))).toBe(true);
    });

    it('should respect category scope', () => {
      const suggestions = suggestTags('org', 'beauty');
      expect(suggestions).toContain('organic');
    });

    it('should respect limit', () => {
      const suggestions = suggestTags('a', undefined, 3);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getRelatedTags', () => {
    it('should return tags from same category', () => {
      const related = getRelatedTags('minimalist');
      expect(related.length).toBeGreaterThan(0);
      // Should not include the input tag
      expect(related).not.toContain('minimalist');
    });

    it('should return empty for invalid tag', () => {
      const related = getRelatedTags('invalid-xyz');
      expect(related).toEqual([]);
    });
  });

  describe('validateProductTaxonomy', () => {
    it('should validate complete taxonomy assignment', () => {
      const result = validateProductTaxonomy('home', 'decor', ['minimalist', 'sustainable']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on invalid category', () => {
      const result = validateProductTaxonomy('invalid', 'decor', ['minimalist']);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid category'))).toBe(true);
    });

    it('should fail on invalid subcategory', () => {
      const result = validateProductTaxonomy('home', 'invalid-sub', ['minimalist']);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid subcategory'))).toBe(true);
    });

    it('should warn about unknown tags', () => {
      const result = validateProductTaxonomy('home', 'decor', ['minimalist', 'xyz-unknown']);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown tags'))).toBe(true);
      expect(result.normalized.unmatched_tags).toContain('xyz-unknown');
    });

    it('should normalize tags in result', () => {
      const result = validateProductTaxonomy('home', 'decor', ['boho', 'eco friendly']);
      expect(result.normalized.canonical_tags).toContain('bohemian');
      expect(result.normalized.canonical_tags).toContain('eco-friendly');
    });
  });
});
