/**
 * WooCommerce direct-fetch layer — companion to the Shopify direct-
 * fetch layer for `/product/<handle>` URLs.
 *
 * Most WooCommerce storefronts expose the WC Store API at
 * `/wp-json/wc/store/v1/products?slug=<handle>`. It returns clean,
 * authoritative product data (prices, images, attributes, categories)
 * — the same role `/products/<handle>.json` plays for Shopify.
 *
 * Why this layer exists: tarshari.in (May 2 2026 regression) emits
 * NO JSON-LD, NO product:price OG tags, and uses a `<bdi>` price
 * structure our HTML pattern regex doesn't match. Without the WC
 * Store API path, the fit card lands with no price and the wrong
 * title (the page's first H1 is a related-product carousel item).
 *
 * Strategy: when path matches `/product/<handle>` (singular —
 * WooCommerce default; differs from Shopify's plural), fetch the WC
 * Store endpoint. Silently return null on 404, timeout, or wrong
 * shape — the existing HTML extraction layers run after.
 */

import { createModuleLogger } from '../shared/logger';
import {
  extractMaterialFromTags,
  detectCustomFit,
  type ShopifyScrapedData,
} from './shopifyFetch';

const log = createModuleLogger('woocommerce-fetch');

// Reuse the Shopify result shape — downstream consumers (scrapeProduct,
// fit pipeline) read the same fields regardless of source. Keeping a
// single shape avoids fan-out in the merge step.
export type WooCommerceScrapedData = ShopifyScrapedData;

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#8211;': '–',
  '&#8212;': '—',
  '&#8216;': '‘',
  '&#8217;': '’',
  '&#8220;': '“',
  '&#8221;': '”',
};

function stripHtmlAndDecode(s: string | undefined): string | undefined {
  if (!s) return s;
  const stripped = s
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|td)\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39|#8211|#8212|#8216|#8217|#8220|#8221);/g,
      (m) => HTML_ENTITY_MAP[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || undefined;
}

interface WooAttributeTerm { name?: string }
interface WooAttribute { name?: string; terms?: WooAttributeTerm[] }
interface WooImage { src?: string }
interface WooNamed { name?: string }

interface WooProduct {
  id?: number | string;
  name?: string;
  slug?: string;
  permalink?: string;
  on_sale?: boolean;
  prices?: {
    price?: string;
    regular_price?: string;
    sale_price?: string;
    currency_code?: string;
  };
  images?: WooImage[];
  attributes?: WooAttribute[];
  categories?: WooNamed[];
  tags?: WooNamed[];
  short_description?: string;
  description?: string;
}

function brandFromHostname(hostname: string): string | undefined {
  const stem = hostname.replace(/^www\./, '').split('.')[0];
  if (!stem) return undefined;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

/**
 * Try to fetch WooCommerce Store API JSON for a URL. Returns
 * structured data on success, or null on any failure.
 *
 * @param url - parsed URL of the product page
 * @param fetchFn - fetch implementation (defaults to global fetch;
 *   pass a stub in tests)
 */
export async function tryWooCommerceJSON(
  url: URL,
  fetchFn: typeof fetch = fetch
): Promise<WooCommerceScrapedData | null> {
  // WooCommerce default permalink is `/product/<handle>` (singular).
  // Shopify's `/products/<handle>` (plural) is handled by tryShopifyJSON
  // earlier in the pipeline — skip those so we don't double-fetch.
  const pathMatch = url.pathname.match(/\/product\/([^/?#]+)/);
  if (!pathMatch) return null;
  if (/\/products\//.test(url.pathname)) return null;

  const handle = pathMatch[1];
  const apiUrl = `${url.origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(handle)}`;

  try {
    const response = await fetchFn(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ' +
          'Alate/1.0 (+https://alate.app)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log.debug({ apiUrl, status: response.status }, 'WC Store API not found');
      return null;
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || payload.length === 0) {
      log.debug({ apiUrl }, 'WC Store API returned empty/non-array payload');
      return null;
    }

    const product = payload[0] as WooProduct;
    if (!product || typeof product !== 'object' || !product.name) {
      log.debug({ apiUrl }, 'WC payload missing product shape');
      return null;
    }

    // Price + compareAtPrice. WooCommerce serves `price` as a string in
    // major units (e.g. "4000" for ₹4000), unlike Shopify which can
    // serve cents in some embedded JS payloads. We pass through as-is.
    const price = product.prices?.price;
    const regularPrice = product.prices?.regular_price;
    const salePrice = product.prices?.sale_price;
    const compareAtPrice =
      product.on_sale && regularPrice && salePrice && regularPrice !== salePrice
        ? regularPrice
        : undefined;
    const currency = product.prices?.currency_code;

    // Image — first image from the gallery. WooCommerce serves
    // `images: [{ src }]`. The Jetpack image-CDN wrapper (`i0.wp.com`)
    // is fine; mobile renders it.
    const imageUrl = Array.isArray(product.images) && product.images.length
      ? product.images[0]?.src
      : undefined;

    // Size attribute discovery — same trap as Shopify multi-axis
    // products. WooCommerce attributes look like:
    //   [{ name: 'Color', terms: [...] },
    //    { name: 'Size',  terms: [...] },
    //    { name: 'Height', terms: [...] }]
    // We pick the axis whose name contains "size" (case-insensitive)
    // and read its terms. Falling back to "Color" or "Height" would
    // surface bogus size labels on the fit card.
    const attributes = Array.isArray(product.attributes) ? product.attributes : [];
    const sizeAttribute = attributes.find(
      (a) => typeof a.name === 'string' && /size/i.test(a.name)
    );
    const availableSizes = sizeAttribute?.terms
      ?.map((t) => t.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);

    const categories = Array.isArray(product.categories) ? product.categories : [];
    const category = categories[0]?.name;

    const tags = Array.isArray(product.tags)
      ? product.tags
          .map((t) => t.name)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
      : [];

    const description = stripHtmlAndDecode(product.short_description) ||
      stripHtmlAndDecode(product.description);

    const customFit = detectCustomFit({
      options: attributes.map((a) => ({
        name: a.name,
        values: a.terms?.map((t) => t.name).filter((n): n is string => !!n),
      })),
      tags,
      title: product.name ?? '',
      handle,
    });

    const result: WooCommerceScrapedData = {
      // Trust the API name field over the URL slug — tarshari serves
      // "Daphnie Slip Dress" content at `/product/orla-slip-dress/`
      // (slug renamed without redirect). The rendered page agrees
      // with the API; we follow.
      title: stripHtmlAndDecode(product.name),
      // WooCommerce has no first-class brand/vendor field. Fall back
      // to the hostname stem so the fit card has *something* in the
      // brand line. Most single-brand WooCommerce sites are the brand
      // itself anyway (tarshari.in → Tarshari).
      brandName: brandFromHostname(url.hostname),
      category,
      price,
      currency,
      compareAtPrice,
      imageUrl,
      description,
      tags: tags.length ? tags : undefined,
      material: extractMaterialFromTags(tags),
      availableSizes: availableSizes && availableSizes.length ? availableSizes : undefined,
      customFit,
    };

    log.info({ apiUrl, handle }, 'WC Store API fetch succeeded');
    return result;
  } catch (error) {
    log.debug({ apiUrl, error: (error as Error).message }, 'WC Store API fetch failed');
    return null;
  }
}
