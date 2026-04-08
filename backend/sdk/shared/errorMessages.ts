/**
 * Standardized Error Messages
 *
 * Provides consistent, user-friendly error messages across the application.
 * All messages follow action-oriented language (e.g., "Unable to..." not "Failed to...").
 */

/**
 * Error message patterns
 *
 * WHY: Consistent error messages improve user experience and make debugging easier.
 *
 * RULES:
 * 1. Use action-oriented language: "Unable to connect" not "Connection failed"
 * 2. Provide context: What was being attempted when the error occurred
 * 3. Suggest next steps when possible: "Please try again" or "Contact support"
 * 4. Never expose internal details in production (stack traces, DB errors, API keys)
 */

export interface ErrorResponse {
  error: string;
  message?: string;
  code: string;
  hint?: string;
  statusCode?: number;
}

/**
 * Create a standardized error response
 *
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'AUTH_FAILED')
 * @param message - User-friendly error message
 * @param hint - Optional hint for resolving the error
 * @param statusCode - HTTP status code (default: 500)
 */
export function createErrorResponse(
  code: string,
  message: string,
  hint?: string,
  statusCode: number = 500
): ErrorResponse {
  return {
    error: message,
    code,
    ...(hint && { hint }),
    statusCode
  };
}

// ============================================================================
// AUTHENTICATION ERRORS
// ============================================================================

export const AUTH_ERRORS = {
  MISSING_TOKEN: createErrorResponse(
    'AUTH_MISSING_TOKEN',
    'Authentication required',
    'Please provide a valid authentication token',
    401
  ),
  INVALID_TOKEN: createErrorResponse(
    'AUTH_INVALID_TOKEN',
    'Invalid or expired token',
    'Please log in again',
    401
  ),
  UNAUTHORIZED: createErrorResponse(
    'AUTH_UNAUTHORIZED',
    'Unauthorized access',
    'You do not have permission to access this resource',
    403
  ),
};

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: (field: string) => createErrorResponse(
    'VALIDATION_REQUIRED',
    `${field} is required`,
    `Please provide a value for ${field}`,
    400
  ),
  INVALID_FORMAT: (field: string, expected: string) => createErrorResponse(
    'VALIDATION_INVALID_FORMAT',
    `Invalid ${field} format`,
    `Expected format: ${expected}`,
    400
  ),
  OUT_OF_RANGE: (field: string, min?: number, max?: number) => {
    let hint = '';
    if (min !== undefined && max !== undefined) {
      hint = `${field} must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      hint = `${field} must be at least ${min}`;
    } else if (max !== undefined) {
      hint = `${field} must be at most ${max}`;
    }
    return createErrorResponse(
      'VALIDATION_OUT_OF_RANGE',
      `${field} is out of valid range`,
      hint,
      400
    );
  },
};

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export const DATABASE_ERRORS = {
  CONNECTION_FAILED: createErrorResponse(
    'DB_CONNECTION_FAILED',
    'Unable to connect to database',
    'Please try again in a few moments',
    503
  ),
  QUERY_FAILED: createErrorResponse(
    'DB_QUERY_FAILED',
    'Unable to complete database operation',
    'Please try again or contact support if the problem persists',
    500
  ),
  NOT_FOUND: (resource: string) => createErrorResponse(
    'DB_NOT_FOUND',
    `${resource} not found`,
    'Please check the ID and try again',
    404
  ),
  ALREADY_EXISTS: (resource: string) => createErrorResponse(
    'DB_ALREADY_EXISTS',
    `${resource} already exists`,
    'Please use a different identifier',
    409
  ),
};

// ============================================================================
// AI/EXTERNAL SERVICE ERRORS
// ============================================================================

export const AI_ERRORS = {
  API_KEY_MISSING: (provider: string) => createErrorResponse(
    'AI_API_KEY_MISSING',
    `${provider} API key not configured`,
    'Please configure the API key in environment variables',
    500
  ),
  API_CALL_FAILED: (provider: string) => createErrorResponse(
    'AI_API_CALL_FAILED',
    `Unable to reach ${provider} API`,
    'Please try again in a few moments',
    503
  ),
  QUOTA_EXCEEDED: (provider: string) => createErrorResponse(
    'AI_QUOTA_EXCEEDED',
    `${provider} API quota exceeded`,
    'Please upgrade your plan or try again later',
    429
  ),
  TIMEOUT: (provider: string) => createErrorResponse(
    'AI_TIMEOUT',
    `${provider} request timed out`,
    'The operation took too long. Please try with a smaller request',
    504
  ),
};

// ============================================================================
// SYNC ERRORS
// ============================================================================

export const SYNC_ERRORS = {
  CLOUD_UNAVAILABLE: createErrorResponse(
    'SYNC_CLOUD_UNAVAILABLE',
    'Cloud sync unavailable',
    'Your data is saved locally and will sync when connection is restored',
    503
  ),
  CONFLICT: createErrorResponse(
    'SYNC_CONFLICT',
    'Sync conflict detected',
    'Please refresh and try again',
    409
  ),
};

// ============================================================================
// FILE UPLOAD ERRORS
// ============================================================================

export const UPLOAD_ERRORS = {
  FILE_TOO_LARGE: (maxSizeMB: number) => createErrorResponse(
    'UPLOAD_FILE_TOO_LARGE',
    'File size exceeds limit',
    `Maximum file size is ${maxSizeMB}MB`,
    413
  ),
  INVALID_FILE_TYPE: (allowedTypes: string[]) => createErrorResponse(
    'UPLOAD_INVALID_TYPE',
    'Invalid file type',
    `Allowed types: ${allowedTypes.join(', ')}`,
    400
  ),
  UPLOAD_FAILED: createErrorResponse(
    'UPLOAD_FAILED',
    'Unable to upload file',
    'Please check your connection and try again',
    500
  ),
};

// ============================================================================
// RATE LIMIT ERRORS
// ============================================================================

export const RATE_LIMIT_ERRORS = {
  TOO_MANY_REQUESTS: (retryAfterSeconds?: number) => createErrorResponse(
    'RATE_LIMIT_EXCEEDED',
    'Too many requests',
    retryAfterSeconds
      ? `Please wait ${retryAfterSeconds} seconds before trying again`
      : 'Please slow down and try again in a moment',
    429
  ),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize error for production
 *
 * WHY: Never expose internal error details (stack traces, DB schemas) to users.
 * In development, show full details. In production, show user-friendly message.
 *
 * @param error - Original error
 * @param fallbackMessage - User-friendly fallback message
 * @returns Sanitized error message
 */
export function sanitizeError(error: unknown, fallbackMessage: string = 'An unexpected error occurred'): string {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment && error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * Check if error is a known error type
 *
 * @param error - Error to check
 * @returns true if error has ErrorResponse structure
 */
export function isErrorResponse(error: any): error is ErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof error.error === 'string' &&
    typeof error.code === 'string'
  );
}
