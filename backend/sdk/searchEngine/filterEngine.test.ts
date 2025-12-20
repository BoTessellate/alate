/**
 * Filter Engine Tests
 * Task 19: Validate filter and sort logic
 *
 * Run with: npx vitest run filterEngine.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  filterByRegion,
  filterByCategories,
  filterByTags,
  filterByBrands,
  filterByPriceRange,
  filterBySearchText,
  filterByColorFamilies,
  applyFilters,
  sortProducts,
  filterAndSortProducts,
  getFilterMetadata,
  getColorFamily,
} from './filterEngine';
import { EnrichedProduct } from '../productEnrichment/types';

// Mock products for testing
const mockProducts: EnrichedProduct[] = [
  {
    product_name: 'Bohemian Rug',
    brand: 'Jaipur Living',
    category: 'home',
    price: 299,
    region: 'India',
    tags: ['handmade', 'bohemian'],
    color_palette: ['terracotta', 'cream', 'rust'],
    texture: 'woven',
    material: 'cotton',
    tone: 'warm',
    created_at: '2024-01-15',
  },
  {
    product_name: 'Minimalist Vase',
    brand: 'West Elm',
    category: 'home',
    price: 89,
    region: 'USA',
    tags: ['minimalist', 'modern'],
    color_palette: ['white', 'gray'],
    texture: 'smooth',
    material: 'ceramic',
    tone: 'neutral',
    created_at: '2024-02-10',
  },
  {
    product_name: 'Silk Scarf',
    brand: 'Gucci',
    category: 'accessories',
    price: 450,
    region: 'Italy',
    tags: ['luxury'],
    color_palette: ['navy', 'gold'],
    texture: 'smooth',
    material: 'silk',
    tone: 'elegant',
    created_at: '2024-03-01',
  },
  {
    product_name: 'Linen Dress',
    brand: 'Reformation',
    category: 'womenswear',
    price: 178,
    region: 'USA',
    tags: ['sustainable', 'modern'],
    color_palette: ['sage', 'mint'],
    texture: 'natural',
    material: 'linen',
    tone: 'fresh',
    created_at: '2024-01-20',
  },
];

describe('filterByRegion', () => {
  it('filters by exact region match', () => {
    const result = filterByRegion(mockProducts, 'India');
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('Jaipur Living');
  });

  it('is case insensitive', () => {
    const result = filterByRegion(mockProducts, 'usa');
    expect(result).toHaveLength(2);
  });

  it('returns empty for non-matching region', () => {
    const result = filterByRegion(mockProducts, 'Japan');
    expect(result).toHaveLength(0);
  });
});

describe('filterByCategories', () => {
  it('filters by single category', () => {
    const result = filterByCategories(mockProducts, ['home']);
    expect(result).toHaveLength(2);
  });

  it('filters by multiple categories', () => {
    const result = filterByCategories(mockProducts, ['home', 'accessories']);
    expect(result).toHaveLength(3);
  });

  it('returns all products when categories empty', () => {
    const result = filterByCategories(mockProducts, []);
    expect(result).toHaveLength(4);
  });
});

describe('filterByTags', () => {
  it('filters by single tag', () => {
    const result = filterByTags(mockProducts, ['luxury']);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('Gucci');
  });

  it('filters by multiple tags (OR logic)', () => {
    const result = filterByTags(mockProducts, ['modern', 'handmade']);
    expect(result).toHaveLength(3);
  });
});

describe('filterByBrands', () => {
  it('filters by brand', () => {
    const result = filterByBrands(mockProducts, ['Gucci']);
    expect(result).toHaveLength(1);
  });

  it('filters by multiple brands', () => {
    const result = filterByBrands(mockProducts, ['Gucci', 'West Elm']);
    expect(result).toHaveLength(2);
  });
});

describe('filterByPriceRange', () => {
  it('filters by min price', () => {
    const result = filterByPriceRange(mockProducts, 200);
    expect(result).toHaveLength(2);
  });

  it('filters by max price', () => {
    const result = filterByPriceRange(mockProducts, undefined, 100);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('West Elm');
  });

  it('filters by price range', () => {
    const result = filterByPriceRange(mockProducts, 100, 300);
    expect(result).toHaveLength(2);
  });
});

describe('filterBySearchText', () => {
  it('searches in product name', () => {
    const result = filterBySearchText(mockProducts, 'rug');
    expect(result).toHaveLength(1);
  });

  it('searches in brand', () => {
    const result = filterBySearchText(mockProducts, 'gucci');
    expect(result).toHaveLength(1);
  });

  it('searches multiple terms', () => {
    const result = filterBySearchText(mockProducts, 'silk scarf');
    expect(result).toHaveLength(1);
  });
});

describe('getColorFamily', () => {
  it('identifies earth tones', () => {
    expect(getColorFamily('terracotta')).toBe('earth');
    expect(getColorFamily('rust')).toBe('earth');
  });

  it('identifies neutrals', () => {
    expect(getColorFamily('white')).toBe('neutrals');
    expect(getColorFamily('cream')).toBe('neutrals');
  });

  it('identifies metallics', () => {
    expect(getColorFamily('gold')).toBe('metallic');
  });
});

describe('filterByColorFamilies', () => {
  it('filters by color family', () => {
    const result = filterByColorFamilies(mockProducts, ['earth']);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('Jaipur Living');
  });

  it('filters by multiple color families', () => {
    const result = filterByColorFamilies(mockProducts, ['neutrals', 'metallic']);
    // West Elm (white, gray = neutrals), Gucci (gold = metallic), Reformation (sage, mint = pastel but mint can match)
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe('applyFilters', () => {
  it('combines multiple filters', () => {
    const result = applyFilters(mockProducts, {
      categories: ['home'],
      priceRange: { max: 100 },
    });
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('West Elm');
  });
});

describe('sortProducts', () => {
  it('sorts by price ascending', () => {
    const result = sortProducts(mockProducts, { field: 'price', direction: 'asc' });
    expect(result[0].price).toBe(89);
    expect(result[3].price).toBe(450);
  });

  it('sorts by price descending', () => {
    const result = sortProducts(mockProducts, { field: 'price', direction: 'desc' });
    expect(result[0].price).toBe(450);
    expect(result[3].price).toBe(89);
  });

  it('sorts by brand alphabetically', () => {
    const result = sortProducts(mockProducts, { field: 'brand', direction: 'asc' });
    expect(result[0].brand).toBe('Gucci');
    expect(result[3].brand).toBe('West Elm');
  });

  it('sorts by createdAt descending (newest first)', () => {
    const result = sortProducts(mockProducts, { field: 'createdAt', direction: 'desc' });
    expect(result[0].created_at).toBe('2024-03-01');
  });
});

describe('filterAndSortProducts', () => {
  it('filters, sorts, and paginates', () => {
    const result = filterAndSortProducts(
      mockProducts,
      { categories: ['home'] },
      { field: 'price', direction: 'asc' },
      undefined,
      1,
      10
    );

    expect(result.totalCount).toBe(2);
    expect(result.products).toHaveLength(2);
    expect(result.products[0].price).toBe(89);
  });

  it('paginates correctly', () => {
    const page1 = filterAndSortProducts(mockProducts, {}, undefined, undefined, 1, 2);
    const page2 = filterAndSortProducts(mockProducts, {}, undefined, undefined, 2, 2);

    expect(page1.products).toHaveLength(2);
    expect(page2.products).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
  });
});

describe('getFilterMetadata', () => {
  it('extracts categories with counts', () => {
    const metadata = getFilterMetadata(mockProducts);

    expect(metadata.categories).toContainEqual({ value: 'home', count: 2 });
    expect(metadata.categories).toContainEqual({ value: 'accessories', count: 1 });
  });

  it('extracts price range', () => {
    const metadata = getFilterMetadata(mockProducts);

    expect(metadata.priceRange.min).toBe(89);
    expect(metadata.priceRange.max).toBe(450);
  });

  it('extracts brands with counts', () => {
    const metadata = getFilterMetadata(mockProducts);

    expect(metadata.brands).toHaveLength(4);
    expect(metadata.brands.find((b) => b.value === 'Gucci')?.count).toBe(1);
  });
});
