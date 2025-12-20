/**
 * Region SDK Module
 * Task 16: Region-Aware Product Recommendation
 *
 * Features:
 * - Region alias mapping (cities -> countries -> regions)
 * - Region extraction from natural language queries
 * - Region scoring for product ranking
 * - Brand/domain region inference
 */

export * from './types';
export * from './regionMatcher';

// Re-export convenience functions
export {
  createRegionMatcher,
  getRegionMatcher,
  extractRegion,
  calculateRegionScore,
  inferRegionFromBrand,
  RegionMatcher,
} from './regionMatcher';
