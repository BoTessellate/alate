/**
 * Plugin Bridge SDK
 * Public API exports for external platform integrations
 */

// Types
export * from './types';

// Authentication
export * from './pluginAuth';

// Canva Integration
export * from './canva/canvaSearch';
export * from './canva/canvaInsert';

// Commerce Sync
export * from './commerce/shopifySync';
export * from './commerce/wooSync';

// API Handlers
export { canvaSearchHandler } from './routes/api/plugin/canva/search';
export { canvaInsertHandler } from './routes/api/plugin/canva/insert';
