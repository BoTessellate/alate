/**
 * Search Engine SDK - Main Export
 * Dual-mode product search with tag-based and AI-powered natural language queries
 *
 * Features:
 * - Tag-based search with array matching
 * - AI-powered natural language search (Claude)
 * - Region-aware search with scoring (Task 16)
 * - Unified filter & sort system (Task 19)
 */

export * from './types';
export * from './searchByTag';
export * from './searchByPrompt';
export * from './searchWithRegion';
export * from './schema/filters';
export * from './filterEngine';
export { searchProductsHandler, setupSearchRoutes } from './routes/api/searchProducts';
export {
  filterProductsHandler,
  filterProductsGetHandler,
  filterMetadataHandler,
  filterOptionsHandler,
  filterPresetsHandler,
  setupFilterRoutes,
} from './routes/api/filterProducts';

// Re-export for convenience
export { createTagSearchEngine, TagSearchEngine } from './searchByTag';
export { createPromptSearchEngine, PromptSearchEngine } from './searchByPrompt';
export { createRegionSearchEngine, RegionSearchEngine } from './searchWithRegion';
export {
  filterAndSortProducts,
  applyFilters,
  sortProducts,
  getFilterMetadata,
  getColorFamily,
  calculateColorMatchScore,
} from './filterEngine';
