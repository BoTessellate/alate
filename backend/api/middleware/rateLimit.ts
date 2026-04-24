/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse and prevents exhausting external API quotas.
 * Uses in-memory storage with automatic cleanup of expired entries.
 *
 * IMPORTANT: In-memory rate limiting resets on each serverless function cold start.
 * For production, consider using Redis or Vercel KV for persistent rate limiting.
 */

import { createModuleLogger } from '../../sdk/shared/logger';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const log = createModuleLogger('rate-limit');

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage (resets on function cold start)
const rateLimits = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Rate limit configuration options
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests?: number;

  /** Time window in milliseconds */
  windowMs?: number;

  /** Custom identifier function (default: IP address) */
  getIdentifier?: (req: VercelRequest) => string;

  /** Custom error message */
  message?: string;

  /** Custom status code (default: 429) */
  statusCode?: number;

  /** Skip rate limiting for certain conditions */
  skip?: (req: VercelRequest) => boolean;
}

/**
 * Get client identifier — prefer a stable per-device ID sent by the
 * mobile client (`X-Device-Id` header), falling back to IP address.
 *
 * Why prefer device-id: multiple users behind a shared NAT (coffee shop
 * wifi, campus wifi, carrier CGNAT) share a single IP. IP-only rate
 * limits either unfairly penalise a cohort OR have to be set so high
 * they're useless against single-actor abuse. Device IDs sidestep that:
 * each install gets its own bucket. We still fall back to IP for
 * web/partner traffic that doesn't send the header, preserving the
 * existing protection.
 */
function getDefaultIdentifier(req: VercelRequest): string {
  // Prefer stable client-supplied device ID (the mobile app generates
  // one on first launch and persists via AsyncStorage).
  const deviceId = req.headers['x-device-id'];
  if (typeof deviceId === 'string' && deviceId.length >= 8) {
    // Namespace to avoid collision with raw IPs.
    return `dev:${deviceId}`;
  }

  // Try various headers for real IP (Vercel sets x-forwarded-for)
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return `ip:${forwarded.split(',')[0].trim()}`;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return `ip:${realIp}`;
  }

  // Fallback to 'unknown' (shouldn't happen on Vercel)
  return 'unknown';
}

/**
 * Check rate limit for an identifier
 * Returns whether the request is allowed and remaining count
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimits.get(identifier);

  // No entry or expired - create new window
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimits.set(identifier, { count: 1, resetAt });

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
      limit: maxRequests
    };
  }

  // Within window - check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: maxRequests
    };
  }

  // Within window and under limit - increment
  entry.count++;

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: maxRequests
  };
}

/**
 * Express/Vercel middleware for rate limiting
 * Returns 429 if rate limit exceeded
 *
 * @example
 * ```typescript
 * export default rateLimit({ maxRequests: 10, windowMs: 60000 })(async (req, res) => {
 *   // Your handler
 * });
 * ```
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    maxRequests = 60,
    windowMs = 60000,
    getIdentifier = getDefaultIdentifier,
    message = 'Too many requests, please try again later',
    statusCode = 429,
    skip = () => false
  } = options;

  return function rateLimitMiddleware(
    handler: (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>
  ) {
    return async (req: VercelRequest, res: VercelResponse) => {
      // Skip rate limiting if condition met
      if (skip(req)) {
        return handler(req, res);
      }

      // Get client identifier
      const identifier = getIdentifier(req);

      // Check rate limit
      const limit = checkRateLimit(identifier, maxRequests, windowMs);

      // Add rate limit headers (standard RateLimit headers)
      res.setHeader('RateLimit-Limit', limit.limit.toString());
      res.setHeader('RateLimit-Remaining', limit.remaining.toString());
      res.setHeader('RateLimit-Reset', new Date(limit.resetAt).toUTCString());

      // Legacy headers (X-RateLimit-*)
      res.setHeader('X-RateLimit-Limit', limit.limit.toString());
      res.setHeader('X-RateLimit-Remaining', limit.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(limit.resetAt).toUTCString());

      if (!limit.allowed) {
        const resetInSeconds = Math.ceil((limit.resetAt - Date.now()) / 1000);

        log.warn({
          identifier,
          limit: limit.limit,
          resetInSeconds
        }, 'Rate limit exceeded');

        // Add Retry-After header
        res.setHeader('Retry-After', resetInSeconds.toString());

        return res.status(statusCode).json({
          error: 'Rate limit exceeded',
          message,
          resetAt: limit.resetAt,
          resetInSeconds,
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }

      // Log when approaching limit (80% threshold)
      if (limit.remaining < limit.limit * 0.2) {
        log.debug({
          identifier,
          remaining: limit.remaining,
          limit: limit.limit
        }, 'Approaching rate limit');
      }

      return handler(req, res);
    };
  };
}

/**
 * Pre-configured rate limiters for common scenarios
 */
export const RATE_LIMITERS = {
  /**
   * Strict limiter for expensive operations (AI, image generation)
   * 10 requests per minute
   */
  STRICT: (options: Partial<RateLimitOptions> = {}) =>
    rateLimit({
      maxRequests: 10,
      windowMs: 60000,
      message: 'Too many requests - this operation is rate limited to 10 per minute',
      ...options
    }),

  /**
   * Standard limiter for most API endpoints
   * 60 requests per minute
   */
  STANDARD: (options: Partial<RateLimitOptions> = {}) =>
    rateLimit({
      maxRequests: 60,
      windowMs: 60000,
      ...options
    }),

  /**
   * Lenient limiter for read-only operations
   * 120 requests per minute
   */
  LENIENT: (options: Partial<RateLimitOptions> = {}) =>
    rateLimit({
      maxRequests: 120,
      windowMs: 60000,
      ...options
    }),

  /**
   * Very strict limiter for auth endpoints
   * 5 requests per 5 minutes
   */
  AUTH: (options: Partial<RateLimitOptions> = {}) =>
    rateLimit({
      maxRequests: 5,
      windowMs: 5 * 60 * 1000,
      message: 'Too many authentication attempts - please wait 5 minutes',
      ...options
    }),
} as const;
