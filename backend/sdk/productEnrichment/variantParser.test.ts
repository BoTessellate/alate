/**
 * Unit Tests for Variant Parser
 *
 * Tests for variantParser.ts functionality:
 * - Color/size detection
 * - Shopify variant parsing
 * - WooCommerce variant parsing
 * - Dimension parsing
 * - Fit tag generation
 */

import { describe, it, expect } from 'vitest';
import {
  isColorValue,
  isSizeValue,
  parseShopifyVariants,
  parseWooCommerceVariants,
  parseShopifyDimensions,
  parseWooCommerceDimensions,
  parseDimensionString,
  generateFitTags,
  parsePlatformProduct,
  ShopifyVariant,
  WooCommerceVariant,
} from './variantParser';

describe('Color and Size Detection', () => {
  describe('isColorValue', () => {
    it('should detect common colors', () => {
      expect(isColorValue('Red')).toBe(true);
      expect(isColorValue('blue')).toBe(true);
      expect(isColorValue('Navy Blue')).toBe(true);
      expect(isColorValue('forest green')).toBe(true);
    });

    it('should reject non-color values', () => {
      expect(isColorValue('Large')).toBe(false);
      expect(isColorValue('XL')).toBe(false);
      expect(isColorValue('Cotton')).toBe(false);
    });
  });

  describe('isSizeValue', () => {
    it('should detect common sizes', () => {
      expect(isSizeValue('Small')).toBe(true);
      expect(isSizeValue('XL')).toBe(true);
      expect(isSizeValue('Medium')).toBe(true);
      expect(isSizeValue('One Size')).toBe(true);
    });

    it('should detect numeric sizes', () => {
      expect(isSizeValue('32')).toBe(true);
      expect(isSizeValue('10')).toBe(true);
    });

    it('should reject non-size values', () => {
      expect(isColorValue('Blue')).toBe(true); // This IS a color
      expect(isSizeValue('Blue')).toBe(false);
      expect(isSizeValue('Cotton')).toBe(false);
    });
  });
});

describe('Shopify Variant Parsing', () => {
  const mockVariants: ShopifyVariant[] = [
    {
      id: 1,
      product_id: 100,
      title: 'Red / Small',
      price: '29.99',
      sku: 'SHIRT-RED-S',
      option1: 'Red',
      option2: 'Small',
      option3: null,
      grams: 200,
    },
    {
      id: 2,
      product_id: 100,
      title: 'Blue / Large',
      price: '29.99',
      sku: 'SHIRT-BLUE-L',
      option1: 'Blue',
      option2: 'Large',
      option3: null,
      grams: 220,
    },
  ];

  const mockOptions = [
    { name: 'Color', values: ['Red', 'Blue'] },
    { name: 'Size', values: ['Small', 'Large'] },
  ];

  it('should parse basic variant structure', () => {
    const variants = parseShopifyVariants(mockVariants);

    expect(variants).toHaveLength(2);
    expect(variants[0].id).toBe('1');
    expect(variants[0].price).toBe(29.99);
    expect(variants[0].sku).toBe('SHIRT-RED-S');
  });

  it('should detect color and size from options', () => {
    const variants = parseShopifyVariants(mockVariants, mockOptions);

    expect(variants[0].color).toBe('Red');
    expect(variants[0].size).toBe('Small');
    expect(variants[1].color).toBe('Blue');
    expect(variants[1].size).toBe('Large');
  });

  it('should detect color/size without options by value', () => {
    const variantsWithoutOptions = parseShopifyVariants(mockVariants);

    // Should still detect by value analysis
    expect(variantsWithoutOptions[0].color).toBe('Red');
    expect(variantsWithoutOptions[0].size).toBe('Small');
  });

  it('should include image URL when available', () => {
    const variantsWithImage: ShopifyVariant[] = [
      { ...mockVariants[0], image_id: 999 },
    ];
    const images = [{ id: 999, src: 'https://example.com/red-shirt.jpg' }];

    const variants = parseShopifyVariants(variantsWithImage, mockOptions, images);

    expect(variants[0].image_url).toBe('https://example.com/red-shirt.jpg');
  });
});

