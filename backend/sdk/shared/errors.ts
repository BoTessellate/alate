/**
 * Custom Error Classes for Mood Layer SDK
 *
 * Provides strongly-typed error handling across all SDK modules.
 * Each error class includes:
 * - HTTP status code for API responses
 * - Error code for programmatic handling
 * - Optional context data for debugging
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'CONFLICT_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  resource?: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Base error class for all SDK errors
 */
export class SDKError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly timestamp: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    context?: ErrorContext,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Validation errors - invalid input data
 */
export class ValidationError extends SDKError {
  public readonly errors: string[];

  constructor(message: string, errors: string[] = [], context?: ErrorContext) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      validation_errors: this.errors,
    };
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends SDKError {
  constructor(resource: string, identifier?: string, context?: ErrorContext) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { ...context, resource });
  }
}

/**
 * Authentication errors - missing or invalid credentials
 */
export class UnauthorizedError extends SDKError {
  constructor(message = 'Authentication required', context?: ErrorContext) {
    super(message, 'UNAUTHORIZED', 401, context);
  }
}

/**
 * Authorization errors - user lacks permission
 */
export class ForbiddenError extends SDKError {
  constructor(message = 'Access denied', context?: ErrorContext) {
    super(message, 'FORBIDDEN', 403, context);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends SDKError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, context?: ErrorContext) {
    super(message, 'RATE_LIMITED', 429, context);
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retry_after: this.retryAfter,
    };
  }
}

/**
 * External service errors (Claude API, Supabase, etc.)
 */
export class ExternalServiceError extends SDKError {
  public readonly serviceName: string;
  public readonly originalError?: Error;

  constructor(
    serviceName: string,
    message: string,
    originalError?: Error,
    context?: ErrorContext
  ) {
    super(
      `${serviceName} error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { ...context, details: { service: serviceName } }
    );
    this.serviceName = serviceName;
    this.originalError = originalError;
  }
}

/**
 * Database errors
 */
export class DatabaseError extends SDKError {
  public readonly operation?: string;

  constructor(message: string, operation?: string, context?: ErrorContext) {
    super(message, 'DATABASE_ERROR', 500, { ...context, details: { operation } });
    this.operation = operation;
  }
}

/**
 * Configuration errors - missing env vars, invalid config
 */
export class ConfigurationError extends SDKError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'CONFIGURATION_ERROR', 500, context, false);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends SDKError {
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number, context?: ErrorContext) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      504,
      context
    );
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Conflict errors - resource already exists, version mismatch
 */
export class ConflictError extends SDKError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'CONFLICT_ERROR', 409, context);
  }
}

/**
 * Type guard to check if an error is an SDKError
 */
export function isSDKError(error: unknown): error is SDKError {
  return error instanceof SDKError;
}

/**
 * Wrap unknown errors into SDKError
 */
export function wrapError(error: unknown, context?: ErrorContext): SDKError {
  if (isSDKError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new SDKError(
      error.message,
      'INTERNAL_ERROR',
      500,
      context,
      false
    );
  }

  return new SDKError(
    'An unexpected error occurred',
    'INTERNAL_ERROR',
    500,
    context,
    false
  );
}
