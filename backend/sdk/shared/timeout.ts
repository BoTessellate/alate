/**
 * Timeout Utilities
 *
 * Wraps async operations with timeout handling to prevent hanging requests.
 * Critical for production stability - prevents resource exhaustion from long-running operations.
 */

import { createModuleLogger } from './logger';

const log = createModuleLogger('timeout');

/**
 * Wraps a promise with a timeout
 * Rejects if the operation takes longer than the specified timeout
 *
 * @param handler - The async operation to execute
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 30s)
 * @param actionName - Human-readable name for logging
 * @returns Promise that resolves with handler result or rejects on timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => enrichProducts(products),
 *   30000,
 *   'Product enrichment'
 * );
 * ```
 */
export function withTimeout<T>(
  handler: () => Promise<T>,
  timeoutMs: number = 30000,
  actionName: string = 'Operation'
): Promise<T> {
  return Promise.race([
    handler(),
    new Promise<T>((_, reject) => {
      const timeout = setTimeout(() => {
        log.warn({ actionName, timeoutMs }, 'Operation timed out');
        reject(new TimeoutError(`${actionName} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Clear timeout if handler completes
      return timeout;
    })
  ]);
}

/**
 * Custom error class for timeout errors
 * Allows specific handling of timeout vs other errors
 */
export class TimeoutError extends Error {
  readonly isTimeout = true;
  readonly statusCode = 504; // Gateway Timeout

  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Type guard to check if an error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError ||
         (typeof error === 'object' && error !== null && 'isTimeout' in error);
}

/**
 * Configuration for different operation types
 * Adjust timeouts based on expected operation duration
 */
export const TIMEOUT_CONFIGS = {
  // Quick operations - database queries, simple API calls
  FAST: 5000,          // 5 seconds

  // Standard operations - most API endpoints
  STANDARD: 30000,     // 30 seconds

  // AI operations - enrichment, vision analysis
  AI: 45000,           // 45 seconds

  // Batch operations - bulk enrichment, Shopify sync
  BATCH: 120000,       // 2 minutes

  // Image generation - DALL-E, complex compositions
  IMAGE_GEN: 60000,    // 1 minute
} as const;
