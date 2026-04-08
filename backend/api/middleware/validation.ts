/**
 * Request Validation Middleware
 *
 * Provides reusable validation helpers to eliminate duplicated validation logic
 * across API handlers. All validators return standardized error responses.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Standard validation error response */
interface ValidationError {
  error: string;
  field?: string;
  code: 'VALIDATION_ERROR';
}

/** Validation result - either success or error response */
type ValidationResult = { valid: true } | { valid: false; response: ValidationError };

/**
 * Validate that required fields exist in request body
 *
 * @example
 * const validation = validateRequired(req.body, ['image_url', 'device_id']);
 * if (!validation.valid) {
 *   return res.status(400).json(validation.response);
 * }
 */
export function validateRequired(
  body: any,
  fields: string[]
): ValidationResult {
  for (const field of fields) {
    if (!body || body[field] === undefined || body[field] === null || body[field] === '') {
      return {
        valid: false,
        response: {
          error: `${field} is required`,
          field,
          code: 'VALIDATION_ERROR'
        }
      };
    }
  }
  return { valid: true };
}

/**
 * Validate that a value is one of allowed enum values
 *
 * @example
 * const validation = validateEnum(body.productType, ['fashion', 'home'], 'productType');
 * if (!validation.valid) {
 *   return res.status(400).json(validation.response);
 * }
 */
export function validateEnum(
  value: any,
  allowedValues: string[],
  fieldName: string
): ValidationResult {
  if (!value || !allowedValues.includes(value)) {
    return {
      valid: false,
      response: {
        error: `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }
  return { valid: true };
}

/**
 * Validate that an array exists and has items
 *
 * @example
 * const validation = validateArray(body.products, 'products', { min: 1, max: 10 });
 * if (!validation.valid) {
 *   return res.status(400).json(validation.response);
 * }
 */
export function validateArray(
  value: any,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): ValidationResult {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be an array`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  if (options.min !== undefined && value.length < options.min) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must have at least ${options.min} item(s)`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  if (options.max !== undefined && value.length > options.max) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must have at most ${options.max} item(s)`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  return { valid: true };
}

/**
 * Validate URL format
 *
 * @example
 * const validation = validateUrl(body.image_url, 'image_url');
 * if (!validation.valid) {
 *   return res.status(400).json(validation.response);
 * }
 */
export function validateUrl(
  value: any,
  fieldName: string
): ValidationResult {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be a valid URL string`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  try {
    new URL(value);
    return { valid: true };
  } catch {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be a valid URL`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }
}

/**
 * Validate number range
 *
 * @example
 * const validation = validateNumber(body.limit, 'limit', { min: 1, max: 100 });
 * if (!validation.valid) {
 *   return res.status(400).json(validation.response);
 * }
 */
export function validateNumber(
  value: any,
  fieldName: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof num !== 'number' || isNaN(num)) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be a valid number`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  if (options.integer && !Number.isInteger(num)) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be an integer`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  if (options.min !== undefined && num < options.min) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be at least ${options.min}`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  if (options.max !== undefined && num > options.max) {
    return {
      valid: false,
      response: {
        error: `${fieldName} must be at most ${options.max}`,
        field: fieldName,
        code: 'VALIDATION_ERROR'
      }
    };
  }

  return { valid: true };
}

/**
 * Combine multiple validation results
 *
 * WHY: Allows running multiple validations and returning the first error
 *
 * @example
 * const result = combineValidations([
 *   validateRequired(req.body, ['name', 'email']),
 *   validateEmail(req.body.email, 'email')
 * ]);
 * if (!result.valid) {
 *   return res.status(400).json(result.response);
 * }
 */
export function combineValidations(validations: ValidationResult[]): ValidationResult {
  for (const validation of validations) {
    if (!validation.valid) {
      return validation;
    }
  }
  return { valid: true };
}

/**
 * Validation middleware factory
 *
 * Creates a middleware function that validates request body before passing to handler.
 *
 * @example
 * const validateUpload = withValidation((body) => {
 *   return combineValidations([
 *     validateRequired(body, ['image', 'device_id']),
 *     validateEnum(body.context, ['fashion', 'home'], 'context')
 *   ]);
 * });
 *
 * export default validateUpload(async (req, res) => {
 *   // Handler logic - body is already validated
 * });
 */
export function withValidation(
  validator: (body: any, query: any) => ValidationResult
) {
  return (handler: (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>) => {
    return async (req: VercelRequest, res: VercelResponse): Promise<void | VercelResponse> => {
      const validation = validator(req.body, req.query);

      if (!validation.valid) {
        return res.status(400).json(validation.response);
      }

      return handler(req, res);
    };
  };
}
