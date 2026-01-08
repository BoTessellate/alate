/**
 * Shopify Product Transformer
 * Converts Shopify product format to TML enriched product format
 */

import type {
  ShopifyGraphQLProduct,
  ShopifyVariant,
  ShopifyMetafield,
  TransformOptions,
  TransformedProduct,
  TransformedVariant,
  ProductDimensions,
  SizeChartEntry,
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
// Metafield Extraction for Sizing/Dimensions
// ============================================================================

// Common metafield namespaces and keys for sizing data
const SIZING_METAFIELD_KEYS = [
  // Size chart related
  'size_chart', 'sizechart', 'size-chart',
  'sizing', 'sizing_guide', 'sizing-guide',
  'measurements', 'measurement_chart',
  // Fit info
  'fit', 'fit_guide', 'fit_type', 'fit_info',
  'true_to_size', 'sizing_notes',
  // Material/care
  'material', 'materials', 'fabric', 'composition',
  'care', 'care_instructions', 'washing_instructions',
  // Dimensions
  'dimensions', 'product_dimensions',
  'width', 'height', 'length', 'depth',
];

const SIZING_NAMESPACES = [
  'custom', 'global', 'product', 'my_fields',
  'sizing', 'dimensions', 'metafields',
];

/**
 * Extract metafields from GraphQL edges format
 */
function extractMetafields(
  metafieldsEdges?: { edges: Array<{ node: ShopifyMetafield }> }
): ShopifyMetafield[] {
  if (!metafieldsEdges?.edges) return [];
  return metafieldsEdges.edges.map((e) => e.node);
}

/**
 * Check if a metafield is related to sizing/dimensions
 */
function isSizingMetafield(metafield: ShopifyMetafield): boolean {
  const key = metafield.key.toLowerCase();
  const namespace = metafield.namespace.toLowerCase();

  return (
    SIZING_METAFIELD_KEYS.some((k) => key.includes(k)) ||
    SIZING_NAMESPACES.some((ns) => namespace.includes(ns) && key.includes('size'))
  );
}

/**
 * Parse size chart from metafield value
 * Handles JSON, pipe-delimited, and plain text formats
 */
function parseSizeChart(value: string): SizeChartEntry[] | undefined {
  try {
    // Try JSON parse first
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        size: entry.size || entry.name || 'Unknown',
        measurements: entry.measurements || entry,
      }));
    }
    // If it's an object with size keys
    if (typeof parsed === 'object') {
      return Object.entries(parsed).map(([size, measurements]) => ({
        size,
        measurements: typeof measurements === 'object' ? measurements as Record<string, string> : undefined,
      }));
    }
  } catch {
    // Not JSON, try other formats
  }

  // Try pipe-delimited format: "S: 34-36 chest | M: 38-40 chest | L: 42-44 chest"
  if (value.includes('|')) {
    const parts = value.split('|').map((p) => p.trim());
    const entries: SizeChartEntry[] = [];
    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        entries.push({
          size: part.substring(0, colonIdx).trim(),
          measurements: { info: part.substring(colonIdx + 1).trim() },
        });
      }
    }
    if (entries.length > 0) return entries;
  }

  return undefined;
}

/**
 * Extract sizing information from product metafields
 */
function extractSizingFromMetafields(
  metafields: ShopifyMetafield[]
): Partial<ProductDimensions> {
  const sizing: Partial<ProductDimensions> = {};

  for (const mf of metafields) {
    if (!isSizingMetafield(mf)) continue;

    const key = mf.key.toLowerCase();
    const value = mf.value;

    // Size chart
    if (key.includes('size_chart') || key.includes('sizechart') || key.includes('sizing')) {
      const chart = parseSizeChart(value);
      if (chart) sizing.size_chart = chart;
    }

    // Fit info
    if (key.includes('fit') && !key.includes('outfit')) {
      sizing.fit_info = value;
    }

    // Material info
    if (key.includes('material') || key.includes('fabric') || key.includes('composition')) {
      sizing.material_info = value;
    }

    // Care instructions
    if (key.includes('care') || key.includes('washing')) {
      sizing.care_instructions = value;
    }

    // Numeric dimensions
    if (key === 'width' && !isNaN(parseFloat(value))) {
      sizing.width = parseFloat(value);
    }
    if (key === 'height' && !isNaN(parseFloat(value))) {
      sizing.height = parseFloat(value);
    }
    if (key === 'depth' || key === 'length') {
      if (!isNaN(parseFloat(value))) {
        sizing.depth = parseFloat(value);
      }
    }
  }

  return sizing;
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

  // Extract dimensions from metafields and variant weight
  let dimensions: ProductDimensions | undefined = undefined;

  if (includeDimensions) {
    // Start with basic weight from variant
    dimensions = firstVariant?.weight
      ? {
          weight: convertWeightToKg(firstVariant.weight, firstVariant.weightUnit),
          weight_unit: 'kg',
        }
      : {};

    // Extract sizing info from product metafields
    const productMetafields = extractMetafields(product.metafields);
    if (productMetafields.length > 0) {
      const sizingInfo = extractSizingFromMetafields(productMetafields);
      dimensions = { ...dimensions, ...sizingInfo };
    }

    // Also check variant metafields for additional sizing data
    if (firstVariant?.metafields) {
      const variantMetafields = extractMetafields(firstVariant.metafields);
      if (variantMetafields.length > 0) {
        const variantSizing = extractSizingFromMetafields(variantMetafields);
        // Merge variant sizing (don't overwrite product-level data)
        dimensions = {
          ...dimensions,
          ...Object.fromEntries(
            Object.entries(variantSizing).filter(([, v]) => v !== undefined)
          ),
        };
      }
    }

    // If no dimensions were extracted, set to undefined
    if (Object.keys(dimensions).length === 0) {
      dimensions = undefined;
    }
  }

  return {
    product_name: product.title,
    brand: product.vendor || 'Unknown',
    category: product.productType || 'General',
    price,
    currency: 'USD', // Default, can be overridden per shop
    image_url: primaryImage,
    product_url: `https://${shopDomain}/products/${product.handle}`,
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
