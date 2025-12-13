/**
 * Search Engine SDK - Main Export
 * Dual-mode product search with tag-based and AI-powered natural language queries
 */

export * from './types';
export * from './searchByTag';
export * from './searchByPrompt';
export { searchProductsHandler, setupSearchRoutes } from './routes/api/searchProducts';

// Re-export for convenience
export { createTagSearchEngine, TagSearchEngine } from './searchByTag';
export { createPromptSearchEngine, PromptSearchEngine } from './searchByPrompt';
