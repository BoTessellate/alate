/**
 * googleAuthEnv — client-ID sanitisation.
 *
 * Regression coverage for the 2026-05-06 Google sign-in 401: a trailing
 * carriage return (`\r`) on `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
 * (copy-pasted into a CI secret) made the app send
 * `…googleusercontent.com%0D` to Google's OAuth endpoint, which then
 * reported "OAuth client was not found / invalid_client". The fix:
 * `sanitizeClientId` trims the value at the point of read so a stray
 * CR/LF/space can never reach Google, regardless of secret hygiene.
 */

import { sanitizeClientId } from '../utils/googleAuthEnv';

describe('sanitizeClientId', () => {
  const CLEAN = '275682496009-od0lkccf0vbd429lcc992hh8g1lmbf8n.apps.googleusercontent.com';

  it('returns a clean client ID unchanged', () => {
    expect(sanitizeClientId(CLEAN)).toBe(CLEAN);
  });

  it('strips a trailing carriage return (the 401 bug)', () => {
    expect(sanitizeClientId(`${CLEAN}\r`)).toBe(CLEAN);
  });

  it('strips a trailing CRLF', () => {
    expect(sanitizeClientId(`${CLEAN}\r\n`)).toBe(CLEAN);
  });

  it('strips a trailing newline', () => {
    expect(sanitizeClientId(`${CLEAN}\n`)).toBe(CLEAN);
  });

  it('strips surrounding spaces and tabs', () => {
    expect(sanitizeClientId(`  \t${CLEAN} \t`)).toBe(CLEAN);
  });

  it('returns undefined for an undefined input', () => {
    expect(sanitizeClientId(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(sanitizeClientId('')).toBeUndefined();
  });

  it('returns undefined for a whitespace-only string', () => {
    expect(sanitizeClientId('\r\n  \t')).toBeUndefined();
  });
});
