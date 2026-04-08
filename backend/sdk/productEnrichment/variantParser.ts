/**
 * Variant Parser
 *
 * Parses product variants from different e-commerce platforms
 * into a unified Mood Layer format.
 *
 * Task 9: Product Variant + Dimension Support
 */

import {
  ProductVariant,
  ProductDimensions,
  FitTag,
  RawProductInput,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Shopify variant format
 */
export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  grams?: number;
  weight?: number;
  weight_unit?: string;
  image_id?: number;
}

/**
 * WooCommerce variant format
 */
export interface WooCommerceVariant {
  id: number;
  sku?: string;
  price: string;
  regular_price: string;
  attributes: Array<{
    name: string;
    option: string;
  }>;
  dimensions?: {
    length: string;
    width: string;
    height: string;
  };
  weight?: string;
  image?: {
    src: string;
  };
}

/**
 * Raw platform product data
 */
export interface PlatformProductData {
  platform: 'shopify' | 'woocommerce' | 'wix';
  product: any;
  variants?: any[];
}

// =============================================================================
// COLOR AND SIZE DETECTION
// =============================================================================

/**
 * Common color names for detection
 */
const COLOR_KEYWORDS = [
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple',
  'orange', 'brown', 'grey', 'gray', 'navy', 'beige', 'cream', 'gold',
  'silver', 'burgundy', 'teal', 'coral', 'mint', 'olive', 'maroon',
  'turquoise', 'indigo', 'violet', 'magenta', 'cyan', 'lime', 'tan',
  'ivory', 'charcoal', 'rose', 'blush', 'sage', 'rust', 'terracotta',
];

/**
 * Common size keywords for detection
 */
const SIZE_KEYWORDS = [
  'xs', 'extra small', 'small', 's', 'medium', 'm', 'large', 'l',
  'xl', 'extra large', 'xxl', '2xl', 'xxxl', '3xl',
  'one size', 'os', 'free size', 'universal',
  // Numeric sizes
  '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20',
  '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44',
];

/**
 * Check if a value is likely a color
 */
export function isColorValue(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return COLOR_KEYWORDS.some((color) =>
    lower === color || lower.includes(color)
  );
}

/**
 * Check if a value is likely a size
 */
export function isSizeValue(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return SIZE_KEYWORDS.some((size) =>
    lower === size || lower === `size ${size}`
  );
}

/**
 * Detect if an option name refers to color
 */
export function isColorOption(optionName: string): boolean {
  const lower = optionName.toLowerCase();
  return lower.includes('color') || lower.includes('colour');
}

/**
 * Detect if an option name refers to size
 */
export function isSizeOption(optionName: string): boolean {
  const lower = optionName.toLowerCase();
  return lower.includes('size') || lower === 'dimension';
}

// =============================================================================
// VARIANT PARSERS
// =============================================================================

/**
 * Parse Shopify variants into unified format
 */
export function parseShopifyVariants(
  variants: ShopifyVariant[],
  options?: Array<{ name: string; values: string[] }>,
  images?: Array<{ id: number; src: string }>
): ProductVariant[] {
  return variants.map((v) => {
    const variant: ProductVariant = {
      id: v.id.toString(),
      url: '', // Will be set by caller
      price: parseFloat(v.price),
      sku: v.sku,
    };

    // Parse options to determine color/size
    const optionValues = [v.option1, v.option2, v.option3].filter(Boolean);

    if (options && options.length > 0) {
      // Use option definitions to determine color/size
      options.forEach((opt, index) => {
        const value = optionValues[index];
        if (!value) return;

        if (isColorOption(opt.name)) {
          variant.color = value;
        } else if (isSizeOption(opt.name)) {
          variant.size = value;
        } else if (isColorValue(value)) {
          variant.color = value;
        } else if (isSizeValue(value)) {
          variant.size = value;
        }
      });
    } else {
      // Fallback: detect by value
      optionValues.forEach((value) => {
        if (!value) return;
        if (isColorValue(value) && !variant.color) {
          variant.color = value;
        } else if (isSizeValue(value) && !variant.size) {
          variant.size = value;
        }
      });
    }

    // Find variant image
    if (v.image_id && images) {
      const image = images.find((img) => img.id === v.image_id);
      if (image) {
        variant.image_url = image.src;
      }
    }

    return variant;
  });
}

