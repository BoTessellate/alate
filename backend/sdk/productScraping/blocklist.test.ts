/**
 * Blocklist tests — normalisation + cached lookup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { normaliseOrigin, resetBlocklistCache, isOriginBlocked } from './blocklist';

describe('normaliseOrigin', () => {
  it('lowercases', () => {
    expect(normaliseOrigin('Example.COM')).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(normaliseOrigin('www.example.com')).toBe('example.com');
  });

  it('keeps subdomains other than www', () => {
    expect(normaliseOrigin('shop.example.com')).toBe('shop.example.com');
  });

  it('trims whitespace', () => {
    expect(normaliseOrigin('  example.com  ')).toBe('example.com');
  });
});

describe('isOriginBlocked', () => {
  beforeEach(() => {
    resetBlocklistCache();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_KEY;
  });

  it('returns false when Supabase is not configured (defaults open)', async () => {
    // No env vars — loadBlocklist returns an empty set so nothing is
    // blocked. This is the expected behaviour in local dev without
    // Supabase credentials; the scraper falls through normally.
    const blocked = await isOriginBlocked('anything.example.com');
    expect(blocked).toBe(false);
  });

  it('returns false for an empty hostname', async () => {
    const blocked = await isOriginBlocked('');
    expect(blocked).toBe(false);
  });
});
