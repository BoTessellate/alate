/**
 * Brand opt-out API
 *
 * Allows a brand to request removal from Alate's scraping. Records the
 * origin in the `blocked_brands` Supabase table. On subsequent scrapes
 * the scraper consults this list and returns `blocked: true` instead
 * of hitting the storefront.
 *
 * Kept intentionally simple: no auth, but rate-limited and the
 * `requested_by_email` field gives us a trail for manual verification.
 * If abuse becomes a problem, pair with a captcha on the marketing-
 * site form that posts here.
 *
 * POST /api/brand-optout
 * Body: { origin: string, contactEmail?: string, reason?: string, notes?: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../sdk/shared/logger';
import { normaliseOrigin, resetBlocklistCache } from '../sdk/productScraping/blocklist';
import { RATE_LIMITERS } from './middleware/rateLimit';

const log = createModuleLogger('brand-optout');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

/** Extract hostname from a raw origin string that may include scheme/path. */
function parseOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // If it parses as a full URL, take the hostname.
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return normaliseOrigin(url.hostname);
  } catch {
    // Fall through for bare hostnames that fail URL parsing.
    return normaliseOrigin(trimmed);
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { origin: rawOrigin, contactEmail, reason, notes } = (req.body || {}) as {
    origin?: string;
    contactEmail?: string;
    reason?: string;
    notes?: string;
  };

  if (!rawOrigin) {
    return res.status(400).json({ error: 'origin is required' });
  }

  const origin = parseOrigin(rawOrigin);
  if (!origin || origin.length < 3) {
    return res.status(400).json({ error: 'Invalid origin' });
  }

  if (!supabaseUrl || !supabaseKey) {
    log.error('Supabase not configured; cannot record opt-out');
    return res.status(500).json({ error: 'Opt-out registry unavailable' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from('blocked_brands')
      .upsert(
        {
          origin,
          reason: reason ?? null,
          requested_by_email: contactEmail ?? null,
          notes: notes ?? null,
        },
        { onConflict: 'origin' }
      );

    if (error) {
      log.error({ error, origin }, 'Opt-out upsert failed');
      return res.status(500).json({ error: 'Failed to record opt-out' });
    }

    // Invalidate the scraper's in-memory cache so the block takes
    // effect on the next scrape, not after the next 5-minute TTL.
    resetBlocklistCache();

    log.info({ origin, contactEmail: contactEmail ? '[provided]' : null }, 'Brand opt-out recorded');
    return res.status(200).json({
      success: true,
      origin,
      message: `${origin} has been added to the opt-out list. Scraping from this origin will stop within a minute.`,
    });
  } catch (err) {
    log.error({ error: err, origin }, 'Opt-out handler threw');
    return res.status(500).json({ error: 'Internal error' });
  }
}

export default RATE_LIMITERS.STRICT()(handler);