/**
 * Parse WooCommerce variants into unified format
 */
export function parseWooCommerceVariants(
  variations: WooCommerceVariant[],
  baseUrl: string
): ProductVariant[] {
  return variations.map((v) => {
    const variant: ProductVariant = {
      id: v.id.toString(),
      url: `${baseUrl}?variation=${v.id}`,
      price: parseFloat(v.price || v.regular_price),
      sku: v.sku,
    };

    // Parse attributes
    v.attributes.forEach((attr) => {
      if (isColorOption(attr.name)) {
        variant.color = attr.option;
      } else if (isSizeOption(attr.name)) {
        variant.size = attr.option;
      } else if (isColorValue(attr.option)) {
        variant.color = attr.option;
      } else if (isSizeValue(attr.option)) {
        variant.size = attr.option;
      }
    });

    // Add image
    if (v.image?.src) {
      variant.image_url = v.image.src;
    }

    return variant;
  });
}

// =============================================================================
// DIMENSION PARSERS
// =============================================================================

/**
 * Parse Shopify dimensions
 */
export function parseShopifyDimensions(
  variant: ShopifyVariant
): ProductDimensions | undefined {
  if (!variant.weight && !variant.grams) {
    return undefined;
  }

  const dimensions: ProductDimensions = {};

  if (variant.grams) {
    dimensions.weight = variant.grams / 1000; // Convert to kg
    dimensions.weight_unit = 'kg';
  } else if (variant.weight) {
    dimensions.weight = variant.weight;
    dimensions.weight_unit = (variant.weight_unit as any) || 'kg';
  }

  return dimensions;
}

/**
 * Parse WooCommerce dimensions
 */
