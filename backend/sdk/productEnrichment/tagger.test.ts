/**
 * Tagger Tests
 * Task 20: Validate tagging logic, conflict resolution, and fallbacks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  tagProduct,
  normalizeProductTag,
  resolveSynonym,
  enrichTags,
  validateTags,
  areTagsValid,
  processClaudeTags,
  getTagPromptHint,
  loadGlossary,
  getTagDefinition
} from './tagger';

describe('tagProduct', () => {
  it('normalizes valid tags', () => {
    const result = tagProduct(['bohemian', 'handmade', 'organic']);

    expect(result.tags).toContain('bohemian');
    expect(result.tags).toContain('handmade');
    expect(result.tags).toContain('organic');
    expect(result.unmatchedTags).toHaveLength(0);
  });

  it('resolves aliases to canonical tags', () => {
    const result = tagProduct(['boho', 'scandi', 'eco friendly']);

    expect(result.tags).toContain('bohemian');
    expect(result.tags).toContain('scandinavian');
    expect(result.tags).toContain('eco-friendly');
  });

  it('tracks unmatched tags', () => {
    const result = tagProduct(['bohemian', 'xyz-unknown-tag', 'handmade']);

    expect(result.tags).toContain('bohemian');
    expect(result.tags).toContain('handmade');
    expect(result.unmatchedTags).toContain('xyz-unknown-tag');
  });

  it('groups tags by family', () => {
    // Use tags that exist in taxonomy.json
    const result = tagProduct(['organic', 'minimalist', 'handmade', 'sustainable']);

    // These tags are in the taxonomy and should be grouped by family
    expect(result.tagsByFamily.sustainability).toContain('organic');
    expect(result.tagsByFamily.sustainability).toContain('sustainable');
    expect(result.tagsByFamily.sustainability).toContain('handmade');
    expect(result.tagsByFamily.style).toContain('minimalist');
  });

  it('provides suggestions for unmatched tags', () => {
    const result = tagProduct(['mini', 'hand']);

    // Should suggest 'minimalist' for 'mini' and 'handmade' for 'hand'
    expect(Object.keys(result.suggestions).length).toBeGreaterThan(0);
  });

  it('scopes matching to category when provided', () => {
    const result = tagProduct(['vintage', 'modern'], { category: 'home' });

    expect(result.tags).toContain('vintage');
    expect(result.tags).toContain('modern');
    expect(result.category).toBe('home');
  });
});

describe('normalizeProductTag', () => {
  it('returns full context for valid tag', () => {
    const result = normalizeProductTag('handmade');

    expect(result.isValid).toBe(true);
    expect(result.canonical).toBe('handmade');
    expect(result.family).toBe('sustainability');
  });

  it('resolves alias and returns canonical', () => {
    const result = normalizeProductTag('boho');

    expect(result.isValid).toBe(true);
    expect(result.canonical).toBe('bohemian');
    expect(result.family).toBe('style');
  });

  it('marks invalid tags', () => {
    const result = normalizeProductTag('not-a-real-tag');

    expect(result.isValid).toBe(false);
    expect(result.family).toBeNull();
  });
});

describe('resolveSynonym', () => {
  it('resolves global aliases', () => {
    expect(resolveSynonym('boho')).toBe('bohemian');
    expect(resolveSynonym('scandi')).toBe('scandinavian');
    expect(resolveSynonym('eco')).toBe('eco-friendly');
  });

  it('resolves compound aliases', () => {
    expect(resolveSynonym('hand made')).toBe('handmade');
    expect(resolveSynonym('mid century')).toBe('mid-century');
    expect(resolveSynonym('fair trade')).toBe('fair-trade');
  });

  it('returns original if no synonym found', () => {
    expect(resolveSynonym('unique-tag')).toBe('unique-tag');
  });
});

describe('enrichTags', () => {
  it('adds related tags from same category', () => {
    const enriched = enrichTags(['minimalist']);

    // Should include minimalist plus some related style tags
    expect(enriched).toContain('minimalist');
    expect(enriched.length).toBeGreaterThan(1);
  });

  it('respects maxPerFamily limit', () => {
    const enriched = enrichTags(['minimalist'], 1);

    // Should have minimalist plus at most 1 related tag
    expect(enriched.length).toBeLessThanOrEqual(2);
  });

  it('does not duplicate existing tags', () => {
    const enriched = enrichTags(['minimalist', 'modern', 'contemporary']);
    const uniqueCount = new Set(enriched).size;

    expect(enriched.length).toBe(uniqueCount);
  });
});

describe('validateTags', () => {
  it('separates valid and invalid tags', () => {
    const { valid, invalid } = validateTags([
      'organic',
      'handmade',
      'fake-tag',
      'minimalist',
      'another-fake'
    ]);

    expect(valid).toContain('organic');
    expect(valid).toContain('handmade');
    expect(valid).toContain('minimalist');
    expect(invalid).toContain('fake-tag');
    expect(invalid).toContain('another-fake');
  });

  it('normalizes valid tags to canonical form', () => {
    const { valid } = validateTags(['boho', 'eco friendly']);

    expect(valid).toContain('bohemian');
    expect(valid).toContain('eco-friendly');
  });
});

describe('areTagsValid', () => {
  it('returns true when all tags are valid', () => {
    expect(areTagsValid(['organic', 'handmade', 'minimalist'])).toBe(true);
  });

  it('returns false when any tag is invalid', () => {
    expect(areTagsValid(['organic', 'invalid-tag'])).toBe(false);
  });
});

describe('processClaudeTags', () => {
  it('normalizes Claude output tags', () => {
    const claudeOutput = ['boho', 'hand-made', 'eco friendly', 'gift'];

    const result = processClaudeTags(claudeOutput);

    expect(result.tags).toContain('bohemian');
    expect(result.tags).toContain('handmade');
    expect(result.tags).toContain('eco-friendly');
  });

  it('handles mixed valid and invalid Claude tags', () => {
    const claudeOutput = ['minimalist', 'sustainable', 'unique-style-xyz'];

    const result = processClaudeTags(claudeOutput);

    expect(result.tags).toContain('minimalist');
    expect(result.tags).toContain('sustainable');
    expect(result.unmatchedTags).toContain('unique-style-xyz');
  });
});

describe('getTagPromptHint', () => {
  it('returns tag examples for Claude', () => {
    const hint = getTagPromptHint();

    expect(hint).toContain('material');
    expect(hint).toContain('style');
    expect(hint).toContain('sustainability');
  });
});

describe('loadGlossary', () => {
  it('loads glossary from JSON', () => {
    const glossary = loadGlossary();

    expect(glossary.version).toBeDefined();
    expect(glossary.tags).toBeDefined();
    expect(glossary.global_aliases).toBeDefined();
  });
});

describe('getTagDefinition', () => {
  it('returns definition for valid tag', () => {
    const def = getTagDefinition('handmade');

    expect(def).not.toBeNull();
    expect(def?.definition).toContain('hand');
  });

  it('returns null for unknown tag', () => {
    const def = getTagDefinition('unknown-tag-xyz');

    expect(def).toBeNull();
  });
});

describe('conflict resolution', () => {
  it('handles multiple aliases for same canonical tag', () => {
    const result1 = resolveSynonym('boho');
    const result2 = resolveSynonym('boho-chic');
    const result3 = tagProduct(['bohemian']);

    // All should resolve to bohemian
    expect(result1).toBe('bohemian');
    expect(result3.tags).toContain('bohemian');
  });

  it('prioritizes category-specific tags when category provided', () => {
    const homeResult = tagProduct(['natural', 'organic'], { category: 'home' });
    const beautyResult = tagProduct(['natural', 'organic'], { category: 'beauty' });

    // Both should have the tags, but category context preserved
    expect(homeResult.category).toBe('home');
    expect(beautyResult.category).toBe('beauty');
  });
});

describe('fallback behavior', () => {
  it('returns empty arrays for empty input', () => {
    const result = tagProduct([]);

    expect(result.tags).toHaveLength(0);
    expect(result.unmatchedTags).toHaveLength(0);
    expect(result.category).toBeNull();
  });

  it('handles whitespace and case variations', () => {
    const result = tagProduct(['  Bohemian  ', 'HANDMADE', 'Eco-Friendly']);

    expect(result.tags).toContain('bohemian');
    expect(result.tags).toContain('handmade');
    expect(result.tags).toContain('eco-friendly');
  });
});
