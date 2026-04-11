/**
 * Firebase Crashlytics — native crash reporting
 *
 * Complements Sentry by catching low-level native crashes that RN's JS
 * error boundaries never see (JNI faults, OOM kills, ANRs, etc.) and
 * streaming them to Firebase. Enable the BigQuery export in the Firebase
 * console (Project Settings → Integrations → BigQuery → Crashlytics) so
 * issues can be queried from the dev workflow.
 *
 * Safe no-op if the native module isn't linked (e.g. Expo Go, web build,
 * tests). Native linking happens automatically via autolinking once
 * @react-native-firebase/app and google-services.json are in place.
 */

import crashlytics from '@react-native-firebase/crashlytics';

type CrashlyticsModule = ReturnType<typeof crashlytics>;

let instance: CrashlyticsModule | null = null;

function getCrashlytics(): CrashlyticsModule | null {
  if (instance) return instance;
  try {
    instance = crashlytics();
    return instance;
  } catch (err) {
    // Module not linked — e.g. running under jest, Expo Go, or the web bundle.
    // Returning null lets callers silently no-op without blowing up tests.
    if (__DEV__) {
      console.warn('[Crashlytics] native module unavailable:', err);
    }
    return null;
  }
}

/**
 * Initialise Crashlytics collection. Call from App.tsx as early as possible.
 * Collection is enabled by default once google-services.json is present, but
 * we set it explicitly so it's obvious in code review and easy to gate on an
 * opt-in flag later if we add analytics consent.
 */
export async function initCrashlytics(): Promise<void> {
  const c = getCrashlytics();
  if (!c) return;

  try {
    await c.setCrashlyticsCollectionEnabled(true);
    c.log('Crashlytics initialised');
  } catch (err) {
    if (__DEV__) {
      console.warn('[Crashlytics] init failed:', err);
    }
  }
}

/** Record a non-fatal JS error. Mirrors Sentry.captureException. */
export function recordError(
  error: unknown,
  context?: { feature?: string; [key: string]: unknown }
): void {
  const c = getCrashlytics();
  if (!c) return;

  try {
    if (context?.feature) {
      c.setAttribute('feature', context.feature);
    }
    if (context) {
      Object.entries(context).forEach(([k, v]) => {
        if (k === 'feature') return;
        // Crashlytics only stores string attributes — coerce safely.
        c.setAttribute(k, String(v));
      });
    }
    c.recordError(error instanceof Error ? error : new Error(String(error)));
  } catch {
    // Never let the telemetry path break the app.
  }
}

/** Identify the current user so crashes can be correlated with accounts. */
export function setCrashlyticsUser(userId: string | null): void {
  const c = getCrashlytics();
  if (!c) return;
  try {
    c.setUserId(userId ?? '');
  } catch {
    /* swallow */
  }
}

/** Leave a breadcrumb-style log line in the next crash report. */
export function logCrashlytics(message: string): void {
  const c = getCrashlytics();
  if (!c) return;
  try {
    c.log(message);
  } catch {
    /* swallow */
  }
}
