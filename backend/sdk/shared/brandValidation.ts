/**
 * Brand Validation Utility
 * Centralized validation to prevent AI-invented or fake brand names
 *
 * BUG TRACKING: This addresses a repeat issue where AI enrichment
 * generates fake brand names like "Silk Accessories", "Jewelry Boutique"
 */

/**
 * Patterns that indicate a fake/invented brand name rather than a real brand
 * These are descriptive phrases the AI might generate when it can't identify a real brand
 */
const FAKE_BRAND_PATTERNS = [
  // Category-like words
  /\b(accessories|boutique|collection|collective|essentials|studio|atelier)\b/i,
  /\b(classics|heritage|sportswear|activewear|outerwear|footwear)\b/i,
  // Material-based fake names
  /\b(silk|cotton|leather|wool|linen|denim|cashmere)\s*(brand|co|company|house|goods)?\b/i,
  // Style-based fake names
  /\b(elegant|classic|modern|vintage|luxury|premium)\s*(style|fashion|wear|essentials)?\b/i,
  // Generic descriptors
  /\b(store|vendor|seller|shop|gear)\s*\d*\b/i,
  /\bunknown\b/i,
  /\bn\/a\b/i,
  // Common fake suffixes
  /\b(menswear|womenswear|kidswear)\b/i,
  /\b(knits|knitting|knitwear)\b/i,
];

/**
 * Known real brand names that might match patterns but are legitimate
 * Add to this list as needed
 */
const KNOWN_REAL_BRANDS = new Set([
  'cos',
  'gap',
  'h&m',
  'zara',
  'nike',
  'adidas',
  'puma',
  'gucci',
  'prada',
  'chanel',
  'dior',
  'versace',
  'armani',
  'burberry',
  'coach',
  'fossil',
  'timberland',
  'levi\'s',
  'levis',
  'uniqlo',
  'mango',
  'massimo dutti',
  'pull&bear',
  'bershka',
  'stradivarius',
  'west elm',
  'pottery barn',
  'crate & barrel',
  'cb2',
  'ikea',
  'anthropologie',
  'urban outfitters',
  'free people',
  'reformation',
  'everlane',
  'aritzia',
  'lululemon',
  'allbirds',
  'patagonia',
  'north face',
  'columbia',
  'arc\'teryx',
]);

/**
 * Validate if a brand name looks like a real brand vs AI-invented description
 * @param brand - The brand name to validate
 * @returns The brand if valid, null if it looks fake
 */
export function validateBrandName(brand: string | null | undefined): string | null {
  if (!brand || typeof brand !== 'string') {
    return null;
  }

  const trimmed = brand.trim();

  // Empty or very short names are suspect
  if (trimmed.length < 2 || trimmed.length > 50) {
    return null;
  }

  // Check if it's a known real brand (case-insensitive)
  if (KNOWN_REAL_BRANDS.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  // Check against fake brand patterns
  for (const pattern of FAKE_BRAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      console.warn(`[BrandValidation] Rejected fake brand name: "${trimmed}"`);
      return null;
    }
  }

  // If brand is just a single generic word, reject it
  const singleWordGenerics = ['brand', 'product', 'item', 'goods', 'merchandise', 'gear', 'wear'];
  if (singleWordGenerics.includes(trimmed.toLowerCase())) {
    return null;
  }

  return trimmed;
}

/**
 * Sanitize a product object's brand field
 * Use this before inserting into database
 */
export function sanitizeProductBrand<T extends { brand?: string | null }>(product: T): T {
  return {
    ...product,
    brand: validateBrandName(product.brand),
  };
}

/**
 * Check if a brand name looks fake (for reporting/logging)
 */
export function isFakeBrand(brand: string | null | undefined): boolean {
  return brand != null && validateBrandName(brand) === null;
}
