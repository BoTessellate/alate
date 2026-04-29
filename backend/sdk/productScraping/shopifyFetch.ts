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
 * TLD → ISO currency code. Mirrors the table in `productScraping/index.ts`
 * (HTML extraction layer) so the Shopify direct-fetch path has the same
 * currency-fallback coverage when the storefront JSON omits per-variant
 * currency (which is the common case — `presentment_prices` carries it
 * but the variant root usually does not).
 */
const TLD_CURRENCY: Record<string, string> = {
  in: 'INR', uk: 'GBP', eu: 'EUR', de: 'EUR', fr: 'EUR',
  it: 'EUR', es: 'EUR', jp: 'JPY', cn: 'CNY', au: 'AUD',
  ca: 'CAD', br: 'BRL', mx: 'MXN', kr: 'KRW', sg: 'SGD',
  ae: 'AED', sa: 'SAR', za: 'ZAR', ru: 'RUB', se: 'SEK',
  no: 'NOK', dk: 'DKK', ch: 'CHF', nz: 'NZD', hk: 'HKD',
  th: 'THB', my: 'MYR', id: 'IDR', ph: 'PHP', vn: 'VND',
  pl: 'PLN', tr: 'TRY',
};

function inferCurrencyFromHostname(hostname: string): string | undefined {
  const tld = hostname.split('.').pop()?.toLowerCase();
  return tld ? TLD_CURRENCY[tld] : undefined;
}

/**
 * Tokenise a string for category/title overlap comparison. Lowercases,
 * strips punctuation/trademark glyphs, and drops a small set of stop
 * words that tend to inflate apparent overlap without carrying meaning
 * ("with", "and", "the", etc.).
 */
const TITLE_STOPWORDS = new Set([
  'with', 'and', 'the', 'for', 'of', 'a', 'an',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !TITLE_STOPWORDS.has(t));
}

/**
 * Decide whether a merchant-supplied `product_type` is genuinely a
 * category or just a re-statement of the product title.
 *
 * Heuristic: only consider `product_type`s with ≥ 4 meaningful tokens —
 * shorter product_types like "Top", "Dress", "Activewear", "Long Sleeve
 * Top", "Slim Fit Yoga Top" are real categories and always pass. For
 * longer product_types we drop them when ≥ 75% of their tokens echo
 * tokens in the title. Token matching is substring-tolerant so that
 * "thumb" and "hole" in product_type still match "thumbhole" in title
 * (and "aero" matches "aeroyama"), which is the actual yamayoga case.
 */
export function isCategoryLikelyTitleEcho(category: string, title: string): boolean {
  const catTokens = tokenise(category);
  if (catTokens.length < 4) return false;
  const titleTokens = tokenise(title);
  if (titleTokens.length === 0) return false;
  const tokenMatches = (cat: string) => {
    for (const t of titleTokens) {
      if (cat === t) return true;
      // Substring match in either direction, ≥ 4 chars to avoid false
      // positives on short tokens like "top" appearing inside "tropical".
      if (cat.length >= 4 && t.includes(cat)) return true;
      if (t.length >= 4 && cat.includes(t)) return true;
    }
    return false;
  };
  const overlap = catTokens.filter(tokenMatches).length;
  return overlap / catTokens.length >= 0.75;
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
      // Shopify exposes the named dimensions of a multi-variant
      // product as an ordered array. Position 1 maps to option1,
      // position 2 → option2, position 3 → option3 on each variant.
      // We use the names to find which option index is the size
      // dimension instead of guessing it's always option1.
      options?: Array<{ name?: string; position?: number }>;
      variants?: Array<{
        id?: number | string;
        title?: string;
        price?: string;
        compare_at_price?: string | null;
        price_currency?: string;
        option1?: string | null;
        option2?: string | null;
        option3?: string | null;
        inventory_management?: string | null;
      }>;
      images?: Array<{ src?: string }>;
    };

    // Pick the canonical variant for price display.
    //
    // Priority order (first match wins):
    //   1. The variant whose id matches the URL's `?variant=<id>` —
    //      this is what the storefront page itself renders, so it's
    //      the price the user just saw before sharing the URL. Skipping
    //      this caused a real bug on multi-variant products where the
    //      shared URL was a Sand Grey colourway at ₹1,999 but variants[0]
    //      was a Charcoal colourway at ₹4,951 — we'd display the wrong
    //      price on the fit card.
    //   2. First variant with Shopify-managed inventory.
    //   3. variants[0] (some stores don't use inventory tracking).
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const trackedVariants = variants.filter(
      (v) => v.inventory_management === 'shopify'
    );

    const variantIdParam = url.searchParams.get('variant');
    const urlSelectedVariant = variantIdParam
      ? variants.find((v) => v.id != null && String(v.id) === variantIdParam)
      : undefined;

    const primaryVariant = urlSelectedVariant ?? trackedVariants[0] ?? variants[0];

    const tags = typeof product.tags === 'string'
      ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    // Find which option index holds the "Size" dimension. Shopify
    // stores `product.options` as `[{name:"Color"},{name:"Size"}]` for
    // multi-dimension products (Reistor, COS, most fashion brands)
    // where position 1 maps to .option1, position 2 → .option2, etc.
    // Single-dimension stores (Summer Away — sizes only) often omit
    // the array entirely; in that case option1 is the size and we
    // fall back to it. Per April 29 2026 regression: Reistor's
    // /products/<handle>.json puts colour in option1 ("Linear Canvas")
    // and size in option2 ("XS" / "S" / "M") — the previous
    // hard-coded option1 read produced `["Linear Canvas", "Linear
    // Canvas", ...]` instead of the actual sizes on the fit card.
    const sizeOptionIndex = (product.options ?? []).findIndex(
      (o) => typeof o.name === 'string' && /^size$/i.test(o.name.trim())
    );
    const sizeKey: 'option1' | 'option2' | 'option3' =
      sizeOptionIndex === 1 ? 'option2' :
      sizeOptionIndex === 2 ? 'option3' :
      'option1';

    // Dedupe across colour variants. A product with 2 colours × 5
    // sizes would otherwise list every size twice (once per colour);
    // the fit card just wants the unique set. `Set` preserves
    // insertion order in JS, so [XS, S, M, XS, S, M] dedupes to
    // [XS, S, M] in storefront order.
    const sizeSet = new Set<string>();
    for (const v of trackedVariants) {
      const s = v[sizeKey];
      if (s) sizeSet.add(s);
    }
    const availableSizes = Array.from(sizeSet);

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

    // Drop merchant `product_type` when it's just the product name in
    // disguise. See `isCategoryLikelyTitleEcho` for the heuristic.
    const rawCategory = product.product_type?.trim() || undefined;
    const category =
      rawCategory && product.title && isCategoryLikelyTitleEcho(rawCategory, product.title)
        ? undefined
        : rawCategory;

    // Currency — Shopify storefront JSON does not consistently expose
    // a per-variant currency. Use the (rare) `price_currency` field if
    // present, otherwise infer from the country TLD so the mobile
    // client can render a price symbol instead of dropping the price
    // object entirely (it requires both amount + currency).
    const currency = primaryVariant?.price_currency || inferCurrencyFromHostname(url.hostname);

    const result: ShopifyScrapedData = {
      title: product.title,
      brandName: product.vendor,
      category,
      price: primaryVariant?.price,
      currency,
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
