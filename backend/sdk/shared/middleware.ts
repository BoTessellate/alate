/**
 * Shared Middleware Module
 * Centralized CORS, rate limiting, and security middleware
 *
 * Use these helpers in Vercel serverless functions and Express routes
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Request, Response, NextFunction } from 'express';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get allowed origins from environment
 * Defaults to '*' in development, requires explicit config in production
 */
export function getAllowedOrigins(): string[] {
  const originsEnv = process.env.ALLOWED_ORIGINS;

  if (originsEnv) {
    return originsEnv.split(',').map((o) => o.trim());
  }

  // In production without explicit config, deny all except localhost
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[SECURITY] ALLOWED_ORIGINS not set in production. Defaulting to localhost only.'
    );
    return ['http://localhost:3000', 'http://localhost:5173'];
  }

  // Development: allow common local origins
  return [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  const allowed = getAllowedOrigins();

  // If '*' is in allowed list, allow all
  if (allowed.includes('*')) return true;

  // Check exact match first
  if (allowed.includes(origin)) return true;

  // Check for Vercel preview URL patterns
  // Pattern: https://{project}-{hash}-{username}.vercel.app
  // Always allow Vercel preview deployments in production for easier testing
  try {
    const originUrl = new URL(origin);
    if (originUrl.hostname.endsWith('.vercel.app')) {
      // Always allow Vercel preview deployments
      return true;
    }
  } catch {
    // Invalid URL, ignore
  }

  return false;
}

// ============================================================================
// CORS Headers
// ============================================================================

/**
 * CORS configuration type
 */
export interface CorsConfig {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Key',
  ],
  maxAge: 86400, // 24 hours
  credentials: true,
};

/**
 * Set CORS headers on a Vercel response
 * Returns true if this was a preflight request (caller should return early)
 */
export function setCorsHeaders(
  req: VercelRequest,
  res: VercelResponse,
  config: CorsConfig = {}
): boolean {
  const mergedConfig = { ...DEFAULT_CORS_CONFIG, ...config };
  const origin = req.headers.origin as string | undefined;

  // Check if origin is allowed using the shared helper
  const allowedOrigins = mergedConfig.allowedOrigins || getAllowedOrigins();
  const isAllowed = allowedOrigins.includes('*') || isOriginAllowed(origin);

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    mergedConfig.allowedMethods!.join(', ')
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    mergedConfig.allowedHeaders!.join(', ')
  );
  res.setHeader('Access-Control-Max-Age', String(mergedConfig.maxAge));

  if (mergedConfig.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

/**
 * Set security headers
 */
export function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Remove server identification
  res.removeHeader('X-Powered-By');
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Simple in-memory rate limiter
 * Note: In production with multiple instances, use Redis instead
 */
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Check rate limit for an IP
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const now = Date.now();
  const key = `rate:${ip}`;
  const record = rateLimitStore.get(key);

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitStore();
  }

  if (!record || now > record.resetAt) {
    // New window
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  if (record.count >= config.max) {
    // Rate limited
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfter,
    };
  }

  // Increment counter
  record.count++;
  return {
    allowed: true,
    remaining: config.max - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client IP from request
 */
export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Apply rate limiting to a Vercel handler
 * Returns true if rate limited (caller should return early)
 */
export function applyRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  config?: RateLimitConfig
): boolean {
  const ip = getClientIp(req);
  const result = checkRateLimit(ip, config);

  res.setHeader('X-RateLimit-Limit', String(config?.max || DEFAULT_RATE_LIMIT.max));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    });
    return true;
  }

  return false;
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Blocked URL patterns for SSRF protection
 */
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.azure.internal',
];

const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'javascript:', 'data:'];

/**
 * Validate a URL for SSRF protection
 */
export function validateUrl(
  urlString: string
): { valid: boolean; error?: string; url?: URL } {
  try {
    const url = new URL(urlString);

    // Check protocol
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: `Invalid protocol: ${url.protocol}` };
    }

    if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
      return { valid: false, error: 'Protocol not allowed' };
    }

    // Check hostname
    const hostname = url.hostname.toLowerCase();

    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        return { valid: false, error: 'Host not allowed' };
      }
    }

    // Block private IP ranges
    if (isPrivateIp(hostname)) {
      return { valid: false, error: 'Private IP addresses not allowed' };
    }

    return { valid: true, url };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if an IP is in a private range
 */
function isPrivateIp(hostname: string): boolean {
  // Check for IP address patterns
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);

  if (!match) return false;

  const [, a, b, c] = match.map(Number);

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8
  if (a === 127) return true;

  return false;
}

// ============================================================================
// Combined Middleware Helper
// ============================================================================

/**
 * Apply all standard middleware to a Vercel handler
 * Returns true if the request was handled (preflight or rate limited)
 */
export function applyMiddleware(
  req: VercelRequest,
  res: VercelResponse,
  options: {
    cors?: CorsConfig;
    rateLimit?: RateLimitConfig | false;
    security?: boolean;
  } = {}
): boolean {
  const { cors, rateLimit, security = true } = options;

  // Security headers
  if (security) {
    setSecurityHeaders(res);
  }

  // CORS
  const isPreflight = setCorsHeaders(req, res, cors);
  if (isPreflight) return true;

  // Rate limiting
  if (rateLimit !== false) {
    const isRateLimited = applyRateLimit(
      req,
      res,
      rateLimit || undefined
    );
    if (isRateLimited) return true;
  }

  return false;
}

// ============================================================================
// Express Middleware (for non-Vercel routes)
// ============================================================================

/**
 * Express CORS middleware using shared configuration
 */
export function expressCorsMiddleware(config?: CorsConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const mergedConfig = { ...DEFAULT_CORS_CONFIG, ...config };
    const origin = req.headers.origin;

    const allowedOrigins = mergedConfig.allowedOrigins || getAllowedOrigins();
    const isAllowed =
      allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin));

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      mergedConfig.allowedMethods!.join(', ')
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      mergedConfig.allowedHeaders!.join(', ')
    );

    if (mergedConfig.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Express rate limiting middleware
 */
export function expressRateLimitMiddleware(config?: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const result = checkRateLimit(ip, config);

    res.setHeader('X-RateLimit-Limit', String(config?.max || DEFAULT_RATE_LIMIT.max));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfter));
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      });
      return;
    }

    next();
  };
}
