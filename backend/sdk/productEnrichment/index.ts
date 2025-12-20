/**
 * Product Enrichment SDK
 * Main export file
 */

export { ProductEnrichmentEngine, createEnrichmentEngine } from './enrichProduct';
export {
  validateRawProduct,
  validateEnrichedFields,
  sanitizeProductName,
  normalizeCategory
} from './validateProduct';
export {
  parseShopifyVariants,
  parseWooCommerceVariants,
  parseShopifyDimensions,
  parseWooCommerceDimensions,
  parseDimensionString,
  generateFitTags,
  parsePlatformProduct,
  isColorValue,
  isSizeValue,
} from './variantParser';
export type {
  RawProductInput,
  EnrichedProductFields,
  EnrichedProduct,
  ClaudeEnrichmentResponse,
  ValidationResult,
  EnrichmentConfig,
  ProductVariant,
  ProductDimensions,
  FitTag,
} from './types';
export type {
  ShopifyVariant,
  WooCommerceVariant,
  PlatformProductData,
} from './variantParser';
