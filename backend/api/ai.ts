/**
 * AI API - Alate backend
 * Actions: scrape, enrich, parse-details, check-fit
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { extractAndNameColors } from '../sdk/productEnrichment/colorExtractor';
import { enrichProduct, saveEnrichedProduct, parseProductDetails, type EnricherRawProduct, type EnricherEnrichedProduct } from '../sdk/productEnrichment';
import { scrapeProduct } from '../sdk/productScraping';
import { predictFit, recommendSize, type AvatarMeasurements, type ProductData, type CalibrationData } from '../sdk/fitGuidance';
import { callClaude, parseJSONFromResponse } from '../sdk/shared/secureAI';
import { RATE_LIMITERS } from './middleware/rateLimit';
import { createClient } from '@supabase/supabase-js';
import { initSentry, captureServerError } from '../sdk/shared/sentryInit';

// Initialise Sentry for each serverless function invocation (idempotent)
initSentry();

const log = createModuleLogger('ai');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

/** Single product enrichment handler */
async function handleEnrich(req: VercelRequest, res: VercelResponse) {
  const { product } = req.body as { product: EnricherRawProduct };

  if (!product || !product.name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  try {
    const enrichedProduct = await enrichProduct(product as EnricherRawProduct, {
      demoMode: DEMO_MODE
    });

    const savedProduct = await saveEnrichedProduct(enrichedProduct as EnricherEnrichedProduct);

    let extractedColors = null;
    let colorMethod = 'ai-fallback';
    if (product.image_url) {
      try {
        extractedColors = await extractAndNameColors(
          product.image_url,
          supabaseUrl,
          supabaseKey,
          5
        );
        colorMethod = 'pixel-accurate';
      } catch (error) {
        log.warn({ error }, 'Color extraction failed for response metadata');
      }
    }

    return res.status(200).json({
      success: true,
      product: { ...enrichedProduct, id: savedProduct?.id },
      model_used: DEMO_MODE ? 'demo-mode' : 'gemini-chain',
      color_extraction: colorMethod,
      color_hex_codes: extractedColors?.hexCodes || [],
      saved_to_db: !!savedProduct,
      _demo: DEMO_MODE,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ENRICHMENT_TIMEOUT') {
      log.error({ productName: product.name }, 'AI enrichment timed out');
      captureServerError(error, { feature: 'product-enrichment', productName: product.name, reason: 'timeout' });
      return res.status(504).json({
        error: 'Request timeout',
        message: 'AI enrichment took too long - try again later',
        code: 'ENRICHMENT_TIMEOUT'
      });
    }

    log.error({ error, productName: product.name }, 'Enrichment failed');
    captureServerError(error, { feature: 'product-enrichment', productName: product.name });
    return res.status(500).json({
      error: 'Enrichment failed',
      message: 'An internal error occurred. Please try again.'
    });
  }
}

/** Handle parse product details */
async function handleParseProductDetails(req: VercelRequest, res: VercelResponse) {
  const { description, context = 'fashion' } = req.body as {
    description: string;
    context?: 'fashion' | 'home';
  };

  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'description is required' });
  }

  if (description.length > 500) {
    return res.status(400).json({ error: 'description too long (max 500 characters)' });
  }

  const result = await parseProductDetails({ description, context });
  return res.status(result.success ? 200 : 500).json(result);
}

/** Scrape product data from URL */
async function handleScrape(req: VercelRequest, res: VercelResponse) {
  const { url } = req.body as { url: string };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    log.info({ url }, 'Scraping product from URL...');

    const result = await scrapeProduct(url);

    log.info({
      url: result.debug.requestedUrl,
      finalUrl: result.debug.finalUrl,
      hasPrice: result.debug.hasPriceAmount,
      usedPuppeteer: result.debug.usedPuppeteer
    }, 'Product scraping complete');

    return res.status(200).json({
      success: true,
      data: result.data,
      debug: result.debug,
    });

  } catch (error) {
    log.error({ error, url }, 'Product scraping failed');
    captureServerError(error, { feature: 'product-scraping', url });
    return res.status(500).json({
      error: 'Scraping failed',
      message: 'An internal error occurred. Please try again.',
    });
  }
}

