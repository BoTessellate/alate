/**
 * Sentry - Server-side error monitoring
 *
 * Captures:
 *  - Enrichment failures (AI provider timeouts, parse errors, validation failures)
 *  - Scraping failures
 *  - Fit-check failures
 *  - Unhandled exceptions via Express error middleware
 *
 * DSN is loaded from SENTRY_DSN env var (set in Vercel environment variables).
 * If absent, the module is a safe no-op.
 */

import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN;

let initialised = false;

export function initSentry() {
  if (!DSN) {
    console.warn('[Sentry] SENTRY_DSN not set — server error reporting disabled');
    return;
  }
  if (initialised) return;

  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'production',
    // Redact sensitive headers automatically
    sendDefaultPii: false,
  });

  initialised = true;
}

/**
 * Capture a server-side error with feature context.
 * Safe to call even if Sentry is not initialised.
 */
export function captureServerError(
  error: unknown,
  context: { feature: string; [key: string]: unknown }
) {
  if (!DSN || !initialised) return;

  Sentry.withScope((scope) => {
    scope.setTag('feature', context.feature);
    Object.entries(context).forEach(([k, v]) => {
      if (k !== 'feature') scope.setExtra(k, String(v));
    });
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

export { Sentry };
