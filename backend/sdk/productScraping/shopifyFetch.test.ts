/**
 * Shopify direct-fetch layer — unit tests.
 *
 * Every Shopify storefront exposes a public `/products/<handle>.json`
 * endpoint that their theme consumes for their own product pages. It
 * returns rich, structured data (vendor, product_type, tags, variants,
 * prices, sizes, images) that our generic HTML scraper has to infer.
 *
 * We prefer this over JSON-LD / OG tags whenever the URL looks like a
 * Shopify product path (/products/<handle>). Falls through silently on
 * non-Shopify sites, 404s, or malformed JSON — the next extraction
 * layer picks up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tryShopifyJSON, extractMaterialFromTags } from './shopifyFetch';

const SAMPLE_SUMMERAWAY_RESPONSE = {
  product: {
    id: 8625883807922,
    title: 'Costa Top',
    body_html:
      '<span data-mce-fragment="1">Mindfully made in India. Born for leisurely escapes. </span>',
    vendor: 'Summer Away',
    product_type: 'Top',
    handle: 'costa-top',
    tags:
      'april26-sale-10, april26sale, best seller, Black, DROP XXIV-1, Full Price, going out, holiday edit, L, Linen, linen tops, M, mix+match, Most Loved, occasionwear, S, Sets, Slim Fit, Top, vacation ready, XL, XS',
    variants: [
      {
        id: 46618786693298,
        title: 'XS',
        price: '5931.00',
        compare_at_price: '6590.00',
        price_currency: 'INR',
        option1: 'XS',
        inventory_management: 'shopify',
      },
      {
        id: 46618786726066,
        title: 'S',
        price: '5931.00',
        compare_at_price: '6590.00',
        price_currency: 'INR',
        option1: 'S',
        inventory_management: 'shopify',
      },
      {
        id: 46618786758834,
        title: 'M',
        price: '5931.00',
        compare_at_price: '6590.00',
        price_currency: 'INR',
        option1: 'M',
        inventory_management: 'shopify',
      },
    ],
    images: [
      {
        src: 'https://summeraway.in/cdn/shop/files/CostaTop_BlackHW-1.jpg?v=1761338657',
      },
    ],
  },
};

// Real-world payload shape reduced from yamayoga.in. The Shopify
// storefront JSON does NOT include `price_currency` on variants —
// merchants typically set the shop currency once. Variants in the
// array can also have very different prices when the merchant uses
// Shopify variants for distinct SKUs (color + size combo). The URL
// the user shares pins a specific variant via `?variant=<id>`; we
// must honor that ID instead of blindly returning variants[0].
const SAMPLE_YAMAYOGA_RESPONSE = {
  product: {
    id: 7755555555555,
    title: 'aeroyama™ Long Sleeve Thumbhole Top',
    body_html: 'Soft, breathable long-sleeve top with thumbholes.',
    vendor: 'Yamayoga',
    product_type: 'Aero Long Sleeve With Thumb Hole',
    handle: 'aero-long-sleeve-with-thumb-hole-sand-grey',
    tags: 'yama*santi women, Activewear, Long Sleeve',
    variants: [
      {
        id: 50674146000000,
        title: 'XS / Charcoal',
        price: '4951.44',
        option1: 'XS',
        option2: 'Charcoal',
        inventory_management: 'shopify',
      },
      {
        id: 50674147000598,
        title: 'XS / Sand Grey',
        price: '1999.00',
        option1: 'XS',
        option2: 'Sand Grey',
        inventory_management: 'shopify',
      },
    ],
    images: [{ src: 'https://yamayoga.in/cdn/shop/files/aero.jpg' }],
  },
};

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  } as Response);
}

describe('tryShopifyJSON', () => {
  it('returns null for non-Shopify URL paths', async () => {
    const fetchFn = vi.fn();
    const result = await tryShopifyJSON(
      new URL('https://example.com/shop/item-123'),
      fetchFn
    );
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('requests the Shopify JSON endpoint for /products/<handle> URLs', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top?pr_prod_strat=x'),
      fetchFn
    );
    expect(fetchFn).toHaveBeenCalledWith(
      'https://summeraway.in/products/costa-top.json',
      expect.any(Object)
    );
  });

  it('extracts core product fields from the Shopify JSON', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Costa Top');
    expect(result!.brandName).toBe('Summer Away');
    expect(result!.category).toBe('Top');
    expect(result!.price).toBe('5931.00');
    expect(result!.currency).toBe('INR');
    expect(result!.imageUrl).toContain('https://');
    expect(result!.imageUrl).toContain('CostaTop_BlackHW-1.jpg');
  });

  it('strips HTML from body_html in the description', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.description).toContain('Mindfully made in India');
    expect(result!.description).not.toContain('<span');
    expect(result!.description).not.toContain('data-mce');
  });

  it('splits comma-separated tags into an array', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.tags).toContain('Linen');
    expect(result!.tags).toContain('Slim Fit');
    expect(result!.tags).toContain('Black');
    expect(result!.tags).toContain('vacation ready');
  });

  it('picks material out of the tag list', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.material).toBe('Linen');
  });

  it('collects available sizes from variants with inventory tracking', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.availableSizes).toEqual(['XS', 'S', 'M']);
  });

  it('returns null if the JSON endpoint 404s (non-Shopify site on the same path)', async () => {
    const fetchFn = mockFetch(null, 404);
    const result = await tryShopifyJSON(
      new URL('https://some-random-site.com/products/thing'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('returns null if fetch throws (network failure)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('returns null if payload is missing the expected product shape', async () => {
    const fetchFn = mockFetch({ not_a_product: true });
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('honors `?variant=<id>` in the URL when picking the primary variant', async () => {
    // Regression: yamayoga.in serves a multi-color long-sleeve top where
    // the Sand Grey XS is ₹1,999 and the Charcoal XS is ₹4,951. The
    // shared URL pins ?variant=50674147000598 (Sand Grey) but the
    // previous logic always returned variants[0] — so users saw the
    // Charcoal price on a Sand Grey product page. Honor the URL.
    const fetchFn = mockFetch(SAMPLE_YAMAYOGA_RESPONSE);
    const result = await tryShopifyJSON(
      new URL(
        'https://yamayoga.in/products/aero-long-sleeve-with-thumb-hole-sand-grey?variant=50674147000598'
      ),
      fetchFn
    );
    expect(result).not.toBeNull();
    expect(result!.price).toBe('1999.00');
  });

  it('falls back to first variant when `?variant=` is not in the URL', async () => {
    const fetchFn = mockFetch(SAMPLE_YAMAYOGA_RESPONSE);
    const result = await tryShopifyJSON(
      new URL(
        'https://yamayoga.in/products/aero-long-sleeve-with-thumb-hole-sand-grey'
      ),
      fetchFn
    );
    // No variant param → first tracked variant wins.
    expect(result!.price).toBe('4951.44');
  });

  it('falls back to first variant when `?variant=` does not match any variant id', async () => {
    const fetchFn = mockFetch(SAMPLE_YAMAYOGA_RESPONSE);
    const result = await tryShopifyJSON(
      new URL(
        'https://yamayoga.in/products/aero-long-sleeve-with-thumb-hole-sand-grey?variant=99999999999'
      ),
      fetchFn
    );
    expect(result!.price).toBe('4951.44');
  });

  it('infers currency from country TLD when Shopify JSON omits it', async () => {
    // Shopify storefront `/products/<handle>.json` does NOT include
    // currency at the variant level. We previously returned `undefined`,
    // which downstream caused the price object to be dropped entirely
    // (mobile requires both amount + currency). Fall back to the TLD.
    const fetchFn = mockFetch(SAMPLE_YAMAYOGA_RESPONSE);
    const result = await tryShopifyJSON(
      new URL(
        'https://yamayoga.in/products/aero-long-sleeve-with-thumb-hole-sand-grey?variant=50674147000598'
      ),
      fetchFn
    );
    expect(result!.currency).toBe('INR');
  });

  it('drops merchant product_type when it is essentially the product title', async () => {
    // yamayoga sets product_type to "Aero Long Sleeve With Thumb Hole"
    // which is the product NAME, not a category. Rendering it as a
    // category in the fit card looks like noise. Better to omit and
    // let the user see only signal categories like "Top" / "Activewear".
    const fetchFn = mockFetch(SAMPLE_YAMAYOGA_RESPONSE);
    const result = await tryShopifyJSON(
      new URL(
        'https://yamayoga.in/products/aero-long-sleeve-with-thumb-hole-sand-grey'
      ),
      fetchFn
    );
    expect(result!.category).toBeUndefined();
  });

  it('keeps a real category like "Top" even when title contains the same word', async () => {
    // Don't over-filter: a generic 1–2 word product_type (e.g. "Top",
    // "Dress", "Activewear") that just happens to share a word with the
    // title should still pass through. Only drop when product_type is
    // long AND mostly a re-statement of the title.
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.category).toBe('Top');
  });

  // ── product.options-driven size discovery ────────────────────────
  // Reistor (and many other multi-dimension Shopify storefronts) put
  // colour in option1 and size in option2. Storefronts with only ONE
  // dimension (just sizes) put size in option1. The previous logic
  // hard-coded `option1` as size — wrong for any multi-dimension store.
  // Fix: read `product.options[*].name` to find which option index
  // holds "Size" and use that index for availableSizes.
  const SAMPLE_REISTOR_RESPONSE = {
    product: {
      id: 9464065949973,
      title: 'Striped Matching Set with Regular Shorts and V-neck Top',
      body_html: '<p>Vacation set.</p>',
      vendor: 'Reistor',
      product_type: 'CO-ORD SETS',
      handle: 'striped-matching-set-with-regular-shorts-and-v-neck-top',
      tags: 'CO-ORD SETS, Cotton, organic cotton',
      // Reistor exposes both dimensions. Position 1 = colour, 2 = size.
      options: [
        { name: 'Color', position: 1 },
        { name: 'Size', position: 2 },
      ],
      variants: [
        { id: 1, title: 'Linear Canvas / XS', price: '4500.00', option1: 'Linear Canvas', option2: 'XS', inventory_management: 'shopify' },
        { id: 2, title: 'Linear Canvas / S',  price: '4500.00', option1: 'Linear Canvas', option2: 'S',  inventory_management: 'shopify' },
        { id: 3, title: 'Linear Canvas / M',  price: '4500.00', option1: 'Linear Canvas', option2: 'M',  inventory_management: 'shopify' },
      ],
      images: [{ src: 'https://cdn.shopify.com/files/striped.jpg' }],
    },
  };

  it('returns the variant price unchanged from the Shopify JSON (regression: Reistor live API returned 19165.30 for a 4500.00 product when running pre-#82 code)', async () => {
    // Sanity check: the price must come straight off the variant.
    // No multiplication, no currency conversion, no field swap. Captured
    // April 29 2026 after a live scrape returned ₹19,165.30 for a
    // ₹4,500 Reistor product because the deployed backend was running
    // pre-#82 code AND had the option1 size bug. Once #82 is deployed
    // the price reads cleanly from variants[0].price = '4500.00'.
    const fetchFn = mockFetch(SAMPLE_REISTOR_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://reistor.in/products/striped-matching-set-with-regular-shorts-and-v-neck-top'),
      fetchFn
    );
    expect(result!.price).toBe('4500.00');
    expect(result!.currency).toBe('INR'); // TLD-inferred
  });

  it('reads availableSizes from the option index named "Size", not from option1 by default', async () => {
    // Regression: reistor.in puts colour in option1 ("Linear Canvas") and
    // size in option2 ("XS" / "S" / "M"). The previous logic always used
    // option1, so the fit card showed `availableSizes: ["Linear Canvas",
    // "Linear Canvas", ...]` instead of the actual sizes. Fix reads
    // `product.options` to find which dimension is named "Size".
    const fetchFn = mockFetch(SAMPLE_REISTOR_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://reistor.in/products/striped-matching-set-with-regular-shorts-and-v-neck-top'),
      fetchFn
    );
    expect(result!.availableSizes).toEqual(['XS', 'S', 'M']);
  });

  it('dedupes sizes across colour variants when one size exists in many colours', async () => {
    // Same shape as Reistor but with two colours × two sizes — the size
    // list should collapse to the unique set, not repeat per colour.
    const TWO_COLOR_TWO_SIZE = {
      product: {
        ...SAMPLE_REISTOR_RESPONSE.product,
        variants: [
          { id: 1, price: '4500.00', option1: 'Linear Canvas', option2: 'XS', inventory_management: 'shopify' },
          { id: 2, price: '4500.00', option1: 'Linear Canvas', option2: 'S',  inventory_management: 'shopify' },
          { id: 3, price: '4500.00', option1: 'Storm Grey',    option2: 'XS', inventory_management: 'shopify' },
          { id: 4, price: '4500.00', option1: 'Storm Grey',    option2: 'S',  inventory_management: 'shopify' },
        ],
      },
    };
    const fetchFn = mockFetch(TWO_COLOR_TWO_SIZE);
    const result = await tryShopifyJSON(
      new URL('https://reistor.in/products/striped-matching-set-with-regular-shorts-and-v-neck-top'),
      fetchFn
    );
    expect(result!.availableSizes).toEqual(['XS', 'S']);
  });

  it('still works when product.options is missing (single-dimension store)', async () => {
    // Some Shopify stores expose only sizes (no colour dimension) and
    // omit the `options` array. Falls back to option1. The Summer Away
    // sample doesn't carry `options` so this is the regression check
    // that single-dimension stores keep working.
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.availableSizes).toEqual(['XS', 'S', 'M']);
  });
});

describe('extractMaterialFromTags', () => {
  it('matches common materials case-insensitively', () => {
    expect(extractMaterialFromTags(['Linen', 'Slim Fit'])).toBe('Linen');
    expect(extractMaterialFromTags(['cotton blend'])).toBe('cotton blend');
    expect(extractMaterialFromTags(['100% Silk'])).toBe('100% Silk');
  });

  it('returns undefined when no material is present', () => {
    expect(extractMaterialFromTags(['Slim Fit', 'Black', 'going out'])).toBeUndefined();
    expect(extractMaterialFromTags([])).toBeUndefined();
  });

  it('prefers the earliest recognised material tag', () => {
    // If both linen and cotton appear, return the first match.
    expect(extractMaterialFromTags(['Slim Fit', 'Linen', 'Cotton'])).toBe('Linen');
  });
});
