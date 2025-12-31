/**
 * Placeholder Utility Tests
 * Tests for placeholder image generation and product URL utilities
 */

import {
  generatePlaceholderSVG,
  getPlaceholderURL,
  getProductImage,
  SAMPLE_PRODUCT_IMAGES,
  getRandomSampleImage,
  getSampleImageForProduct,
  getProductUrl,
  hasDirectBrandUrl,
} from '../placeholder';

describe('generatePlaceholderSVG', () => {
  describe('basic functionality', () => {
    it('generates a valid data URL', () => {
      const result = generatePlaceholderSVG('Test Product');
      expect(result).toMatch(/^data:image\/svg\+xml,/);
    });

    it('includes product initials', () => {
      const result = generatePlaceholderSVG('Test Product');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('TP'); // Initials of "Test Product"
    });

    it('includes SVG element with width and height', () => {
      const result = generatePlaceholderSVG('Test Product', 300, 400);
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('width="300"');
      expect(decoded).toContain('height="400"');
    });
  });

  describe('initials extraction', () => {
    it('extracts first two word initials', () => {
      const result = generatePlaceholderSVG('Modern Sofa Chair');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('MS'); // Only first 2 words
    });

    it('handles single word product names', () => {
      const result = generatePlaceholderSVG('Sofa');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('S');
    });

    it('strips TEST_ prefix from product names', () => {
      const result = generatePlaceholderSVG('TEST_Product Name');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('PN'); // "Product Name" initials
    });

    it('handles underscores as word separators', () => {
      const result = generatePlaceholderSVG('wooden_dining_table');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('WD'); // "wooden dining" initials
    });

    it('converts initials to uppercase', () => {
      const result = generatePlaceholderSVG('test product');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('TP');
    });
  });

  describe('default dimensions', () => {
    it('uses default 200x200 dimensions when not specified', () => {
      const result = generatePlaceholderSVG('Test');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('width="200"');
      expect(decoded).toContain('height="200"');
    });
  });

  describe('consistent coloring', () => {
    it('returns same color for same product name', () => {
      const result1 = generatePlaceholderSVG('Same Product');
      const result2 = generatePlaceholderSVG('Same Product');
      expect(result1).toBe(result2);
    });

    it('returns different colors for different product names', () => {
      const result1 = generatePlaceholderSVG('Product A');
      const result2 = generatePlaceholderSVG('Product B');
      // Colors should be different (though there's a small chance they collide)
      expect(result1).not.toBe(result2);
    });
  });

  describe('SVG structure', () => {
    it('contains rect element for background', () => {
      const result = generatePlaceholderSVG('Test');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('<rect');
      expect(decoded).toContain('fill=');
    });

    it('contains text element for initials', () => {
      const result = generatePlaceholderSVG('Test');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('<text');
      expect(decoded).toContain('text-anchor="middle"');
    });
  });
});

describe('getPlaceholderURL', () => {
  it('returns a placehold.co URL', () => {
    const result = getPlaceholderURL();
    expect(result).toContain('placehold.co');
  });

  it('includes specified dimensions', () => {
    const result = getPlaceholderURL(400, 300);
    expect(result).toContain('400x300');
  });

  it('uses default dimensions when not specified', () => {
    const result = getPlaceholderURL();
    expect(result).toContain('200x200');
  });

  it('includes custom text when provided', () => {
    const result = getPlaceholderURL(200, 200, 'Custom Text');
    expect(result).toContain(encodeURIComponent('Custom Text'));
  });

  it('uses "No Image" as default text', () => {
    const result = getPlaceholderURL();
    expect(result).toContain(encodeURIComponent('No Image'));
  });

  it('includes color parameters', () => {
    const result = getPlaceholderURL();
    expect(result).toContain('E8DFD5'); // Background color
    expect(result).toContain('666666'); // Text color
  });
});

describe('getProductImage', () => {
  describe('with valid image URL', () => {
    it('returns the provided image URL', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const result = getProductImage(imageUrl, 'Product Name');
      expect(result).toBe(imageUrl);
    });

    it('returns image URL even with whitespace', () => {
      const imageUrl = '  https://example.com/image.jpg  ';
      const result = getProductImage(imageUrl, 'Product Name');
      expect(result).toBe(imageUrl);
    });
  });

  describe('with null/undefined image URL', () => {
    it('returns placeholder SVG when imageUrl is null', () => {
      const result = getProductImage(null, 'Product Name');
      expect(result).toMatch(/^data:image\/svg\+xml,/);
    });

    it('returns placeholder SVG when imageUrl is undefined', () => {
      const result = getProductImage(undefined, 'Product Name');
      expect(result).toMatch(/^data:image\/svg\+xml,/);
    });

    it('returns placeholder SVG when imageUrl is empty string', () => {
      const result = getProductImage('', 'Product Name');
      expect(result).toMatch(/^data:image\/svg\+xml,/);
    });

    it('returns placeholder SVG when imageUrl is whitespace only', () => {
      const result = getProductImage('   ', 'Product Name');
      expect(result).toMatch(/^data:image\/svg\+xml,/);
    });
  });

  describe('custom size', () => {
    it('uses custom dimensions for placeholder', () => {
      const result = getProductImage(null, 'Product', { width: 400, height: 300 });
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('width="400"');
      expect(decoded).toContain('height="300"');
    });

    it('uses default 200x200 dimensions when size not specified', () => {
      const result = getProductImage(null, 'Product');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('width="200"');
      expect(decoded).toContain('height="200"');
    });
  });
});