/** Check fit for a product against user's avatar */
async function handleFitCheck(req: VercelRequest, res: VercelResponse) {
  const { product, avatar, calibration } = req.body as {
    product: ProductData;
    avatar: AvatarMeasurements;
    calibration?: CalibrationData;
    garment_count?: number;
  };
  const garmentCount = (req.body as any)?.garment_count;

  if (!product || !product.id || !product.category) {
    return res.status(400).json({ error: 'product with id and category is required' });
  }

  if (!avatar || !avatar.height_cm || !avatar.shoulders || !avatar.bust || !avatar.waist || !avatar.hips || !avatar.thighs || !avatar.torso_length) {
    return res.status(400).json({ error: 'avatar with height_cm and all body measurements (shoulders, bust, waist, hips, thighs, torso_length) is required' });
  }

  try {
    const warnings = predictFit(product, avatar);
    const sizeRecommendation = recommendSize(avatar, calibration, garmentCount);

    return res.status(200).json({
      success: true,
      product_id: product.id,
      product_name: product.product_name,
      warnings,
      warning_count: warnings.length,
      fit_score: warnings.length === 0 ? 'great' : warnings.some(w => w.severity === 'major') ? 'poor' : 'moderate',
      size_recommendation: sizeRecommendation,
    });
  } catch (error) {
    log.error({ error, productId: product.id }, 'Fit check failed');
    captureServerError(error, { feature: 'fit-check', productId: product.id, productName: product.product_name });
    return res.status(500).json({
      error: 'Fit check failed',
      message: 'An internal error occurred. Please try again.',
    });
  }
}

/** Calibrate user measurements from a garment they own */
async function handleCalibrateGarment(req: VercelRequest, res: VercelResponse) {
  const { brand, size, fit, avatar } = req.body as {
    brand: string;
    size: string;
    fit: 'perfect' | 'slightly-tight' | 'slightly-loose';
    avatar: AvatarMeasurements;
  };

  if (!brand || !size || !fit || !avatar) {
    return res.status(400).json({ error: 'brand, size, fit, and avatar are required' });
  }

  const fitHint = fit === 'slightly-tight'
    ? 'The user says this size feels slightly tight, so their actual measurements are likely LARGER than the standard size chart values.'
    : fit === 'slightly-loose'
    ? 'The user says this size feels slightly loose, so their actual measurements are likely SMALLER than the standard size chart values.'
    : 'The user says this size fits perfectly, so their measurements likely match the standard size chart values.';

  const prompt = `You are a fashion sizing expert. A user owns a "${brand}" garment in size "${size}".
${fitHint}

The user's body profile for context:
- Height: ${avatar.height_cm}cm
- Shoulders: ${avatar.shoulders}
- Bust: ${avatar.bust}
- Waist: ${avatar.waist}
- Hips: ${avatar.hips}

Based on the brand's typical sizing and the fit feedback, estimate their actual body measurements in centimeters.

Respond with ONLY a JSON object, no other text:
{"bust_cm": <number 70-130>, "waist_cm": <number 55-120>, "hips_cm": <number 75-135>, "shoulders_cm": <number 30-55>}`;

  try {
    const result = await callClaude(prompt, { maxTokens: 200 });

    if (!result.success || !result.text) {
      log.error({ error: result.error, brand, size }, 'AI call failed for calibration');
      return res.status(500).json({ error: 'Calibration failed', message: 'AI service unavailable. Please try again.' });
    }

    const parsed = parseJSONFromResponse(result.text);
    if (!parsed || typeof parsed.bust_cm !== 'number' || typeof parsed.waist_cm !== 'number'
      || typeof parsed.hips_cm !== 'number' || typeof parsed.shoulders_cm !== 'number') {
      log.error({ raw: result.text, brand, size }, 'Invalid AI response for calibration');
      return res.status(500).json({ error: 'Calibration failed', message: 'Could not parse measurements. Please try again.' });
    }

    // Validate ranges
    const inRange = (v: number, min: number, max: number) => v >= min && v <= max;
    if (!inRange(parsed.bust_cm, 70, 130) || !inRange(parsed.waist_cm, 55, 120)
      || !inRange(parsed.hips_cm, 75, 135) || !inRange(parsed.shoulders_cm, 30, 55)) {
      log.error({ data: parsed, brand, size }, 'AI returned out-of-range calibration measurements');
      return res.status(500).json({ error: 'Calibration failed', message: 'Measurements out of expected range. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      estimated_cm: {
        bust_cm: Math.round(parsed.bust_cm),
        waist_cm: Math.round(parsed.waist_cm),
        hips_cm: Math.round(parsed.hips_cm),
        shoulders_cm: Math.round(parsed.shoulders_cm),
      },
    });
  } catch (error) {
    log.error({ error, brand, size }, 'Garment calibration failed');
    return res.status(500).json({
      error: 'Calibration failed',
      message: 'An internal error occurred. Please try again.',
    });
  }
}

