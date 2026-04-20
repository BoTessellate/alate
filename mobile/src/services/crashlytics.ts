/**
 * Firebase Crashlytics — native crash reporting
 *
 * Complements Sentry by catching low-level native crashes that RN's JS
 * error boundaries never see (JNI faults, OOM kills, ANRs, etc.).
 *
 * Safe no-op if the native module isn't linked (e.g. jest, Expo Go).
 * Native linking happens automatically via autolinking once
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
  } catch {
    return null;
  }
}

/** Enable collection. Call from App.tsx as early as possible. */
export function initCrashlytics(): void {
  const c = getCrashlytics();
  if (!c) return;
  try {
    c.setCrashlyticsCollectionEnabled(true);
    c.log('Crashlytics initialised');
  } catch {
    // swallow
  }
}

/** Record a caught error. Mirrors Sentry.captureException. */
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
        c.setAttribute(k, String(v));
      });
    }
    c.recordError(error instanceof Error ? error : new Error(String(error)));
  } catch {
    // swallow
  }
}

/** Set the current user for crash attribution. */
export function setCrashlyticsUser(userId: string): void {
  try {
    getCrashlytics()?.setUserId(userId);
  } catch {
    // swallow
  }
}

/** Append a breadcrumb-style log line. */
export function logCrashlytics(message: string): void {
  try {
    getCrashlytics()?.log(message);
  } catch {
    // swallow
  }
}
