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

// New enricher modules (extracted from ai.ts)
export { enrichProduct } from './enricher';
export { enrichProductBatch } from './enricher/batch';
export { inferBrand } from './enricher/brandInference';
export { saveEnrichedProduct } from './enricher/database';
export { getDemoEnrichment } from './enricher/demoMode';
export { buildEnrichmentPrompt } from './enricher/promptBuilder';
export { parseEnrichmentResponse } from './enricher/responseParser';
export { getRecentTagCorrections, buildFewShotExamples } from './enricher/tagFeedback';
// Shopify-specific enrichment (extracted from shopify.ts)
export { enrichShopifyProducts, enrichAllShopifyProducts } from './enricher/shopifyBatch';
export type {
  RawProduct as EnricherRawProduct,
  EnrichedProduct as EnricherEnrichedProduct,
  EnrichmentOptions,
  BatchEnrichmentResult,
  PendingProduct
} from './enricher/types';
export type { DemoEnrichment } from './enricher/demoMode';
export type { ShopifyProduct, ShopifyEnrichmentResult } from './enricher/shopifyBatch';

// Tag feedback save (extracted from ai.ts)
export { saveTagFeedback, type TagFeedback } from './enricher/tagFeedbackSave';

// Natural language parser (extracted from ai.ts)
export {
  parseProductDetails,
  type ParseProductDetailsInput,
  type ParseProductDetailsResult
} from './nlParser';