/** List connected brands with product counts */
async function handleBrandList(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabase();

    // Get all shops with synced products, grouped by shop_domain
    const { data, error } = await supabase
      .from('enriched_products')
      .select('shop_domain')
      .eq('platform', 'shopify')
      .not('shop_domain', 'is', null)
      .limit(10000);

    if (error) throw error;

    // Count products per shop
    const shopCounts = new Map<string, number>();
    for (const row of data || []) {
      const domain = row.shop_domain;
      shopCounts.set(domain, (shopCounts.get(domain) || 0) + 1);
    }

    // Get shop names from sessions
    const shopDomains = Array.from(shopCounts.keys());
    const { data: sessions } = await supabase
      .from('shopify_sessions')
      .select('shop_domain, shop_name')
      .in('shop_domain', shopDomains);

    const sessionMap = new Map<string, string>();
    for (const s of sessions || []) {
      if (s.shop_name) sessionMap.set(s.shop_domain, s.shop_name);
    }

    const brands = shopDomains.map((domain) => ({
      shop_domain: domain,
      shop_name: sessionMap.get(domain) || domain.replace('.myshopify.com', ''),
      product_count: shopCounts.get(domain) || 0,
    })).sort((a, b) => b.product_count - a.product_count);

    return res.status(200).json({ success: true, brands });
  } catch (error) {
    log.error({ error }, 'Brand list failed');
    return res.status(500).json({
      error: 'Failed to fetch brands',
      message: 'An internal error occurred. Please try again.',
    });
  }
}

/** Browse products from a connected brand */
async function handleBrandProducts(req: VercelRequest, res: VercelResponse) {
  const { shop_domain, query, category, limit = 50, offset = 0 } = req.body as {
    shop_domain: string;
    query?: string;
    category?: string;
    limit?: number;
    offset?: number;
  };

  if (!shop_domain || typeof shop_domain !== 'string') {
    return res.status(400).json({ error: 'shop_domain is required' });
  }

  // Sanitize search inputs: strip LIKE wildcards and limit length
  const sanitize = (s: string) => s.replace(/[%_\\]/g, '').slice(0, 100);

  try {
    const supabase = getSupabase();
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    let dbQuery = supabase
      .from('enriched_products')
      .select('id, product_name, brand, category, price, image_url, product_url, external_id, tags, material, fit_tags, variants, product_dimensions', { count: 'exact' })
      .eq('shop_domain', shop_domain)
      .eq('platform', 'shopify')
      .order('product_name', { ascending: true })
      .range(offset, offset + safeLimit - 1);

    if (category) {
      dbQuery = dbQuery.ilike('category', `%${sanitize(category)}%`);
    }
    if (query) {
      dbQuery = dbQuery.ilike('product_name', `%${sanitize(query)}%`);
    }

    const { data, error, count } = await dbQuery;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      shop_domain,
      products: data || [],
      count: count ?? data?.length ?? 0,
    });
  } catch (error) {
    log.error({ error, shop_domain }, 'Brand products fetch failed');
    return res.status(500).json({
      error: 'Failed to fetch brand products',
      message: 'An internal error occurred. Please try again.',
    });
  }
}

const rateLimitedHandler = RATE_LIMITERS.STRICT()(async (req: VercelRequest, res: VercelResponse) => {
  const handled = await applyMiddleware(req, res);
  if (handled) return;

  const action = req.query.action as string;

  // brand-list supports GET
  if (action === 'brand-list' && (req.method === 'GET' || req.method === 'POST')) {
    return handleBrandList(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (action) {
      case 'scrape':
        return handleScrape(req, res);

      case 'enrich':
        return handleEnrich(req, res);

      case 'parse-details':
        return handleParseProductDetails(req, res);

      case 'check-fit':
        return handleFitCheck(req, res);

      case 'brand-products':
        return handleBrandProducts(req, res);

      case 'calibrate-garment':
        return handleCalibrateGarment(req, res);

      default:
        return res.status(400).json({
          error: 'Invalid action',
          hint: 'Use ?action=scrape|enrich|parse-details|check-fit|calibrate-garment|brand-list|brand-products',
          examples: {
            scrape: 'POST /api/ai?action=scrape { url: "https://..." }',
            enrich: 'POST /api/ai?action=enrich { product: {...} }',
            'parse-details': 'POST /api/ai?action=parse-details { description: "..." }',
            'check-fit': 'POST /api/ai?action=check-fit { product: {...}, avatar: {...} }',
            'brand-list': 'GET /api/ai?action=brand-list',
            'brand-products': 'POST /api/ai?action=brand-products { shop_domain: "store.myshopify.com" }',
          },
        });
    }
  } catch (error) {
    log.error({ error, action }, 'AI operation failed');
    return res.status(500).json({
      error: 'Operation failed',
      message: 'An internal error occurred. Please try again.',
    });
  }
});

export default rateLimitedHandler;
