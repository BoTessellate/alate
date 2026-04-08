/**
 * Shared SDK Module
 *
 * Provides common utilities, error handling, validation,
 * and logging across all Mood Layer SDK modules.
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

// Module 6: User role & identity permissions
export * from './auth';

// Module 12: Centralized Supabase client factory
export * from './supabaseClient';

// Module 13: Storage utilities (Supabase Storage)
export { uploadToSupabaseStorage } from './storage';
