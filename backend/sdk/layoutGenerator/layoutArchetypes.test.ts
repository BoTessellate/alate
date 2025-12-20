/**
 * Layout Archetypes Tests
 * Tests for archetype registry and remix functionality
 */

import {
  LAYOUT_ARCHETYPES,
  ARCHETYPE_DISPLAY_NAMES,
  getArchetype,
  getAllArchetypes,
  findArchetypesForProductCount,
  getRecommendedArchetype,
  getArchetypeDisplayName,
  getArchetypeByDisplayName,
  getArchetypeNamesInOrder,
  getNextArchetype,
  getPreviousArchetype,
  getRandomArchetype
} from './layoutArchetypes';
import { LayoutArchetypeName } from './types';

describe('Layout Archetypes Registry', () => {
  describe('LAYOUT_ARCHETYPES', () => {
    it('should contain 8 archetypes', () => {
      expect(Object.keys(LAYOUT_ARCHETYPES)).toHaveLength(8);
    });

    it('should have required properties for each archetype', () => {
      for (const archetype of Object.values(LAYOUT_ARCHETYPES)) {
        expect(archetype).toHaveProperty('name');
        expect(archetype).toHaveProperty('description');
        expect(archetype).toHaveProperty('minItems');
        expect(archetype).toHaveProperty('maxItems');
        expect(archetype).toHaveProperty('allowOverlap');
        expect(archetype).toHaveProperty('balanceRule');
        expect(archetype).toHaveProperty('defaultCanvasSize');
      }
    });

    it('should have valid min/max ranges', () => {
      for (const archetype of Object.values(LAYOUT_ARCHETYPES)) {
        expect(archetype.minItems).toBeLessThanOrEqual(archetype.maxItems);
        expect(archetype.minItems).toBeGreaterThan(0);
      }
    });
  });

  describe('ARCHETYPE_DISPLAY_NAMES', () => {
    it('should have display name for each archetype', () => {
      for (const name of Object.keys(LAYOUT_ARCHETYPES)) {
        expect(ARCHETYPE_DISPLAY_NAMES[name as LayoutArchetypeName]).toBeDefined();
      }
    });

    it('should match task spec names', () => {
      expect(ARCHETYPE_DISPLAY_NAMES.LayeredCenterpiece).toBe('Hero Grid');
      expect(ARCHETYPE_DISPLAY_NAMES.DiagonalCascade).toBe('Diagonal Overlap');
      expect(ARCHETYPE_DISPLAY_NAMES.AsymmetricFlow).toBe('Layered Spread');
      expect(ARCHETYPE_DISPLAY_NAMES.CollageStyle).toBe('Floating Canvas');
    });
  });

  describe('getArchetype', () => {
    it('should return archetype by name', () => {
      const archetype = getArchetype('ZigZagStaggered');
      expect(archetype.name).toBe('ZigZagStaggered');
      expect(archetype.minItems).toBe(3);
    });
  });

  describe('getAllArchetypes', () => {
    it('should return all archetypes as array', () => {
      const all = getAllArchetypes();
      expect(all).toHaveLength(8);
      expect(all[0]).toHaveProperty('name');
    });
  });

  describe('getArchetypeDisplayName', () => {
    it('should return display name', () => {
      expect(getArchetypeDisplayName('LayeredCenterpiece')).toBe('Hero Grid');
      expect(getArchetypeDisplayName('CollageStyle')).toBe('Floating Canvas');
    });

    it('should return name itself for unknown', () => {
      expect(getArchetypeDisplayName('Unknown' as LayoutArchetypeName)).toBe('Unknown');
    });
  });

  describe('getArchetypeByDisplayName', () => {
    it('should find archetype by display name', () => {
      const archetype = getArchetypeByDisplayName('Hero Grid');
      expect(archetype?.name).toBe('LayeredCenterpiece');
    });

    it('should return undefined for unknown display name', () => {
      expect(getArchetypeByDisplayName('Unknown Layout')).toBeUndefined();
    });
  });
});

