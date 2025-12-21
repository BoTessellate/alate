/**
 * Shopify Product Transformer
 * Converts Shopify product format to TML enriched product format
 */

import type {
  ShopifyGraphQLProduct,
  ShopifyVariant,
  TransformOptions,
  TransformedProduct,
  TransformedVariant,
  ProductDimensions,
} from './types';

// Re-export for convenience
export type { TransformedProduct } from './types';

// ============================================================================
// Weight Conversion
// ============================================================================

/**
 * Convert Shopify weight to kilograms
 */
function convertWeightToKg(weight: number | null, unit: string): number | undefined {
  if (weight === null || weight === undefined) return undefined;

  switch (unit) {
    case 'GRAMS':
      return weight / 1000;
    case 'POUNDS':
      return weight * 0.453592;
    case 'OUNCES':
      return weight * 0.0283495;
    case 'KILOGRAMS':
    default:
      return weight;
  }
}

// ============================================================================
// Color/Size Detection
// ============================================================================

const COLOR_KEYWORDS = [
  'color', 'colour', 'colors', 'colours', 'finish', 'shade', 'hue',
];

const SIZE_KEYWORDS = [
  'size', 'sizes', 'dimension', 'dimensions', 'length', 'width',
];

/**
 * Detect if option is a color option
 */
function isColorOption(optionName: string): boolean {
  const lower = optionName.toLowerCase();
  return COLOR_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Detect if option is a size option
 */
function isSizeOption(optionName: string): boolean {
  const lower = optionName.toLowerCase();
  return SIZE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ============================================================================
// HTML Stripping
// ============================================================================

/**
 * Strip HTML tags from description
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// ID Extraction
// ============================================================================

/**
 * Extract numeric ID from Shopify GraphQL ID
 * e.g., "gid://shopify/Product/123456" -> "123456"
 */
function extractNumericId(gid: string): string {
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : gid;
}

// ============================================================================
// Variant Transformation
// ============================================================================

/**
 * Transform Shopify variant to TML variant
 */
function transformVariant(
  variant: ShopifyVariant,
  productHandle: string,
  shopDomain: string,
  primaryImage?: string
): TransformedVariant {
  const variantId = extractNumericId(variant.id);

  const transformed: TransformedVariant = {
    id: variantId,
    url: `https://${shopDomain}/products/${productHandle}?variant=${variantId}`,
    price: parseFloat(variant.price),
    sku: variant.sku || undefined,
    image_url: variant.image?.src || primaryImage,
  };

  // Extract color/size from selectedOptions
  for (const opt of variant.selectedOptions) {
    if (isColorOption(opt.name)) {
      transformed.color = opt.value;
    } else if (isSizeOption(opt.name)) {
      transformed.size = opt.value;
    }
  }

  return transformed;
}

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform Shopify product to TML format
 */
export function transformShopifyProduct(
  product: ShopifyGraphQLProduct,
  options: TransformOptions
): TransformedProduct {
  const { shopDomain, includeVariants = true, includeDimensions = true } = options;

  const externalId = extractNumericId(product.id);
  const primaryImage = product.images.edges[0]?.node.src;
  const allImages = product.images.edges.map((e) => e.node.src);
  const description = stripHtml(product.descriptionHtml);

  // Get first variant for price and dimensions
  const firstVariant = product.variants.edges[0]?.node;
  const price = firstVariant ? parseFloat(firstVariant.price) : 0;

  // Transform variants
  const variants: TransformedVariant[] = includeVariants
    ? product.variants.edges.map((e) =>
        transformVariant(e.node, product.handle, shopDomain, primaryImage)
      )
    : [];

  // Extract dimensions from first variant
  const dimensions: ProductDimensions | undefined =
    includeDimensions && firstVariant?.weight
      ? {
          weight: convertWeightToKg(firstVariant.weight, firstVariant.weightUnit),
          weight_unit: 'kg',
        }
      : undefined;

  return {
    product_name: product.title,
    brand: product.vendor || 'Unknown',
    category: product.productType || 'General',
    price,
    currency: 'USD', // Default, can be overridden per shop
    image_url: primaryImage,
    external_id: externalId,
    platform: 'shopify',
    shop_domain: shopDomain,
    variants: variants.length > 0 ? variants : undefined,
    product_dimensions: dimensions,
    _metadata: {
      description,
      tags: product.tags,
      handle: product.handle,
      status: product.status,
      all_images: allImages,
    },
  };
}

/**
 * Transform multiple products
 */
export function transformShopifyProducts(
  products: ShopifyGraphQLProduct[],
  options: TransformOptions
): TransformedProduct[] {
  return products.map((p) => transformShopifyProduct(p, options));
}

// ============================================================================
// Fit Tag Generation
// ============================================================================

/**
 * Generate fit tags based on product attributes
 * Used by layout engine for intelligent placement
 */
export type FitTag = 'bulky' | 'flat' | 'delicate' | 'lightweight' | 'oversized';

const BULKY_KEYWORDS = ['sofa', 'couch', 'bed', 'cabinet', 'wardrobe', 'dresser', 'table'];
const DELICATE_KEYWORDS = ['glass', 'ceramic', 'crystal', 'porcelain', 'vase', 'lamp'];
const FLAT_KEYWORDS = ['rug', 'carpet', 'mat', 'poster', 'print', 'art', 'frame', 'mirror'];
const OVERSIZED_KEYWORDS = ['sectional', 'king', 'queen', 'dining table'];

export function generateFitTags(
  product: TransformedProduct
): FitTag[] {
  const tags: FitTag[] = [];
  const searchText = [
    product.product_name,
    product.category,
    ...product._metadata.tags,
  ]
    .join(' ')
    .toLowerCase();

  // Check for bulky items
  if (BULKY_KEYWORDS.some((kw) => searchText.includes(kw))) {
    tags.push('bulky');
  }

  // Check for delicate items
  if (DELICATE_KEYWORDS.some((kw) => searchText.includes(kw))) {
    tags.push('delicate');
  }

  // Check for flat items
  if (FLAT_KEYWORDS.some((kw) => searchText.includes(kw))) {
    tags.push('flat');
  }

  // Check for oversized items
  if (OVERSIZED_KEYWORDS.some((kw) => searchText.includes(kw))) {
    tags.push('oversized');
  }

  // Check weight for lightweight
  if (product.product_dimensions?.weight && product.product_dimensions.weight < 2) {
    tags.push('lightweight');
  }

  return tags;
}
