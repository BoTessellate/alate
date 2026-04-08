/**
 * Sentry - Error & crash monitoring for Alate mobile
 *
 * Captures:
 *  - Unhandled JS exceptions (automatic)
 *  - Native crashes (automatic via Sentry RN)
 *  - Enrichment / fit-check API failures (manual captures in FitResultScreen)
 *  - Share intent processing failures
 *
 * DSN is loaded from EXPO_PUBLIC_SENTRY_DSN (set in .env / EAS secrets).
 * If the DSN is absent the module is a safe no-op so development still works.
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!DSN) {
    console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — error reporting disabled');
    return;
  }

  Sentry.init({
    dsn: DSN,
    // Send 100 % of errors; tune down in high-traffic production if needed
    tracesSampleRate: 1.0,
    // Tag every event with the app environment
    environment: process.env.NODE_ENV || 'production',
    // Breadcrumbs make it easy to trace the user journey before a crash
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
  });
}

/** Capture a named error with optional structured context */
export function captureError(
  error: unknown,
  context: { feature: string; [key: string]: unknown }
) {
  if (!DSN) return;

  Sentry.withScope((scope) => {
    scope.setTag('feature', context.feature);
    Object.entries(context).forEach(([k, v]) => {
      if (k !== 'feature') scope.setExtra(k, v);
    });
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

/** Wrap the root component with the Sentry error boundary */
export const SentryWrap = Sentry.wrap;
