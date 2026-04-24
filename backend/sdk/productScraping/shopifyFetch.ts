/**
 * Shopify direct-fetch layer — priority 0 of the product scraper.
 *
 * Every Shopify storefront serves a public `/products/<handle>.json`
 * endpoint that their own theme consumes to render product pages. It
 * returns authoritative structured data (vendor, product_type, tags,
 * variants, prices, sizes, images) with no authentication. This is
 * vastly more reliable than inferring category/material/tags via
 * Claude from thin OG descriptions.
 *
 * Strategy: if the URL path matches `/products/<handle>`, try the
 * JSON endpoint first. On 404, network error, or non-Shopify JSON
 * shape, return null and let the HTML extraction layers take over.
 * We never throw — this is best-effort enrichment.
 */

import { createModuleLogger } from '../shared/logger';

const log = createModuleLogger('shopify-fetch');

export interface ShopifyScrapedData {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  compareAtPrice?: string;
  imageUrl?: string;
  description?: string;
  availableSizes?: string[];
  category?: string;
  tags?: string[];
  material?: string;
}

/**
 * Common garment materials — used to pluck a `material` string out of
 * the free-form tag list that most Shopify stores populate. Case-
 * insensitive matching, earliest tag wins (merchants usually list the
 * primary fabric first).
 */
const MATERIAL_PATTERNS = [
  /\b(linen)\b/i,
  /\b(cotton(?:\s+blend)?)\b/i,
  /\b(silk)\b/i,
  /\b(wool)\b/i,
  /\b(cashmere)\b/i,
  /\b(polyester)\b/i,
  /\b(viscose)\b/i,
  /\b(rayon)\b/i,
  /\b(denim)\b/i,
  /\b(leather)\b/i,
  /\b(suede)\b/i,
  /\b(nylon)\b/i,
  /\b(modal)\b/i,
  /\b(tencel)\b/i,
  /\b(lyocell)\b/i,
  /\b(velvet)\b/i,
  /\b(satin)\b/i,
  /\b(chiffon)\b/i,
  /\b(jersey)\b/i,
  /\b(crepe)\b/i,
];

export function extractMaterialFromTags(tags: string[]): string | undefined {
  for (const tag of tags) {
    for (const pattern of MATERIAL_PATTERNS) {
      const match = tag.match(pattern);
      if (match) return tag.trim();
    }
  }
  return undefined;
}

/**
 * Try to fetch Shopify's product JSON for a URL. Returns structured
 * data on success, or null on any failure (URL not a Shopify product
 * path, 404, network error, unexpected payload shape).
 *
 * @param url - parsed URL of the product page
 * @param fetchFn - fetch implementation (defaults to global fetch;
 *   pass a stub in tests)
 */
export async function tryShopifyJSON(
  url: URL,
  fetchFn: typeof fetch = fetch
): Promise<ShopifyScrapedData | null> {
  // Shopify product URLs always live at /products/<handle>. The handle
  // may be followed by trailing slashes, query params, or fragments —
  // all of which we strip when building the JSON URL.
  const pathMatch = url.pathname.match(/\/products\/([^/?#]+)/);
  if (!pathMatch) return null;

  const handle = pathMatch[1];
  const jsonUrl = `${url.origin}/products/${handle}.json`;

  try {
    const response = await fetchFn(jsonUrl, {
      method: 'GET',
      headers: {
        // Same UA the main scraper uses — identifies Alate so merchants
        // can opt-block if they wish. Honest-scraping pattern.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ' +
          'Alate/1.0 (+https://alate.app)',
        Accept: 'application/json',
      },
      // 5s cap — this is a best-effort fast path; if the storefront is
      // slow we fall through to the existing HTML extraction flow.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log.debug({ jsonUrl, status: response.status }, 'Shopify JSON endpoint not found');
      return null;
    }

    const payload = (await response.json()) as { product?: unknown };
    if (!payload || typeof payload !== 'object' || !payload.product) {
      log.debug({ jsonUrl }, 'Payload missing product shape — not a Shopify storefront');
      return null;
    }

    const product = payload.product as {
      title?: string;
      body_html?: string;
      vendor?: string;
      product_type?: string;
      tags?: string;
      variants?: Array<{
        title?: string;
        price?: string;
        compare_at_price?: string | null;
        price_currency?: string;
        option1?: string | null;
        inventory_management?: string | null;
      }>;
      images?: Array<{ src?: string }>;
    };

    // Pick the canonical variant for price display — first available
    // variant with Shopify-managed inventory. Falls back to variants[0]
    // if none have inventory tracking (some stores don't use it).
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const trackedVariants = variants.filter(
      (v) => v.inventory_management === 'shopify'
    );
    const primaryVariant = trackedVariants[0] ?? variants[0];

    const tags = typeof product.tags === 'string'
      ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const availableSizes = trackedVariants
      .map((v) => v.option1)
      .filter((s): s is string => Boolean(s));

    // Strip HTML from body_html and trim. Shopify stores often include
    // inline mce editor attributes — strip the full tag, not just <>.
    const rawDescription = product.body_html ?? '';
    const description = rawDescription
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    const imageUrl = product.images?.[0]?.src;

    const result: ShopifyScrapedData = {
      title: product.title,
      brandName: product.vendor,
      category: product.product_type,
      price: primaryVariant?.price,
      currency: primaryVariant?.price_currency,
      compareAtPrice: primaryVariant?.compare_at_price ?? undefined,
      imageUrl,
      description: description || undefined,
      tags: tags.length ? tags : undefined,
      material: extractMaterialFromTags(tags),
      availableSizes: availableSizes.length ? availableSizes : undefined,
    };

    log.info({ jsonUrl, handle }, 'Shopify JSON fetch succeeded');
    return result;
  } catch (error) {
    log.debug({ jsonUrl, error: (error as Error).message }, 'Shopify JSON fetch failed');
    return null;
  }
}
