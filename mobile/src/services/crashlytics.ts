/**
 * Firebase Crashlytics Service — Stub
 *
 * This module provides the public API for Crashlytics integration.
 * Currently a no-op because the Firebase native setup is incomplete.
 *
 * Once Firebase is fully configured (google-services.json + gradle plugins
 * + npm packages), replace this stub with the real implementation that
 * imports @react-native-firebase/crashlytics.
 *
 * All call sites (App.tsx, ScreenErrorBoundary) import from here, so
 * flipping the switch is a single-file change.
 */

/** Enable collection. No-op until Firebase is fully configured. */
export function initCrashlytics(): void {
  // Will call crashlytics().setCrashlyticsCollectionEnabled(true)
}

/** Record a caught error. No-op until Firebase is fully configured. */
export function recordError(
  _error: unknown,
  _context?: { feature?: string; [key: string]: unknown }
): void {
  // Will call crashlytics().recordError(err) with context attributes
}

/** Set the current user. No-op until Firebase is fully configured. */
export function setCrashlyticsUser(_userId: string): void {
  // Will call crashlytics().setUserId(userId)
}

/** Append a log line. No-op until Firebase is fully configured. */
export function logCrashlytics(_message: string): void {
  // Will call crashlytics().log(message)
}
