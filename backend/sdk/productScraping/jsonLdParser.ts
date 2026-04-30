/**
 * JSON-LD Product schema parser — Tier 1 broadened coverage.
 *
 * The original `extractFromJSONLD` only handled `@type === "Product"`
 * at the root of a single script tag. Modern PIMs (Shopify Hydrogen,
 * Shopware, BigCommerce, most headless storefronts) emit JSON-LD in
 * shapes the original parser missed:
 *
 *   1. `@graph` arrays — `{ "@graph": [{ "@type": "Product", ... }] }`
 *   2. `@type` as array — `{ "@type": ["Product", "schema:Thing"] }`
 *   3. Multiple offers — `offers: [{...}, {...}]`
 *   4. Rich attributes — `material`, `color`, `size`, `category`,
 *      `additionalProperty`
 *
 * This parser handles all four. It returns a partial product shape
 * that the main scraper merges with the meta-tag and HTML-pattern
 * layers (JSON-LD wins on conflict, since it's authoritative).
 *
 * Why a separate module: the original implementation was an inline
 * private method on ProductExtractor, which made it untestable in
 * isolation. Shipping coverage gains without tests is anti-pattern
 * #7 (TDD-first for data-flow changes).
 */

import { createModuleLogger } from '../shared/logger';

const log = createModuleLogger('json-ld-parser');

export interface JSONLDProductData {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  description?: string;
  category?: string;
  material?: string;
  color?: string;
}

const SCRIPT_REGEX = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Walk a JSON-LD payload and yield every Product node found, regardless
 * of whether it's at the root, nested inside `@graph`, or carries an
 * array `@type`. Recursive so deeply nested catalogues still surface.
 */
function* findProductNodes(node: unknown): Generator<Record<string, unknown>> {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) yield* findProductNodes(item);
    return;
  }

  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const isProduct =
    type === 'Product' ||
    (Array.isArray(type) && type.includes('Product'));

  if (isProduct) {
    yield obj;
  }

  // Recurse into common containers. `@graph` is the standard one; we
  // also descend into `mainEntity` / `itemListElement` since some PIMs
  // wrap product nodes there.
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
    const child = obj[key];
    if (child !== undefined) yield* findProductNodes(child);
  }
}

/**
 * Extract a usable image URL from a JSON-LD `image` field. Handles
 * raw strings, arrays, and ImageObject nodes. Returns the first
 * non-empty URL.
 */
function extractImageUrl(image: unknown): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image || undefined;
  if (Array.isArray(image)) {
    for (const entry of image) {
      const url = extractImageUrl(entry);
      if (url) return url;
    }
    return undefined;
  }
  if (typeof image === 'object') {
    const obj = image as Record<string, unknown>;
    // Schema.org ImageObject canonical: contentUrl > url > image (alias).
    const candidates = ['contentUrl', 'url', 'image'];
    for (const key of candidates) {
      const value = obj[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  return undefined;
}

/**
 * Pick the first usable offer from a Product's `offers` field. Some
 * storefronts emit a single Offer, others an array, others an
 * AggregateOffer wrapper. Prefer offers with `availability` listed as
 * InStock; fall back to the first offer if none flag availability.
 */
function pickOffer(offers: unknown): Record<string, unknown> | undefined {
  if (!offers || typeof offers !== 'object') return undefined;

  // AggregateOffer — pull through to lowPrice / highPrice handling
  // by treating the wrapper itself as the offer (it carries
  // `priceCurrency`, `lowPrice`, `highPrice`, `offerCount`).
  const root = offers as Record<string, unknown>;
  const type = root['@type'];
  if (typeof type === 'string' && type === 'AggregateOffer') {
    return root;
  }

  const list: Record<string, unknown>[] = Array.isArray(offers)
    ? (offers as Record<string, unknown>[])
    : [root];

  const inStock = list.find((o) => {
    const a = o.availability;
    return typeof a === 'string' && /InStock/i.test(a);
  });
  return inStock ?? list[0];
}

function readBrand(brand: unknown): string | undefined {
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  if (typeof brand === 'object') {
    const b = brand as Record<string, unknown>;
    if (typeof b.name === 'string') return b.name;
  }
  return undefined;
}

function readCategory(category: unknown): string | undefined {
  if (!category) return undefined;
  if (typeof category === 'string') return category;
  // Some PIMs emit category as a list of breadcrumb segments.
  if (Array.isArray(category)) {
    const parts = category.filter((c) => typeof c === 'string') as string[];
    if (parts.length) return parts[parts.length - 1];
  }
  return undefined;
}

/**
 * Extract a partial Product from raw HTML by scanning every JSON-LD
 * script tag and merging fields from the first node that yields a
 * usable title + price. Falls back to the first Product node found
 * when no node has price data (description-only catalogues).
 */
export function parseJSONLDProduct(html: string): JSONLDProductData {
  const result: JSONLDProductData = {};
  let bestPartial: JSONLDProductData | null = null;

  const matches = html.matchAll(SCRIPT_REGEX);
  for (const match of matches) {
    const raw = match[1].trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      log.debug({ err: (err as Error).message }, 'JSON-LD parse failed');
      continue;
    }

    for (const product of findProductNodes(parsed)) {
      const partial: JSONLDProductData = {};

      if (typeof product.name === 'string') partial.title = product.name;
      if (typeof product.description === 'string') {
        partial.description = product.description.slice(0, 500);
      }

      const brand = readBrand(product.brand);
      if (brand) partial.brandName = brand;

      const imageUrl = extractImageUrl(product.image);
      if (imageUrl) partial.imageUrl = imageUrl;

      const category = readCategory(product.category);
      if (category) partial.category = category;

      if (typeof product.material === 'string') partial.material = product.material;
      if (typeof product.color === 'string') partial.color = product.color;

      const offer = pickOffer(product.offers);
      if (offer) {
        const price = offer.price ?? offer.lowPrice;
        if (price !== undefined) partial.price = String(price);
        if (typeof offer.priceCurrency === 'string') {
          partial.currency = offer.priceCurrency;
        }
      }

      // Prefer a node that has both title + price. If we don't find
      // one, return the first node we saw so the caller still benefits
      // from any partial data (description, image, category).
      if (partial.title && partial.price) {
        return partial;
      }
      if (!bestPartial && (partial.title || partial.price || partial.imageUrl)) {
        bestPartial = partial;
      }
    }
  }

  return bestPartial ?? result;
}
