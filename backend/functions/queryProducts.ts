/**
 * Query Products Function
 * Task 19: Unified Filter & Sort System
 *
 * Re-exports from SDK for backwards compatibility.
 * The actual implementation is now in sdk/searchEngine/queryProducts.ts
 */

export {
  queryProducts,
  queryProductsHandler,
  parseFilterQueryFromParams,
  FILTER_PRESETS,
  applyFilterPreset,
  type QueryProductsRequest,
  type QueryProductsResponse,
} from '../sdk/searchEngine/queryProducts';
