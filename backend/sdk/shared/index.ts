/**
 * Shared SDK Module
 *
 * Provides common utilities, error handling, validation,
 * and logging across all Mood Layer SDK modules.
 *
 * Full Build Phase - All 10 Modules:
 * 1. SDK Hardening (errors, validation, errorHandler)
 * 2. Logging & Monitoring (logger)
 * 3. Background Job Queue (jobQueue)
 * 4. Vision Model Proxy (visionClient)
 * 5. Board State Persistence (boardState)
 * 6. User Role & Permissions (auth)
 * 7. API Contracts (apiContracts)
 * 8. Plugin Authentication (pluginAuth)
 * 9. Search Intelligence (semanticSearch)
 * 10. Sharing & Collaboration (collaboration)
 */

// Module 1: Error classes and utilities
export * from './errors';

// Module 1: Validation schemas and middleware
export * from './validation';

// Module 1: Error handler middleware
export * from './errorHandler';

// Module 2: Logging utilities
export * from './logger';

// Module 3: Background job queue
export * from './jobQueue';

// Module 4: Vision model proxy (GPT-4 Vision)
export * from './visionClient';

// Module 5: Board state persistence
export * from './boardState';

// Module 6: User role & identity permissions
export * from './auth';

// Module 7: API contracts for frontend
export * from './apiContracts';

// Module 8: Plugin authentication (OAuth)
export * from './pluginAuth';

// Module 9: Semantic search intelligence
export * from './semanticSearch';

// Module 10: Sharing & collaboration
export * from './collaboration';

// Module 11: Secure API client (Edge Function wrapper)
export * from './secureApiClient';

// Module 12: Centralized Supabase client factory
export * from './supabaseClient';
