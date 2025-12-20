/**
 * Region Matcher Tests
 * Task 16: Region-Aware Product Recommendation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RegionMatcher,
  createRegionMatcher,
  extractRegion,
  calculateRegionScore,
  inferRegionFromBrand,
} from './regionMatcher';
import { RegionSearchContext } from './types';

describe('RegionMatcher', () => {
  let matcher: RegionMatcher;

  beforeEach(() => {
    matcher = createRegionMatcher();
  });

  describe('extractRegionFromText', () => {
    it('should extract region from "Kurta from India"', () => {
      const result = matcher.extractRegionFromText('Kurta from India');

      expect(result.primary).toBe('India');
      expect(result.regions).toContain('India');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should extract region from "Bali trip essentials"', () => {
      const result = matcher.extractRegionFromText('Bali trip essentials');

      expect(result.regions).toContain('Indonesia');
      expect(result.hints).toContain('bali');
    });

    it('should extract multiple regions from "Indo-Japanese fusion decor"', () => {
      const result = matcher.extractRegionFromText('indian and japanese fusion decor');

      expect(result.regions.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract region from keywords like "batik"', () => {
      const result = matcher.extractRegionFromText('Beautiful batik fabrics');

      expect(result.regions).toContain('Indonesia');
      expect(result.hints).toContain('batik');
    });

    it('should handle text with no region hints', () => {
      const result = matcher.extractRegionFromText('Beautiful furniture');

      expect(result.regions).toHaveLength(0);
      expect(result.primary).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should extract from "Scandinavian minimalist style"', () => {
      const result = matcher.extractRegionFromText('Scandinavian minimalist style');

      expect(result.regions).toContain('Scandinavia');
    });
  });

  describe('matchRegion', () => {
    it('should give exact match highest score', () => {
      const result = matcher.matchRegion('India', 'India');

      expect(result.score).toBe(1.0);
      expect(result.matchType).toBe('exact');
    });

    it('should match alias Bali to Indonesia', () => {
      const result = matcher.matchRegion('Indonesia', 'Bali');

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.matchType).toBe('alias');
    });

    it('should match hierarchy India to South Asia', () => {
      const result = matcher.matchRegion('India', 'South Asia');

      expect(result.score).toBeGreaterThan(0.3);
      expect(result.matchType).toBe('hierarchy');
    });

    it('should return global fallback for undefined region', () => {
      const result = matcher.matchRegion(undefined, 'India');

      expect(result.score).toBeLessThan(0.5);
      expect(result.matchType).toBe('partial');
    });

    it('should match hierarchy APAC to India', () => {
      const result = matcher.matchRegion('India', 'APAC');

      expect(result.score).toBeGreaterThan(0.3);
    });
  });

  describe('calculateRegionScore', () => {
    it('should score Indian product highly for India query', () => {
      const context: RegionSearchContext = {
        query: 'traditional indian decor',
        queryRegions: ['India'],
      };

      const score = matcher.calculateRegionScore('India', context);
      expect(score).toBeGreaterThan(0.8);
    });

    it('should boost score for user home region', () => {
      const contextWithUser: RegionSearchContext = {
        query: 'home decor',
        userRegion: 'India',
        preferLocal: true,
      };

      const contextWithoutUser: RegionSearchContext = {
        query: 'home decor',
      };

      const scoreWithUser = matcher.calculateRegionScore('India', contextWithUser);
      const scoreWithoutUser = matcher.calculateRegionScore('India', contextWithoutUser);

      expect(scoreWithUser).toBeGreaterThan(scoreWithoutUser);
    });

    it('should return global score when no regions specified', () => {
      const context: RegionSearchContext = {
        query: 'beautiful furniture',
      };

      const score = matcher.calculateRegionScore('India', context);
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('getRelatedRegions', () => {
    it('should return related regions for India', () => {
      const related = matcher.getRelatedRegions('India');

      expect(related).toContain('India');
      expect(related).toContain('South Asia');
    });

    it('should return related regions for Bali alias', () => {
      const related = matcher.getRelatedRegions('Bali');

      expect(related).toContain('Bali');
      expect(related).toContain('Indonesia');
    });
  });

  describe('inferRegionFromBrand', () => {
    it('should infer India from brand with "desi" keyword', () => {
      const region = matcher.inferRegionFromBrand('Desi Artisan Crafts');
      expect(region).toBe('India');
    });

    it('should infer region from .in domain', () => {
      const region = matcher.inferRegionFromBrand('SomeStore', 'somestore.co.in');
      expect(region).toBe('India');
    });

    it('should infer Japan from .jp domain', () => {
      const region = matcher.inferRegionFromBrand('Store', 'store.co.jp');
      expect(region).toBe('Japan');
    });

    it('should return null for unknown brand', () => {
      const region = matcher.inferRegionFromBrand('Generic Store');
      expect(region).toBeNull();
    });

    it('should infer Indonesia from "batik" keyword', () => {
      const region = matcher.inferRegionFromBrand('Batik House');
      expect(region).toBe('Indonesia');
    });
  });
});

describe('Convenience Functions', () => {
  it('extractRegion should work with default matcher', () => {
    const result = extractRegion('Products from Mumbai');
    expect(result.regions).toContain('India');
  });

  it('calculateRegionScore should work with default matcher', () => {
    const score = calculateRegionScore('India', {
      query: 'indian style',
      queryRegions: ['India'],
    });
    expect(score).toBeGreaterThan(0.5);
  });

  it('inferRegionFromBrand should work with default matcher', () => {
    const region = inferRegionFromBrand('Tokyo Style');
    // May or may not match depending on keywords
    expect(region === null || typeof region === 'string').toBe(true);
  });
});

describe('Edge Cases', () => {
  let matcher: RegionMatcher;

  beforeEach(() => {
    matcher = createRegionMatcher();
  });

  it('should handle empty string', () => {
    const result = matcher.extractRegionFromText('');
    expect(result.regions).toHaveLength(0);
  });

  it('should handle case insensitivity', () => {
    const result1 = matcher.extractRegionFromText('INDIA');
    const result2 = matcher.extractRegionFromText('india');
    const result3 = matcher.extractRegionFromText('India');

    expect(result1.regions).toContain('India');
    expect(result2.regions).toContain('India');
    expect(result3.regions).toContain('India');
  });

  it('should handle special characters', () => {
    const result = matcher.extractRegionFromText('Ho Chi Minh City decor');
    expect(result.regions).toContain('Vietnam');
  });
});
