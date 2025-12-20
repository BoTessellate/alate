/**
 * Layout AI SDK
 * Public API exports for smart label placement, aesthetic scoring, and layout intent
 *
 * Features:
 * - Smart label placement (GPT-4V or Claude)
 * - Aesthetic layout scoring (GPT-4V or Claude fallback)
 * - Layout archetype selection and intent calculation
 * - Fadeback Hero collage support
 */

// Vision clients for label placement
export * from './visionClient';

// Smart label generation
export * from './generateSmartLabels';

// Aesthetic scoring
export * from './visionScoreClient';
export * from './scoreLayout';

// Layout intent and archetype selection
export * from './layoutIntent';

// API routes
export { smartLabelHandler, setupSmartLabelRoutes } from './routes/api/smartLabel';
