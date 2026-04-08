/**
 * Express Error Handler Middleware for Mood Layer SDK
 *
 * Provides centralized error handling that catches all errors
 * and returns consistent, structured error responses.
 */

import { Request, Response, NextFunction } from 'express';
import { SDKError, wrapError, isSDKError } from './errors';

/**
 * Not found handler - use for routes that don't exist
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'NotFoundError',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Global error handler middleware
 * Must be registered last in the Express middleware chain
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error for debugging
  console.error(`[${new Date().toISOString()}] Error:`, {
    method: req.method,
    path: req.path,
    error: error.message,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
  });

  // Convert to SDKError if not already
  const sdkError = isSDKError(error) ? error : wrapError(error, {
    requestId: req.headers['x-request-id'] as string,
  });

  // Send response
  res.status(sdkError.statusCode).json(sdkError.toJSON());
}

/**
 * Async handler wrapper to catch async errors
 * Wraps async route handlers to ensure errors are passed to error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request timeout middleware
 * Aborts requests that take too long
 */
export function timeoutHandler(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: 'TimeoutError',
          code: 'TIMEOUT_ERROR',
          message: `Request timed out after ${timeoutMs}ms`,
          statusCode: 504,
          timestamp: new Date().toISOString(),
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * CORS middleware with configurable options
 */
export function corsMiddleware(options: {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
} = {}) {
  const {
    allowedOrigins = ['*'],
    allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '*';
    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
    }

    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}