describe('WooCommerce Variant Parsing', () => {
  const mockVariations: WooCommerceVariant[] = [
    {
      id: 10,
      sku: 'TEE-BLK-M',
      price: '24.99',
      regular_price: '29.99',
      attributes: [
        { name: 'Color', option: 'Black' },
        { name: 'Size', option: 'Medium' },
      ],
      image: { src: 'https://example.com/black-tee.jpg' },
    },
    {
      id: 11,
      sku: 'TEE-WHT-L',
      price: '24.99',
      regular_price: '29.99',
      attributes: [
        { name: 'Color', option: 'White' },
        { name: 'Size', option: 'Large' },
      ],
    },
  ];

  it('should parse basic variant structure', () => {
    const variants = parseWooCommerceVariants(mockVariations, 'https://shop.com/product/tee');

    expect(variants).toHaveLength(2);
    expect(variants[0].id).toBe('10');
    expect(variants[0].price).toBe(24.99);
    expect(variants[0].url).toContain('variation=10');
  });

  it('should extract color and size from attributes', () => {
    const variants = parseWooCommerceVariants(mockVariations, 'https://shop.com/product/tee');

    expect(variants[0].color).toBe('Black');
    expect(variants[0].size).toBe('Medium');
    expect(variants[1].color).toBe('White');
    expect(variants[1].size).toBe('Large');
  });

  it('should include image URL when available', () => {
    const variants = parseWooCommerceVariants(mockVariations, 'https://shop.com/product/tee');

    expect(variants[0].image_url).toBe('https://example.com/black-tee.jpg');
    expect(variants[1].image_url).toBeUndefined();
  });
});

describe('Dimension Parsing', () => {
  describe('parseShopifyDimensions', () => {
    it('should parse grams to kg', () => {
      const variant: ShopifyVariant = {
        id: 1,
        product_id: 100,
        title: 'Test',
        price: '10',
        grams: 500,
      };

      const dims = parseShopifyDimensions(variant);

      expect(dims?.weight).toBe(0.5);
      expect(dims?.weight_unit).toBe('kg');
    });

    it('should parse weight with unit', () => {
      const variant: ShopifyVariant = {
        id: 1,
        product_id: 100,
        title: 'Test',
        price: '10',
        weight: 2.5,
        weight_unit: 'lbs',
      };

      const dims = parseShopifyDimensions(variant);

      expect(dims?.weight).toBe(2.5);
      expect(dims?.weight_unit).toBe('lbs');
    });

    it('should return undefined if no dimensions', () => {
      const variant: ShopifyVariant = {
        id: 1,
        product_id: 100,
        title: 'Test',
        price: '10',
      };

      const dims = parseShopifyDimensions(variant);

      expect(dims).toBeUndefined();
    });
  });

  describe('parseWooCommerceDimensions', () => {
    it('should parse all dimension fields', () => {
      const dims = parseWooCommerceDimensions(
        { length: '30', width: '20', height: '10' },
        '0.5'
      );

      expect(dims?.width).toBe(20);
      expect(dims?.height).toBe(10);
      expect(dims?.depth).toBe(30);
      expect(dims?.weight).toBe(0.5);
    });

    it('should handle missing dimensions', () => {
      const dims = parseWooCommerceDimensions(undefined, '1.5');

      expect(dims?.weight).toBe(1.5);
      expect(dims?.width).toBeUndefined();
    });

    it('should return undefined if nothing provided', () => {
      const dims = parseWooCommerceDimensions(undefined, undefined);

      expect(dims).toBeUndefined();
    });
  });

  describe('parseDimensionString', () => {
    it('should parse dimension string with cm', () => {
      const dims = parseDimensionString('10x20x30cm');

      expect(dims.width).toBe(10);
      expect(dims.height).toBe(20);
      expect(dims.depth).toBe(30);
    });

    it('should parse dimension string with spaces', () => {
      const dims = parseDimensionString('10 x 20 x 30 cm');

      expect(dims.width).toBe(10);
      expect(dims.height).toBe(20);
      expect(dims.depth).toBe(30);
    });

    it('should convert mm to cm', () => {
      const dims = parseDimensionString('100x200x300mm');

      expect(dims.width).toBe(10);
      expect(dims.height).toBe(20);
      expect(dims.depth).toBe(30);
    });

    it('should parse weight', () => {
      const dims = parseDimensionString('500g');

      expect(dims.weight).toBe(500);
      expect(dims.weight_unit).toBe('g');
    });

    it('should parse weight in kg', () => {
      const dims = parseDimensionString('2.5kg');

      expect(dims.weight).toBe(2.5);
      expect(dims.weight_unit).toBe('kg');
    });
  });
});