describe('Product Count Filtering', () => {
  describe('findArchetypesForProductCount', () => {
    it('should find archetypes for 3 products', () => {
      const suitable = findArchetypesForProductCount(3);
      expect(suitable.length).toBeGreaterThan(0);

      // Check all returned archetypes support 3 products
      for (const arch of suitable) {
        expect(arch.minItems).toBeLessThanOrEqual(3);
        expect(arch.maxItems).toBeGreaterThanOrEqual(3);
      }
    });

    it('should find archetypes for 5 products', () => {
      const suitable = findArchetypesForProductCount(5);
      expect(suitable.length).toBeGreaterThan(0);
    });

    it('should find fewer options for 2 products', () => {
      const forTwo = findArchetypesForProductCount(2);
      const forFive = findArchetypesForProductCount(5);

      // MinimalSplit supports 2-4, so there should be at least one
      expect(forTwo.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for 1 product', () => {
      const suitable = findArchetypesForProductCount(1);
      expect(suitable).toHaveLength(0);
    });
  });

  describe('getRecommendedArchetype', () => {
    it('should return archetype for valid count', () => {
      const recommended = getRecommendedArchetype(5);
      expect(recommended).toBeDefined();
      expect(recommended.minItems).toBeLessThanOrEqual(5);
      expect(recommended.maxItems).toBeGreaterThanOrEqual(5);
    });

    it('should return CollageStyle for 1 product (fallback)', () => {
      const recommended = getRecommendedArchetype(1);
      expect(recommended.name).toBe('CollageStyle');
    });

    it('should prefer archetypes closer to optimal range', () => {
      // For 4 products, GridWithOverlap (4-9) should be good fit
      const recommended = getRecommendedArchetype(4);
      expect(['GridWithOverlap', 'SymmetricBalance', 'MinimalSplit']).toContain(recommended.name);
    });
  });
});

describe('Remix Functionality', () => {
  describe('getArchetypeNamesInOrder', () => {
    it('should return all archetype names', () => {
      const names = getArchetypeNamesInOrder();
      expect(names).toHaveLength(8);
      expect(names).toContain('ZigZagStaggered');
      expect(names).toContain('CollageStyle');
    });
  });

  describe('getNextArchetype', () => {
    it('should cycle to next archetype', () => {
      const names = getArchetypeNamesInOrder();
      const first = names[0] as LayoutArchetypeName;
      const next = getNextArchetype(first);

      expect(next.name).toBe(names[1]);
    });

    it('should wrap around to first', () => {
      const names = getArchetypeNamesInOrder();
      const last = names[names.length - 1] as LayoutArchetypeName;
      const next = getNextArchetype(last);

      expect(next.name).toBe(names[0]);
    });

    it('should filter by product count', () => {
      // With 2 products, only MinimalSplit (2-4) is valid
      const next = getNextArchetype('MinimalSplit', 2);

      // Should stay on MinimalSplit since it's the only compatible one
      // Or wrap to the next compatible one
      const compatible = findArchetypesForProductCount(2);
      expect(compatible.map(a => a.name)).toContain(next.name);
    });

    it('should fallback to all archetypes if none compatible', () => {
      const next = getNextArchetype('CollageStyle', 1);
      expect(next).toBeDefined();
    });
  });

  describe('getPreviousArchetype', () => {
    it('should cycle to previous archetype', () => {
      const names = getArchetypeNamesInOrder();
      const second = names[1] as LayoutArchetypeName;
      const prev = getPreviousArchetype(second);

      expect(prev.name).toBe(names[0]);
    });

    it('should wrap around to last', () => {
      const names = getArchetypeNamesInOrder();
      const first = names[0] as LayoutArchetypeName;
      const prev = getPreviousArchetype(first);

      expect(prev.name).toBe(names[names.length - 1]);
    });
  });

  describe('getRandomArchetype', () => {
    it('should return different archetype than current', () => {
      const current: LayoutArchetypeName = 'ZigZagStaggered';

      // Run multiple times to ensure randomness excludes current
      for (let i = 0; i < 10; i++) {
        const random = getRandomArchetype(current, 5);
        expect(random.name).not.toBe(current);
      }
    });

    it('should filter by product count', () => {
      const random = getRandomArchetype('MinimalSplit', 3);
      expect(random.minItems).toBeLessThanOrEqual(3);
      expect(random.maxItems).toBeGreaterThanOrEqual(3);
    });

    it('should return fallback when no other options', () => {
      // With 2 products and excluding MinimalSplit, should return something
      const random = getRandomArchetype('MinimalSplit', 2);
      expect(random).toBeDefined();
    });
  });
});

describe('Export Metadata Integration', () => {
  it('should provide display name for export metadata', () => {
    // Test that we can get the display name for moodboard export
    const archetype = getRecommendedArchetype(5);
    const displayName = getArchetypeDisplayName(archetype.name);

    expect(typeof displayName).toBe('string');
    expect(displayName.length).toBeGreaterThan(0);
  });

  it('should support looking up archetype from exported display name', () => {
    // Simulate loading from exported metadata
    const exportedLayout = 'Layered Spread';
    const archetype = getArchetypeByDisplayName(exportedLayout);

    expect(archetype?.name).toBe('AsymmetricFlow');
  });
});