describe('SAMPLE_PRODUCT_IMAGES', () => {
  it('contains 10 sample images', () => {
    expect(SAMPLE_PRODUCT_IMAGES).toHaveLength(10);
  });

  it('contains valid Unsplash URLs', () => {
    SAMPLE_PRODUCT_IMAGES.forEach(url => {
      expect(url).toContain('unsplash.com');
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  it('all images have crop parameters', () => {
    SAMPLE_PRODUCT_IMAGES.forEach(url => {
      expect(url).toContain('fit=crop');
      expect(url).toContain('w=400');
      expect(url).toContain('h=400');
    });
  });
});

describe('getRandomSampleImage', () => {
  it('returns a valid sample image URL', () => {
    const result = getRandomSampleImage();
    expect(SAMPLE_PRODUCT_IMAGES).toContain(result);
  });

  it('returns an Unsplash URL', () => {
    const result = getRandomSampleImage();
    expect(result).toContain('unsplash.com');
  });

  // Note: Due to randomness, we can't test specific distribution
  // but we can verify it returns valid images multiple times
  it('returns valid images on multiple calls', () => {
    for (let i = 0; i < 20; i++) {
      const result = getRandomSampleImage();
      expect(SAMPLE_PRODUCT_IMAGES).toContain(result);
    }
  });
});

describe('getSampleImageForProduct', () => {
  it('returns consistent image for same product ID', () => {
    const result1 = getSampleImageForProduct('product-123');
    const result2 = getSampleImageForProduct('product-123');
    expect(result1).toBe(result2);
  });

  it('returns a valid sample image', () => {
    const result = getSampleImageForProduct('any-product');
    expect(SAMPLE_PRODUCT_IMAGES).toContain(result);
  });

  it('returns different images for different product IDs', () => {
    // Test with enough IDs to likely get different images
    const ids = ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5'];
    const images = ids.map(id => getSampleImageForProduct(id));
    // At least some should be different (not all the same)
    const uniqueImages = [...new Set(images)];
    expect(uniqueImages.length).toBeGreaterThan(1);
  });

  it('handles empty string product ID', () => {
    const result = getSampleImageForProduct('');
    expect(SAMPLE_PRODUCT_IMAGES).toContain(result);
  });

  it('handles special characters in product ID', () => {
    const result = getSampleImageForProduct('product-@#$%^&*()');
    expect(SAMPLE_PRODUCT_IMAGES).toContain(result);
  });
});

describe('getProductUrl', () => {
  describe('known brands', () => {
    it('generates West Elm URL', () => {
      const result = getProductUrl('West Elm', 'Modern Sofa');
      expect(result).toContain('westelm.com');
      expect(result).toContain('Modern%20Sofa');
    });

    it('generates CB2 URL', () => {
      const result = getProductUrl('CB2', 'Coffee Table');
      expect(result).toContain('cb2.com');
      expect(result).toContain('Coffee%20Table');
    });

    it('generates Crate and Barrel URL', () => {
      const result = getProductUrl('Crate and Barrel', 'Dining Chair');
      expect(result).toContain('crateandbarrel.com');
    });

    it('generates Crate & Barrel URL (ampersand variant)', () => {
      const result = getProductUrl('Crate & Barrel', 'Dining Chair');
      expect(result).toContain('crateandbarrel.com');
    });

    it('generates IKEA URL', () => {
      const result = getProductUrl('IKEA', 'Bookshelf');
      expect(result).toContain('ikea.com');
    });

    it('generates Wayfair URL', () => {
      const result = getProductUrl('Wayfair', 'Rug');
      expect(result).toContain('wayfair.com');
    });

    it('generates Pottery Barn URL', () => {
      const result = getProductUrl('Pottery Barn', 'Bed Frame');
      expect(result).toContain('potterybarn.com');
    });

    it('generates Amazon URL', () => {
      const result = getProductUrl('Amazon', 'Lamp');
      expect(result).toContain('amazon.com');
    });

    it('generates Etsy URL', () => {
      const result = getProductUrl('Etsy', 'Handmade Vase');
      expect(result).toContain('etsy.com');
    });

    it('generates Target URL', () => {
      const result = getProductUrl('Target', 'Pillow');
      expect(result).toContain('target.com');
    });
  });

  describe('brand name normalization', () => {
    it('handles lowercase brand names', () => {
      const result = getProductUrl('west elm', 'Sofa');
      expect(result).toContain('westelm.com');
    });

    it('handles uppercase brand names', () => {
      const result = getProductUrl('WEST ELM', 'Sofa');
      expect(result).toContain('westelm.com');
    });

    it('handles TEST_ prefix in brand names', () => {
      const result = getProductUrl('TEST_West Elm', 'Sofa');
      expect(result).toContain('westelm.com');
    });

    it('handles underscores in brand names', () => {
      const result = getProductUrl('west_elm', 'Sofa');
      expect(result).toContain('westelm.com');
    });
  });

  describe('product name normalization', () => {
    it('handles TEST_ prefix in product names', () => {
      const result = getProductUrl('West Elm', 'TEST_Modern Sofa');
      expect(result).toContain('Modern%20Sofa');
      expect(result).not.toContain('TEST');
    });

    it('handles underscores in product names', () => {
      const result = getProductUrl('West Elm', 'Modern_Sofa');
      expect(result).toContain('Modern%20Sofa');
    });

    it('removes special characters from product names', () => {
      const result = getProductUrl('West Elm', 'Modern Sofa (Blue)');
      // Special chars like parentheses should be removed
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });
  });

  describe('unknown brands', () => {
    it('falls back to Google Shopping search', () => {
      const result = getProductUrl('Unknown Brand', 'Some Product');
      expect(result).toContain('google.com/search?tbm=shop');
      expect(result).toContain('unknown%20brand');
      // Product name preserves original casing
      expect(result).toContain('Some%20Product');
    });

    it('includes both brand and product in Google search', () => {
      const result = getProductUrl('Custom Brand', 'Special Item');
      expect(result).toContain('custom%20brand');
      // Product name preserves original casing
      expect(result).toContain('Special%20Item');
    });
  });

  describe('URL structure', () => {
    it('returns HTTPS URLs', () => {
      const knownResult = getProductUrl('West Elm', 'Sofa');
      const unknownResult = getProductUrl('Unknown', 'Product');
      expect(knownResult).toMatch(/^https:\/\//);
      expect(unknownResult).toMatch(/^https:\/\//);
    });

    it('includes www prefix', () => {
      const result = getProductUrl('West Elm', 'Sofa');
      expect(result).toContain('www.');
    });
  });
});

describe('hasDirectBrandUrl', () => {
  describe('known brands', () => {
    it('returns true for West Elm', () => {
      expect(hasDirectBrandUrl('West Elm')).toBe(true);
    });

    it('returns true for CB2', () => {
      expect(hasDirectBrandUrl('CB2')).toBe(true);
    });

    it('returns true for IKEA', () => {
      expect(hasDirectBrandUrl('IKEA')).toBe(true);
    });

    it('returns true for Wayfair', () => {
      expect(hasDirectBrandUrl('Wayfair')).toBe(true);
    });

    it('returns true for Amazon', () => {
      expect(hasDirectBrandUrl('Amazon')).toBe(true);
    });

    it('returns true for Pottery Barn', () => {
      expect(hasDirectBrandUrl('Pottery Barn')).toBe(true);
    });

    it('returns true for Crate and Barrel', () => {
      expect(hasDirectBrandUrl('Crate and Barrel')).toBe(true);
    });

    it('returns true for Herman Miller', () => {
      expect(hasDirectBrandUrl('Herman Miller')).toBe(true);
    });
  });

  describe('unknown brands', () => {
    it('returns false for unknown brand', () => {
      expect(hasDirectBrandUrl('Unknown Brand')).toBe(false);
    });

    it('returns false for random string', () => {
      expect(hasDirectBrandUrl('XYZ Company')).toBe(false);
    });

    it('matches empty string (edge case - empty string is substring of any string)', () => {
      // Note: Due to the implementation using includes(), empty string matches any brand key
      // This is an edge case behavior of the current implementation
      expect(hasDirectBrandUrl('')).toBe(true);
    });
  });

  describe('brand name normalization', () => {
    it('handles lowercase brand names', () => {
      expect(hasDirectBrandUrl('west elm')).toBe(true);
    });

    it('handles uppercase brand names', () => {
      expect(hasDirectBrandUrl('WEST ELM')).toBe(true);
    });

    it('handles TEST_ prefix', () => {
      expect(hasDirectBrandUrl('TEST_West Elm')).toBe(true);
    });

    it('handles underscores', () => {
      expect(hasDirectBrandUrl('west_elm')).toBe(true);
    });
  });

  describe('partial brand matches', () => {
    it('returns true for partial brand match (brand contains key)', () => {
      expect(hasDirectBrandUrl('West Elm USA')).toBe(true);
    });
  });
});
