/**
 * Layout Generator SDK - Main Export
 * Intelligent moodboard layout generation system
 */

export * from './types';
export * from './layoutArchetypes';
export * from './generateLayout';
export { generateLayoutHandler, setupLayoutRoutes } from './routes/api/generateLayout';

// Re-export for convenience
export { createLayoutGenerator, LayoutGenerator } from './generateLayout';
export {
  LAYOUT_ARCHETYPES,
  getArchetype,
  getAllArchetypes,
  findArchetypesForProductCount,
  getRecommendedArchetype
} from './layoutArchetypes';
