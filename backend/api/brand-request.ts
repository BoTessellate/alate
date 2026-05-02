/**
 * Brand request API
 *
 * Demand signal capture for unsupported brands. The mobile app calls
 * this when FitResult's scrape fails with kind='unsupported'. We log
 * the brand into Supabase; the count powers in-app social proof
 * (gated at >= 20) and a marketing/BD prioritisation dashboard.
 *
 * NO EMAIL goes out to the brand from this endpoint. Email-the-brand
 * was rejected 2026-05-02 — see BACKLOG.md for the rationale.
 *
 * POST /api/brand-request
 *   Body: { sourceUrl, brandDisplay?, requesterEmail?, userId? }
 *   Returns: { success: true, brandHandle, count }
 *
 * GET /api/brand-request?brandHandle=cosstores.com
 *   Returns: { brandHandle, count }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../sdk/shared/logger';
import { normaliseOrigin } from '../sdk/productScraping/blocklist';
import { RATE_LIMITERS } from './middleware/rateLimit';

const log = createModuleLogger('brand-request');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

/** Extract a normalised brand_handle from a raw URL string. */
function handleFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return normaliseOrigin(url.hostname);
  } catch {
    return null;
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseKey) {
    log.error('Supabase not configured; cannot record brand request');
    return res.status(500).json({ error: 'Brand request registry unavailable' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    const handle = String(req.query.brandHandle ?? '').trim().toLowerCase();
    if (!handle) {
      return res.status(400).json({ error: 'brandHandle is required' });
    }
    const { count, error } = await supabase
      .from('brand_requests')
      .select('id', { count: 'exact', head: true })
      .eq('brand_handle', handle);
    if (error) {
      log.warn({ error, handle }, 'count query failed');
      return res.status(200).json({ brandHandle: handle, count: 0 });
    }
    return res.status(200).json({ brandHandle: handle, count: count ?? 0 });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sourceUrl, brandDisplay, requesterEmail, userId } = (req.body || {}) as {
    sourceUrl?: string;
    brandDisplay?: string;
    requesterEmail?: string;
    userId?: string;
  };

  if (!sourceUrl) {
    return res.status(400).json({ error: 'sourceUrl is required' });
  }

  const brandHandle = handleFromUrl(sourceUrl);
  if (!brandHandle || brandHandle.length < 3) {
    return res.status(400).json({ error: 'Could not extract a brand handle from sourceUrl' });
  }

  try {
    const { error: insertError } = await supabase.from('brand_requests').insert({
      brand_handle: brandHandle,
      brand_display: brandDisplay ?? null,
      source_url: sourceUrl,
      requester_email: requesterEmail ?? null,
      user_id: userId ?? null,
    });

    if (insertError) {
      log.error({ error: insertError, brandHandle }, 'brand_requests insert failed');
      return res.status(500).json({ error: 'Failed to record brand request' });
    }

    const { count, error: countError } = await supabase
      .from('brand_requests')
      .select('id', { count: 'exact', head: true })
      .eq('brand_handle', brandHandle);
    if (countError) {
      log.warn({ error: countError, brandHandle }, 'count query failed after insert');
    }

    log.info(
      {
        brandHandle,
        brandDisplay,
        hasEmail: !!requesterEmail,
        hasUserId: !!userId,
        count: count ?? 0,
      },
      'brand request recorded'
    );

    return res.status(200).json({ success: true, brandHandle, count: count ?? 0 });
  } catch (err) {
    log.error({ error: err, brandHandle }, 'brand-request handler threw');
    return res.status(500).json({ error: 'Internal error' });
  }
}

export default RATE_LIMITERS.STANDARD()(handler);