describe('Fit Tag Generation', () => {
  it('should generate bulky tag for heavy items', () => {
    const tags = generateFitTags({ weight: 10, weight_unit: 'kg' });

    expect(tags).toContain('bulky');
  });

  it('should generate lightweight tag for light items', () => {
    const tags = generateFitTags({ weight: 100, weight_unit: 'g' });

    expect(tags).toContain('lightweight');
  });

  it('should generate oversized tag for large volume', () => {
    const tags = generateFitTags({ width: 100, height: 100, depth: 100 });

    expect(tags).toContain('oversized');
  });

  it('should generate delicate tag for small volume', () => {
    const tags = generateFitTags({ width: 5, height: 5, depth: 2 });

    expect(tags).toContain('delicate');
  });

  it('should generate flat tag for thin items', () => {
    const tags = generateFitTags({ width: 100, height: 100, depth: 1 });

    expect(tags).toContain('flat');
  });

  it('should generate tags from product type', () => {
    const furnitureTags = generateFitTags(undefined, 'Furniture');
    expect(furnitureTags).toContain('bulky');

    const jewelryTags = generateFitTags(undefined, 'Jewelry');
    expect(jewelryTags).toContain('delicate');

    const clothingTags = generateFitTags(undefined, 'Clothing');
    expect(clothingTags).toContain('flat');
  });

  it('should generate tags from product tags', () => {
    const fragileTags = generateFitTags(undefined, undefined, ['fragile', 'handle with care']);
    expect(fragileTags).toContain('delicate');

    const oversizedTags = generateFitTags(undefined, undefined, ['oversized', 'extra large']);
    expect(oversizedTags).toContain('bulky');
  });

  it('should combine multiple tags', () => {
    const tags = generateFitTags(
      { weight: 10, weight_unit: 'kg', width: 100, height: 100, depth: 100 },
      'Furniture',
      ['oversized']
    );

    expect(tags).toContain('bulky');
    expect(tags).toContain('oversized');
  });
});

describe('Platform Product Parsing', () => {
  it('should parse Shopify product', () => {
    const shopifyProduct = {
      id: 12345,
      title: 'Test Shirt',
      vendor: 'Test Brand',
      product_type: 'Clothing',
      tags: 'summer, lightweight',
      variants: [
        {
          id: 1,
          product_id: 12345,
          title: 'Red / S',
          price: '29.99',
          option1: 'Red',
          option2: 'S',
          grams: 200,
        },
      ],
      options: [
        { name: 'Color', values: ['Red'] },
        { name: 'Size', values: ['S'] },
      ],
    };

    const result = parsePlatformProduct({
      platform: 'shopify',
      product: shopifyProduct,
    });

    expect(result.external_id).toBe('12345');
    expect(result.product_name).toBe('Test Shirt');
    expect(result.brand).toBe('Test Brand');
    expect(result.category).toBe('Clothing');
    expect(result.variants).toHaveLength(1);
    expect(result.variants?.[0].color).toBe('Red');
    expect(result.fit_tags).toContain('flat'); // From Clothing type
    expect(result.fit_tags).toContain('lightweight'); // From weight
  });

  it('should parse WooCommerce product', () => {
    const wooProduct = {
      id: 99,
      name: 'Test Poster',
      categories: [{ name: 'Art' }],
      permalink: 'https://shop.com/product/poster',
      dimensions: { length: '50', width: '70', height: '0.1' },
      weight: '0.2',
      tags: [{ name: 'wall art' }],
    };

    const wooVariants = [
      {
        id: 100,
        price: '19.99',
        regular_price: '24.99',
        attributes: [{ name: 'Size', option: 'Large' }],
      },
    ];

    const result = parsePlatformProduct({
      platform: 'woocommerce',
      product: wooProduct,
      variants: wooVariants,
    });

    expect(result.external_id).toBe('99');
    expect(result.product_name).toBe('Test Poster');
    expect(result.category).toBe('Art');
    expect(result.variants).toHaveLength(1);
    expect(result.product_dimensions?.width).toBe(70);
    expect(result.fit_tags).toContain('flat'); // From Art type
  });
});

describe('Edge Cases', () => {
  it('should handle empty variants array', () => {
    const variants = parseShopifyVariants([]);
    expect(variants).toEqual([]);
  });

  it('should handle missing option values', () => {
    const variants = parseShopifyVariants([
      {
        id: 1,
        product_id: 100,
        title: 'Default',
        price: '10',
        option1: undefined,
        option2: undefined,
        option3: undefined,
      },
    ]);

    expect(variants[0].color).toBeUndefined();
    expect(variants[0].size).toBeUndefined();
  });

  it('should handle decimal dimensions', () => {
    const dims = parseDimensionString('10.5x20.3x30.7cm');

    expect(dims.width).toBeCloseTo(10.5);
    expect(dims.height).toBeCloseTo(20.3);
    expect(dims.depth).toBeCloseTo(30.7);
  });

  it('should return empty array for no fit tags', () => {
    const tags = generateFitTags(undefined, undefined, undefined);
    expect(tags).toEqual([]);
  });
});