export function parseWooCommerceDimensions(
  dimensions?: { length: string; width: string; height: string },
  weight?: string
): ProductDimensions | undefined {
  if (!dimensions && !weight) {
    return undefined;
  }

  const parsed: ProductDimensions = {};

  if (dimensions) {
    if (dimensions.length) parsed.depth = parseFloat(dimensions.length);
    if (dimensions.width) parsed.width = parseFloat(dimensions.width);
    if (dimensions.height) parsed.height = parseFloat(dimensions.height);
  }

  if (weight) {
    parsed.weight = parseFloat(weight);
    parsed.weight_unit = 'kg'; // WooCommerce default
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

/**
 * Parse dimension string (legacy format)
 * Examples: "10x20x30cm", "5kg", "100g"
 */
export function parseDimensionString(dimensionStr: string): ProductDimensions {
  const dimensions: ProductDimensions = {};
  const lower = dimensionStr.toLowerCase().trim();

  // Match dimension patterns like "10x20x30cm" or "10 x 20 x 30 cm"
  const dimMatch = lower.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(cm|mm|m|in)?/);
  if (dimMatch) {
    let [_, w, h, d, unit] = dimMatch;
    let multiplier = 1;

    // Convert to cm
    if (unit === 'mm') multiplier = 0.1;
    else if (unit === 'm') multiplier = 100;
    else if (unit === 'in') multiplier = 2.54;

    dimensions.width = parseFloat(w) * multiplier;
    dimensions.height = parseFloat(h) * multiplier;
    dimensions.depth = parseFloat(d) * multiplier;
  }

  // Match weight patterns like "5kg" or "500g"
  const weightMatch = lower.match(/(\d+(?:\.\d+)?)\s*(kg|g|lbs?|oz)/);
  if (weightMatch) {
    const [_, value, unit] = weightMatch;
    dimensions.weight = parseFloat(value);
    dimensions.weight_unit = unit.replace('lbs', 'lbs').replace('lb', 'lbs') as any;
  }

  return dimensions;
}

// =============================================================================
// FIT TAG GENERATION
// =============================================================================

/**
 * Generate fit tags from dimensions and product data
 */
export function generateFitTags(
  dimensions?: ProductDimensions,
  productType?: string,
  tags?: string[]
): FitTag[] {
  const fitTags: Set<FitTag> = new Set();
  const productTypeLower = (productType || '').toLowerCase();
  const tagsLower = (tags || []).map((t) => t.toLowerCase());

  // Weight-based tags
  if (dimensions?.weight) {
    let weightKg = dimensions.weight;

    // Convert to kg
    if (dimensions.weight_unit === 'g') weightKg /= 1000;
    else if (dimensions.weight_unit === 'lbs') weightKg *= 0.453592;
    else if (dimensions.weight_unit === 'oz') weightKg *= 0.0283495;

    if (weightKg > 5) {
      fitTags.add('bulky');
    } else if (weightKg < 0.5) {
      fitTags.add('lightweight');
    }
  }

  // Volume-based tags
  if (dimensions?.width && dimensions?.height) {
    const volume = (dimensions.width || 0) * (dimensions.height || 0) * (dimensions.depth || 1);

    if (volume > 50000) {
      fitTags.add('oversized');
    } else if (volume < 100) {
      fitTags.add('delicate');
    }

    // Flat items (thin depth relative to width/height)
    if (dimensions.depth && dimensions.depth < dimensions.width / 10) {
      fitTags.add('flat');
    }
  }

  // Product type based tags
  const bulkyTypes = ['furniture', 'sofa', 'table', 'chair', 'bed', 'appliance'];
  const delicateTypes = ['jewelry', 'jewellery', 'glass', 'crystal', 'porcelain', 'ceramic'];
  const flatTypes = ['poster', 'print', 'art', 'clothing', 'apparel', 'textile', 'fabric'];

  if (bulkyTypes.some((t) => productTypeLower.includes(t))) {
    fitTags.add('bulky');
  }
  if (delicateTypes.some((t) => productTypeLower.includes(t))) {
    fitTags.add('delicate');
  }
  if (flatTypes.some((t) => productTypeLower.includes(t))) {
    fitTags.add('flat');
  }

  // Tag-based detection
  if (tagsLower.some((t) => t.includes('fragile') || t.includes('delicate'))) {
    fitTags.add('delicate');
  }
  if (tagsLower.some((t) => t.includes('oversized') || t.includes('large'))) {
    fitTags.add('bulky');
  }
  if (tagsLower.some((t) => t.includes('lightweight') || t.includes('light'))) {
    fitTags.add('lightweight');
  }

  return Array.from(fitTags);
}

// =============================================================================
// UNIFIED PRODUCT PARSER
// =============================================================================

/**
 * Parse platform product data into unified format
 */
export function parsePlatformProduct(data: PlatformProductData): Partial<RawProductInput> {
  const result: Partial<RawProductInput> = {
    platform: data.platform,
  };

  switch (data.platform) {
    case 'shopify': {
      const product = data.product;
      result.external_id = product.id?.toString();
      result.product_name = product.title;
      result.brand = product.vendor;
      result.category = product.product_type;

      // Parse variants
      if (product.variants?.length > 0) {
        result.variants = parseShopifyVariants(
          product.variants,
          product.options,
          product.images
        );

        // Get dimensions from first variant
        result.product_dimensions = parseShopifyDimensions(product.variants[0]);
      }

      // Generate fit tags
      const shopifyTags = product.tags?.split(',').map((t: string) => t.trim()) || [];
      result.fit_tags = generateFitTags(
        result.product_dimensions,
        product.product_type,
        shopifyTags
      );

      break;
    }

    case 'woocommerce': {
      const product = data.product;
      result.external_id = product.id?.toString();
      result.product_name = product.name;
      result.brand = product.brand || '';
      result.category = product.categories?.[0]?.name || '';

      // Parse variants
      if (data.variants && data.variants.length > 0) {
        result.variants = parseWooCommerceVariants(
          data.variants,
          product.permalink
        );
      }

      // Parse dimensions
      result.product_dimensions = parseWooCommerceDimensions(
        product.dimensions,
        product.weight
      );

      // Generate fit tags
      const wooTags = product.tags?.map((t: any) => t.name) || [];
      result.fit_tags = generateFitTags(
        result.product_dimensions,
        result.category,
        wooTags
      );

      break;
    }

    case 'wix': {
      const product = data.product;
      result.external_id = product.id;
      result.product_name = product.name;
      result.brand = product.brand || '';
      result.category = product.productType || '';

      // Wix variant parsing would go here
      // Structure varies by Wix store configuration

      break;
    }
  }

  return result;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  parseShopifyVariants,
  parseWooCommerceVariants,
  parseShopifyDimensions,
  parseWooCommerceDimensions,
  parseDimensionString,
  generateFitTags,
  parsePlatformProduct,
  isColorValue,
  isSizeValue,
};
