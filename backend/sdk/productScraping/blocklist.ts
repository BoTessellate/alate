/**
 * Blocklist check — consulted by the scraper before every fetch.
 *
 * When a brand explicitly requests removal (via /api/brand-optout or
 * an email to support), we record their origin in the `blocked_brands`
 * table. The scraper then returns a `blocked: true` response instead
 * of hitting their storefront.
 *
 * Cached in memory at cold start with a 5-minute TTL so we don't hit
 * Supabase on every scrape.
 */

import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../shared/logger';

const log = createModuleLogger('blocklist');

const TTL_MS = 5 * 60 * 1000; // 5-minute cache window

let cachedSet: Set<string> | null = null;
let cacheExpiresAt = 0;

/** Normalise hostname → lowercase, no www. prefix, no scheme/path. */
export function normaliseOrigin(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '').trim();
}

/**
 * Reset the in-memory cache. Use in tests to avoid cross-test leakage.
 */
export function resetBlocklistCache(): void {
  cachedSet = null;
  cacheExpiresAt = 0;
}

/**
 * Load the blocklist from Supabase and populate the in-memory cache.
 * Returns an empty Set on failure so the scraper never blocks on an
 * infrastructure outage — better to over-permit briefly than to hard-
 * fail legitimate scrapes.
 */
async function loadBlocklist(): Promise<Set<string>> {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase not configured — blocklist check skipped');
    return new Set();
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('blocked_brands')
      .select('origin');

    if (error) {
      log.error({ error }, 'Blocklist load failed — defaulting to empty set');
      return new Set();
    }

    const origins = (data || []).map((row: { origin: string }) =>
      normaliseOrigin(row.origin)
    );
    return new Set(origins);
  } catch (err) {
    log.error({ error: err }, 'Blocklist load threw — defaulting to empty set');
    return new Set();
  }
}

/**
 * Check whether a given hostname is on the brand blocklist. Used by
 * the scraper as the very first check, before any network I/O to the
 * origin. Also used by the optout endpoint to surface "already blocked"
 * states.
 */
export async function isOriginBlocked(hostname: string): Promise<boolean> {
  const origin = normaliseOrigin(hostname);
  if (!origin) return false;

  const now = Date.now();
  if (!cachedSet || now >= cacheExpiresAt) {
    cachedSet = await loadBlocklist();
    cacheExpiresAt = now + TTL_MS;
  }

  return cachedSet.has(origin);
}
