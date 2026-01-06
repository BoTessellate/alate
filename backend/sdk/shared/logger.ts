/**
 * Centralized Logger for Mood Layer SDK
 *
 * Uses Pino for high-performance structured logging.
 * Provides consistent logging across all SDK modules with:
 * - Structured JSON output for production
 * - Pretty printing for development
 * - Child loggers for module-specific context
 * - Request logging middleware
 */

import pino, { Logger, LoggerOptions } from 'pino';
import { Request, Response, NextFunction } from 'express';

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Logger configuration
 */
const loggerOptions: LoggerOptions = {
  level: logLevel,
  base: {
    service: 'moodlayer-sdk',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
    }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'apiKey',
      'api_key',
      'secret',
      'token',
      'accessToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
};

/**
 * Create the base logger instance
 * Uses pino-pretty in development for readable output
 */
const transport = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        singleLine: false,
      },
    }
  : undefined;

const baseLogger: Logger = pino({
  ...loggerOptions,
  transport,
});

/**
 * Create a child logger for a specific SDK module
 */
export function createModuleLogger(moduleName: string): Logger {
  return baseLogger.child({ module: moduleName });
}

/**
 * Default logger instance
 */
export const logger = baseLogger;

/**
 * Request ID generator
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Express request logging middleware
 *
 * Logs incoming requests and outgoing responses with timing info.
 * Adds request ID to each request for tracing.
 */
export function requestLogger(options: {
  excludePaths?: string[];
  logBody?: boolean;
  logQuery?: boolean;
} = {}) {
  const {
    excludePaths = ['/health', '/ping', '/favicon.ico'],
    logBody = false,
    logQuery = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Generate/get request ID
    const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    // Create request-scoped logger
    const reqLogger = baseLogger.child({
      requestId,
      method: req.method,
      path: req.path,
    });

    // Attach logger to request for use in route handlers
    (req as any).log = reqLogger;

    // Start time
    const startTime = Date.now();

    // Log request
    const requestData: Record<string, unknown> = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'],
    };

    if (logQuery && Object.keys(req.query).length > 0) {
      requestData.query = req.query;
    }

    if (logBody && req.body && Object.keys(req.body).length > 0) {
      requestData.body = req.body;
    }

    reqLogger.info(requestData, 'Incoming request');

    // Capture response
    const originalEnd = res.end.bind(res);
    res.end = function (chunk?: any, encoding?: any, callback?: any) {
      const duration = Date.now() - startTime;

      reqLogger.info(
        {
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('content-length'),
        },
        'Request completed'
      );

      return originalEnd(chunk, encoding, callback);
    };

    next();
  };
}

/**
 * Log API call to external service
 */
export function logApiCall(
  logger: Logger,
  serviceName: string,
  operation: string,
  startTime: number,
  success: boolean,
  metadata?: Record<string, unknown>
) {
  const duration = Date.now() - startTime;

  if (success) {
    logger.info(
      {
        service: serviceName,
        operation,
        duration: `${duration}ms`,
        ...metadata,
      },
      `${serviceName} API call completed`
    );
  } else {
    logger.error(
      {
        service: serviceName,
        operation,
        duration: `${duration}ms`,
        ...metadata,
      },
      `${serviceName} API call failed`
    );
  }
}

/**
 * Log database operation
 */
export function logDbOperation(
  logger: Logger,
  operation: string,
  table: string,
  startTime: number,
  success: boolean,
  rowCount?: number,
  error?: Error
) {
  const duration = Date.now() - startTime;

  const data = {
    operation,
    table,
    duration: `${duration}ms`,
    rowCount,
    error: error?.message,
  };

  if (success) {
    logger.info(data, `Database ${operation} completed`);
  } else {
    logger.error(data, `Database ${operation} failed`);
  }
}

/**
 * Log Claude AI call
 */
export function logClaudeCall(
  logger: Logger,
  operation: string,
  model: string,
  startTime: number,
  success: boolean,
  inputTokens?: number,
  outputTokens?: number,
  error?: Error
) {
  const duration = Date.now() - startTime;

  const data = {
    service: 'claude',
    operation,
    model,
    duration: `${duration}ms`,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens && outputTokens ? inputTokens + outputTokens : undefined,
    error: error?.message,
  };

  if (success) {
    logger.info(data, 'Claude API call completed');
  } else {
    logger.error(data, 'Claude API call failed');
  }
}

/**
 * Performance timer utility
 */
export function createTimer(label: string): { end: () => number } {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      logger.debug({ label, duration: `${duration}ms` }, `Timer: ${label}`);
      return duration;
    },
  };
}

/**
 * Log levels for reference
 */
export const LogLevel = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];
