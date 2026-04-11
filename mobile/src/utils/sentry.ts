/**
 * Sentry - Error & crash monitoring for Alate mobile
 *
 * Captures:
 *  - Unhandled JS exceptions (automatic)
 *  - Native crashes (automatic via Sentry RN)
 *  - Unhandled promise rejections (manual wiring below)
 *  - Enrichment / fit-check API failures (manual captures in FitResultScreen)
 *  - Share intent processing failures
 *
 * DSN is loaded from EXPO_PUBLIC_SENTRY_DSN (set in .env / EAS secrets).
 * If the DSN is absent the module is a safe no-op so development still works.
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Lower the trace sample rate in production to stay within Sentry quota —
// 100 % is fine in dev, but prod traffic can chew through the free tier fast.
const isProd = process.env.NODE_ENV === 'production';
const TRACE_SAMPLE_RATE = isProd ? 0.2 : 1.0;

export function initSentry() {
  if (!DSN) {
    console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — error reporting disabled');
    return;
  }

  Sentry.init({
    dsn: DSN,
    tracesSampleRate: TRACE_SAMPLE_RATE,
    environment: process.env.NODE_ENV || 'production',
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
  });

  // Catch unhandled promise rejections that React's error boundary misses.
  // (e.g. a rogue `fetch().then(...)` chain with no `.catch`.)
  const globalObj = global as unknown as {
    HermesInternal?: unknown;
    process?: { on?: (event: string, handler: (reason: unknown) => void) => void };
  };
  if (globalObj.process?.on) {
    globalObj.process.on('unhandledRejection', (reason: unknown) => {
      captureError(reason, { feature: 'unhandled-rejection' });
    });
  }
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
