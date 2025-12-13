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
export type {
  RawProductInput,
  EnrichedProductFields,
  EnrichedProduct,
  ClaudeEnrichmentResponse,
  ValidationResult,
  EnrichmentConfig
} from './types';
