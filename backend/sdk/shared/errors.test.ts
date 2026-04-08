/**
 * Tests for SDK Error Classes
 */

import { describe, it, expect } from 'vitest';
import {
  SDKError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
  TimeoutError,
  ConflictError,
  isSDKError,
  wrapError,
} from './errors';

describe('SDKError', () => {
  it('should create error with all properties', () => {
    const error = new SDKError(
      'Test error',
      'INTERNAL_ERROR',
      500,
      { requestId: '123' }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.context?.requestId).toBe('123');
    expect(error.timestamp).toBeDefined();
    expect(error.isOperational).toBe(true);
  });

  it('should serialize to JSON correctly', () => {
    const error = new SDKError('Test', 'INTERNAL_ERROR', 500);
    const json = error.toJSON();

    expect(json.error).toBe('SDKError');
    expect(json.code).toBe('INTERNAL_ERROR');
    expect(json.message).toBe('Test');
    expect(json.statusCode).toBe(500);
    expect(json.timestamp).toBeDefined();
  });

  it('should be an instance of Error', () => {
    const error = new SDKError('Test', 'INTERNAL_ERROR', 500);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof SDKError).toBe(true);
  });
});

describe('ValidationError', () => {
  it('should create validation error with error list', () => {
    const error = new ValidationError(
      'Validation failed',
      ['field1: required', 'field2: must be positive']
    );

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.errors).toHaveLength(2);
    expect(error.errors).toContain('field1: required');
  });

  it('should include errors in JSON output', () => {
    const error = new ValidationError('Failed', ['error1']);
    const json = error.toJSON();

    expect(json.validation_errors).toEqual(['error1']);
  });
});

describe('NotFoundError', () => {
  it('should create error with resource name', () => {
    const error = new NotFoundError('Product');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Product not found');
  });

  it('should create error with resource and identifier', () => {
    const error = new NotFoundError('Product', 'abc-123');

    expect(error.message).toBe("Product with identifier 'abc-123' not found");
    expect(error.context?.resource).toBe('Product');
  });
});

describe('UnauthorizedError', () => {
  it('should create with default message', () => {
    const error = new UnauthorizedError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Authentication required');
  });

  it('should create with custom message', () => {
    const error = new UnauthorizedError('Invalid token');
    expect(error.message).toBe('Invalid token');
  });
});

describe('ForbiddenError', () => {
  it('should create with default message', () => {
    const error = new ForbiddenError();

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Access denied');
  });
});

describe('RateLimitError', () => {
  it('should create with retry-after', () => {
    const error = new RateLimitError('Too many requests', 60);

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfter).toBe(60);
  });

  it('should include retry_after in JSON', () => {
    const error = new RateLimitError('Rate limited', 120);
    const json = error.toJSON();

    expect(json.retry_after).toBe(120);
  });
});

describe('ExternalServiceError', () => {
  it('should create with service name', () => {
    const originalError = new Error('Connection failed');
    const error = new ExternalServiceError('Claude API', 'Timeout', originalError);

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(error.serviceName).toBe('Claude API');
    expect(error.message).toBe('Claude API error: Timeout');
    expect(error.originalError).toBe(originalError);
  });
});

describe('DatabaseError', () => {
  it('should create with operation', () => {
    const error = new DatabaseError('Constraint violation', 'INSERT');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.operation).toBe('INSERT');
  });
});

describe('ConfigurationError', () => {
  it('should create non-operational error', () => {
    const error = new ConfigurationError('Missing API key');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('CONFIGURATION_ERROR');
    expect(error.isOperational).toBe(false);
  });
});

describe('TimeoutError', () => {
  it('should create with timeout value', () => {
    const error = new TimeoutError('enrichment', 5000);

    expect(error.statusCode).toBe(504);
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.timeoutMs).toBe(5000);
    expect(error.message).toBe("Operation 'enrichment' timed out after 5000ms");
  });
});

describe('ConflictError', () => {
  it('should create conflict error', () => {
    const error = new ConflictError('Resource already exists');

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT_ERROR');
  });
});

describe('isSDKError', () => {
  it('should return true for SDK errors', () => {
    expect(isSDKError(new SDKError('Test', 'INTERNAL_ERROR', 500))).toBe(true);
    expect(isSDKError(new ValidationError('Test'))).toBe(true);
    expect(isSDKError(new NotFoundError('Product'))).toBe(true);
  });

  it('should return false for non-SDK errors', () => {
    expect(isSDKError(new Error('Test'))).toBe(false);
    expect(isSDKError('string error')).toBe(false);
    expect(isSDKError(null)).toBe(false);
    expect(isSDKError(undefined)).toBe(false);
  });
});

describe('wrapError', () => {
  it('should return SDK errors unchanged', () => {
    const sdkError = new ValidationError('Test');
    const wrapped = wrapError(sdkError);

    expect(wrapped).toBe(sdkError);
  });

  it('should wrap standard Error objects', () => {
    const error = new Error('Standard error');
    const wrapped = wrapError(error);

    expect(wrapped).toBeInstanceOf(SDKError);
    expect(wrapped.message).toBe('Standard error');
    expect(wrapped.code).toBe('INTERNAL_ERROR');
    expect(wrapped.statusCode).toBe(500);
  });

  it('should wrap unknown values', () => {
    const wrapped = wrapError('string error');

    expect(wrapped).toBeInstanceOf(SDKError);
    expect(wrapped.message).toBe('An unexpected error occurred');
  });

  it('should include context in wrapped errors', () => {
    const wrapped = wrapError(new Error('Test'), { requestId: 'req-123' });

    expect(wrapped.context?.requestId).toBe('req-123');
  });
});
