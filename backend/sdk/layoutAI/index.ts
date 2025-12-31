/**
 * Layout AI SDK (v4)
 * AI-powered layout composition with 4 simplified archetypes
 *
 * Features:
 * - Smart label placement (Claude or GPT-4V)
 * - Aesthetic layout scoring with feedback loop
 * - Vision AI product analysis for optimal placement
 * - Layout intent calculation with archetype recommendations
 *
 * Archetypes:
 * - Minimal: Clean, whitespace-focused (2-4 products)
 * - Hero: Central focus with supporting items (3-6 products)
 * - Dynamic: Flowing, editorial style (3-8 products)
 * - Collage: Organic, overlapping (4-12 products)
 */

// Vision clients for label placement
export * from './visionClient';

// Smart label generation
export * from './generateSmartLabels';

// Aesthetic scoring
export * from './visionScoreClient';
export * from './scoreLayout';

// Aesthetic feedback loop
export * from './aestheticFeedback';

// Vision AI product analyzer
export * from './visionAnalyzer';

// Layout intent and archetype selection
export * from './layoutIntent';

// API routes
export { smartLabelHandler, setupSmartLabelRoutes } from './routes/api/smartLabel';
