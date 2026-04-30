/**
 * Centralised read of the Google OAuth env vars.
 *
 * Why a helper instead of inline `process.env.X`: babel-preset-expo
 * inlines `EXPO_PUBLIC_*` reads at COMPILE time, which makes them
 * un-mockable in jest. Wrapping the read here gives us a single
 * jest.mock surface AND a single place to log when a sign-in
 * configuration mismatch fires (helps diagnose "Not configured"
 * surfacing in production builds where `.env` was forgotten and only
 * EAS env vars apply).
 */

import { captureError } from './sentry';

export interface GoogleAuthConfig {
  clientId?: string;
  androidClientId?: string;
  iosClientId?: string;
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  return {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  };
}

export function hasAnyGoogleAuthConfig(cfg: GoogleAuthConfig = getGoogleAuthConfig()): boolean {
  return !!(cfg.clientId || cfg.androidClientId || cfg.iosClientId);
}

/**
 * Single source of truth for the "is the sign-in pathway usable?" check.
 * When this returns false, the AccountScreen renders the "Not configured"
 * toast on tap. Sentry breadcrumb included so a missing env var in a
 * production build is visible in the dashboard rather than silently
 * misleading the user — they'd otherwise assume their GCC config was
 * wrong when the actual cause is a missing EAS env entry.
 */
let hasLoggedMissing = false;
export function logMissingGoogleAuthConfigOnce(): void {
  if (hasLoggedMissing) return;
  hasLoggedMissing = true;
  const cfg = getGoogleAuthConfig();
  captureError(
    new Error('Google sign-in env vars missing — falling back to Not Configured'),
    {
      feature: 'google-signin-config',
      hasClientId: String(!!cfg.clientId),
      hasAndroidClientId: String(!!cfg.androidClientId),
      hasIosClientId: String(!!cfg.iosClientId),
    }
  );
}

/** Test-only — reset the once-flag so a fresh test starts clean. */
export function __resetGoogleAuthEnvLogState(): void {
  hasLoggedMissing = false;
}
