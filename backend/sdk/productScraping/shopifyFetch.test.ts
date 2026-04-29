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
import { tryShopifyJSON, extractMaterialFromTags, detectCustomFit } from './shopifyFetch';

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
// Real-world payload shape reduced from oshinsarin.in. The "Felled Seam
// Set" is a top + bottom co-ord with TWO size axes (Top Size, Bottom
// Size), each carrying the same XS / S / M / L / XL / XXL ladder plus
// a "Custom Size" value the merchant uses to surface their made-to-
// measure service. The previous shopifyFetch only read `option1` which
// captured "Top Size" but missed every Bottom-Size-only variant when
// the merchant skipped the Top axis on a custom-size SKU. Downstream,
// availability.ts saw an incomplete sizes array and reported the user's
// recommended size as out-of-stock even though the storefront stocked
// every size in the standard ladder.
const SAMPLE_OSHIN_RESPONSE = {
  product: {
    id: 9123456789012,
    title: 'Felled Seam Set',
    body_html: '<p>Hand-tailored co-ord set in raw silk.</p>',
    vendor: 'Oshin Sarin',
    product_type: 'Sets',
    handle: 'felled-seam-set',
    tags: 'Made to Measure, Sets, raw silk, co-ord',
    options: [
      { name: 'Top Size', position: 1, values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom Size'] },
      { name: 'Bottom Size', position: 2, values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom Size'] },
    ],
    variants: [
      { id: 1, title: 'XS / XS', price: '12000.00', option1: 'XS', option2: 'XS', inventory_management: 'shopify' },
      { id: 2, title: 'S / S', price: '12000.00', option1: 'S', option2: 'S', inventory_management: 'shopify' },
      { id: 3, title: 'M / M', price: '12000.00', option1: 'M', option2: 'M', inventory_management: 'shopify' },
      { id: 4, title: 'L / L', price: '12000.00', option1: 'L', option2: 'L', inventory_management: 'shopify' },
      { id: 5, title: 'XL / XL', price: '12000.00', option1: 'XL', option2: 'XL', inventory_management: 'shopify' },
      { id: 6, title: 'XXL / XXL', price: '12000.00', option1: 'XXL', option2: 'XXL', inventory_management: 'shopify' },
      { id: 7, title: 'Custom Size / Custom Size', price: '14000.00', option1: 'Custom Size', option2: 'Custom Size', inventory_management: 'shopify' },
    ],
    images: [{ src: 'https://oshinsarin.in/cdn/shop/files/felled-seam.jpg' }],
  },
};

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

  // -- Two-axis sizing (Oshin Sarin "Felled Seam Set" regression) --------

  it('collects sizes from both axes when a product has two size dimensions', async () => {
    // Regression: oshinsarin.in serves co-ords with `Top Size` AND
    // `Bottom Size` axes. Reading only `option1` gave us a partial size
    // ladder; the user's recommended size (e.g. M) wasn't in it, so
    // availability.ts reported out-of-stock. Both axes are size axes,
    // so the surfaced ladder should be the deduped union.
    const fetchFn = mockFetch(SAMPLE_OSHIN_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://oshinsarin.in/products/felled-seam-set'),
      fetchFn
    );
    expect(result).not.toBeNull();
    expect(result!.availableSizes).toEqual(
      expect.arrayContaining(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
    );
  });

  it('excludes "Custom Size" from availableSizes (it is a service, not a stocked size)', async () => {
    // "Custom Size" is the merchant's made-to-measure offer surfaced as
    // an option value. It must NOT count as a stocked size because the
    // recommended-size lookup would then never match a real avatar
    // size, and we'd flip the in_stock state on its head.
    const fetchFn = mockFetch(SAMPLE_OSHIN_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://oshinsarin.in/products/felled-seam-set'),
      fetchFn
    );
    expect(result!.availableSizes).not.toContain('Custom Size');
    expect(result!.availableSizes).not.toContain('custom size');
  });

  it('detects custom-fit availability and surfaces a label', async () => {
    const fetchFn = mockFetch(SAMPLE_OSHIN_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://oshinsarin.in/products/felled-seam-set'),
      fetchFn
    );
    expect(result!.customFit?.available).toBe(true);
    expect(result!.customFit?.label).toBeTruthy();
  });

  it('does not set customFit on a brand without made-to-measure offering', async () => {
    const fetchFn = mockFetch(SAMPLE_SUMMERAWAY_RESPONSE);
    const result = await tryShopifyJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result!.customFit).toBeUndefined();
  });

  it('preserves single-axis size behavior when product.options is missing', async () => {
    // Yamayoga fixture has no `options` array (legacy shape). We must
    // still surface sizes from variants[*].option1 — i.e. the existing
    // single-axis path stays intact. Critical: do not regress sites
    // we already serve correctly while fixing the two-axis case.
    const fetchFn = mockFetch(SAMPLE_YAMAYOGA_RESPONSE);
    const result = await tryShopifyJSON(
      new URL(
        'https://yamayoga.in/products/aero-long-sleeve-with-thumb-hole-sand-grey'
      ),
      fetchFn
    );
    expect(result!.availableSizes).toEqual(['XS', 'XS']); // both variants are XS
  });
});

describe('detectCustomFit', () => {
  it('flags option-name signals like "Custom Size"', () => {
    const result = detectCustomFit({
      options: [{ name: 'Custom Size', values: ['Yes'] }],
      tags: [],
      title: 'Some product',
      handle: 'some-product',
    });
    expect(result?.available).toBe(true);
  });

  it('flags option-value signals like "Custom Size" / "Made to Measure"', () => {
    const result = detectCustomFit({
      options: [{ name: 'Size', values: ['XS', 'S', 'M', 'Custom Size'] }],
      tags: [],
      title: '',
      handle: '',
    });
    expect(result?.available).toBe(true);
    expect(result?.label?.toLowerCase()).toMatch(/custom|measure/);
  });

  it('flags tag signals like "made-to-measure" or "bespoke"', () => {
    const result = detectCustomFit({
      options: [],
      tags: ['silk', 'made-to-measure'],
      title: '',
      handle: '',
    });
    expect(result?.available).toBe(true);
    expect(result?.label?.toLowerCase()).toContain('measure');
  });

  it('flags handle / title signals as a last resort', () => {
    const result = detectCustomFit({
      options: [],
      tags: [],
      title: 'Bespoke Wedding Gown',
      handle: 'bespoke-wedding-gown',
    });
    expect(result?.available).toBe(true);
  });

  it('returns undefined when no signal is present', () => {
    const result = detectCustomFit({
      options: [{ name: 'Size', values: ['XS', 'S', 'M'] }],
      tags: ['linen', 'best seller'],
      title: 'Costa Top',
      handle: 'costa-top',
    });
    expect(result).toBeUndefined();
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
