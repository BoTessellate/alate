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
  /** Set when the storefront advertises made-to-measure / bespoke /
   *  custom-size service for this product. Detection is product-local
   *  (option names, option values, tags, handle/title) — we do NOT
   *  persist a brand-level registry, since scraped product metadata
   *  staying out of a shared catalog is anti-pattern #1. */
  customFit?: { available: boolean; label?: string };
}

/**
 * Strip HTML tags + decode entities from a scraped string. Some
 * Shopify stores (yamayoga.in) embed `<span class="...">…</span>`
 * inside the `vendor` or `title` field as a CSS-driven font swap;
 * without stripping, that markup lands on the fit card as raw text.
 * Mirror of `mobile/src/utils/sanitize.ts` so cleaning happens at
 * BOTH ends of the pipe — defense in depth.
 */
const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};
function stripHtmlAndDecode(s: string | undefined): string | undefined {
  if (!s) return s;
  const stripped = s
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|td)\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => HTML_ENTITY_MAP[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || undefined;
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

// =============================================================================
// Custom-fit detection
//
// Some brands (Oshin Sarin, etc.) sell hand-tailored / made-to-measure
// pieces alongside their standard size ladder. The storefront surfaces
// this as either an option name (e.g. "Custom Size"), an option value
// in the size axis ("XS / S / M / L / Custom Size"), a tag
// (`made-to-measure`, `bespoke`), or words in the handle/title. We pick
// up any of those signals and surface a short human label the mobile
// client can render as a badge near the brand line. Detection is
// per-request — we never persist a brand-level "supports custom fit"
// flag (anti-pattern #1: don't aggregate scraped metadata into a shared
// catalog). If we later want a brand registry, that's a separate
// product decision with explicit opt-in, not a side-effect of scraping.
// =============================================================================

const CUSTOM_FIT_PATTERN =
  /\b(custom\s?(?:size|fit)|made[-\s]?to[-\s]?measure|made[-\s]?to[-\s]?order|bespoke|tailored\s?to\s?fit)\b/i;

function canonicaliseCustomFitLabel(raw: string): string {
  const t = raw.toLowerCase();
  if (/made[-\s]?to[-\s]?measure/.test(t)) return 'Made to measure';
  if (/made[-\s]?to[-\s]?order/.test(t)) return 'Made to order';
  if (/bespoke/.test(t)) return 'Bespoke';
  if (/tailored/.test(t)) return 'Tailored to fit';
  if (/custom\s?fit/.test(t)) return 'Custom fit available';
  return 'Custom sizing available';
}

export interface CustomFitDetectionInput {
  options: Array<{ name?: string; values?: string[] }>;
  tags: string[];
  title: string;
  handle: string;
}

/**
 * Inspect a Shopify product payload for custom-fit signals. Priority
 * order: option names → option values → tags → handle/title. First
 * match wins (we also pick the label off it). Returns `undefined`
 * when no signal is found — keeping the field unset means the mobile
 * client can omit the badge instead of rendering an empty pill.
 */
export function detectCustomFit(
  input: CustomFitDetectionInput
): { available: boolean; label?: string } | undefined {
  for (const opt of input.options) {
    if (opt.name && CUSTOM_FIT_PATTERN.test(opt.name)) {
      return { available: true, label: canonicaliseCustomFitLabel(opt.name) };
    }
    if (Array.isArray(opt.values)) {
      for (const value of opt.values) {
        if (value && CUSTOM_FIT_PATTERN.test(value)) {
          return { available: true, label: canonicaliseCustomFitLabel(value) };
        }
      }
    }
  }
  for (const tag of input.tags) {
    if (CUSTOM_FIT_PATTERN.test(tag)) {
      return { available: true, label: canonicaliseCustomFitLabel(tag) };
    }
  }
  for (const source of [input.title, input.handle]) {
    if (source && CUSTOM_FIT_PATTERN.test(source)) {
      return { available: true, label: canonicaliseCustomFitLabel(source) };
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
      handle?: string;
      // Shopify exposes the named dimensions of a multi-variant
      // product as an ordered array. Position 1 → option1, position 2
      // → option2, position 3 → option3 on each variant. We use the
      // names to find which option index is the size dimension
      // instead of guessing it's always option1.
      options?: Array<{ name?: string; position?: number; values?: string[] }>;
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

    // Identify size axes from product.options. Any option whose name
    // contains "size" counts — this catches "Size", "Top Size",
    // "Bottom Size", and the Oshin Sarin two-axis case where a co-ord
    // set carries both top and bottom axes. The Reistor case (April
    // 29 2026 regression) where colour=option1 and size=option2 also
    // resolves correctly through this path since "Size" matches the
    // /size/i regex. When the option list is missing OR no axis name
    // matches, we fall back to option1 (legacy single-axis stores).
    //
    // We dedupe across colour variants via the `seen` Set: a product
    // with 2 colours × 5 sizes lists every size twice in `variants`;
    // the fit card just wants the unique set in storefront order.
    const productOptions = Array.isArray(product.options) ? product.options : [];
    const sizeAxisIndices: number[] = [];
    productOptions.forEach((opt, i) => {
      if (opt && typeof opt.name === 'string' && /size/i.test(opt.name)) {
        sizeAxisIndices.push(i);
      }
    });

    const variantOptionAt = (
      v: NonNullable<typeof product.variants>[number],
      idx: number
    ): string | null | undefined => {
      if (idx === 0) return v.option1;
      if (idx === 1) return v.option2;
      if (idx === 2) return v.option3;
      return undefined;
    };

    let availableSizes: string[];
    if (sizeAxisIndices.length > 0) {
      const collected: string[] = [];
      const seen = new Set<string>();
      for (const v of trackedVariants) {
        for (const axis of sizeAxisIndices) {
          const value = variantOptionAt(v, axis);
          if (!value) continue;
          // "Custom Size" / "Made to Measure" surfaced as an option
          // value is a service tier, not a stocked size. Excluding it
          // keeps the recommended-size lookup honest — including it
          // would let a "M" recommendation match nothing in real
          // ladders that happen to also expose a custom slot.
          if (CUSTOM_FIT_PATTERN.test(value)) continue;
          const key = value.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(value);
        }
      }
      availableSizes = collected;
    } else {
      availableSizes = trackedVariants
        .map((v) => v.option1)
        .filter((s): s is string => Boolean(s));
    }

    const customFit = detectCustomFit({
      options: productOptions,
      tags,
      title: product.title ?? '',
      handle: product.handle ?? handle,
    });

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

    // Some merchants (Oshin Sarin confirmed May 2 2026) offer
    // made-to-measure as a page-level CTA but don't expose any signal
    // in their Shopify JSON — it's rendered as an HTML button via
    // their theme. When detectCustomFit() found nothing in the JSON,
    // fetch the rendered HTML page and run the same pattern over it
    // so we don't miss the affordance. Skipped when JSON already had
    // a signal — keeps the happy path single-request.
    let resolvedCustomFit = customFit;
    if (!resolvedCustomFit) {
      resolvedCustomFit = await tryCustomFitFromHtml(url, fetchFn);
    }

    const result: ShopifyScrapedData = {
      // title and brandName are run through `stripHtmlAndDecode`
      // because some merchants (yamayoga.in confirmed April 29 2026)
      // embed `<span class="...">` inside the Shopify JSON's vendor /
      // title fields for a CSS font-swap hack. Without stripping,
      // the markup renders literally on the fit card.
      title: stripHtmlAndDecode(product.title),
      brandName: stripHtmlAndDecode(product.vendor),
      category,
      price: primaryVariant?.price,
      currency,
      compareAtPrice: primaryVariant?.compare_at_price ?? undefined,
      imageUrl,
      description: description || undefined,
      tags: tags.length ? tags : undefined,
      material: extractMaterialFromTags(tags),
      availableSizes: availableSizes.length ? availableSizes : undefined,
      customFit: resolvedCustomFit,
    };

    log.info({ jsonUrl, handle }, 'Shopify JSON fetch succeeded');
    return result;
  } catch (error) {
    log.debug({ jsonUrl, error: (error as Error).message }, 'Shopify JSON fetch failed');
    return null;
  }
}

/**
 * Fallback custom-fit detection from the rendered product page HTML.
 * Used when the Shopify JSON has no signal (option / tag / title) but
 * the merchant exposes their made-to-measure offer via a theme-level
 * button. Cheap to run — a single GET and a regex sweep — gated on
 * the JSON-side signal being absent so the typical scrape stays one
 * request.
 *
 * Returns undefined on any failure (network, non-2xx, parse) — the
 * call site already treats undefined as "no custom fit".
 */
async function tryCustomFitFromHtml(
  url: URL,
  fetchFn: typeof fetch
): Promise<{ available: boolean; label?: string } | undefined> {
  try {
    const response = await fetchFn(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ' +
          'Alate/1.0 (+https://alate.app)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return undefined;
    const html = await response.text();
    const match = html.match(CUSTOM_FIT_PATTERN);
    if (!match) return undefined;
    return { available: true, label: canonicaliseCustomFitLabel(match[0]) };
  } catch {
    return undefined;
  }
}
