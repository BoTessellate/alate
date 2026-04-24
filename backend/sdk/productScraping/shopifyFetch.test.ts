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
