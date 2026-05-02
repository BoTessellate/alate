/**
 * WooCommerce direct-fetch layer — unit tests.
 *
 * Most WooCommerce storefronts expose the WC Store API at
 * `/wp-json/wc/store/v1/products?slug=<handle>`. It returns a JSON
 * payload with prices, images, attributes, and categories — i.e. the
 * same authoritative product data Shopify exposes via `/products/
 * <handle>.json`. Without this layer, our generic HTML extractor falls
 * back to OG meta tags, and many WooCommerce sites (Tarshari is the
 * canonical regression case) expose neither product:price meta nor
 * JSON-LD, so the price drops off the fit card entirely.
 *
 * Strategy: when the URL path matches `/product/<handle>` (singular —
 * WooCommerce default; differs from Shopify's plural `/products/`),
 * fetch the WC Store API endpoint. Silently return null on 404,
 * timeout, or wrong shape so the existing fall-through layers run.
 */

import { describe, it, expect, vi } from 'vitest';
import { tryWooCommerceJSON } from './wooCommerceFetch';

// Reduced fixture from the live Tarshari /wp-json/wc/store/v1 response
// for `slug=orla-slip-dress` (May 2 2026). Kept just the fields the
// parser reads — full payload is ~3 KB, this is enough to exercise
// every branch.
const SAMPLE_TARSHARI_RESPONSE = [
  {
    id: 6046,
    name: 'Daphnie Slip Dress',
    slug: 'orla-slip-dress',
    type: 'variable',
    permalink: 'https://tarshari.in/product/orla-slip-dress/',
    sku: 'TM08_18-2',
    short_description:
      '<p>Material &#8211; Handprinted Cotton</p>\n<p>Lining &#8211; Cotton</p>',
    description: '',
    on_sale: true,
    prices: {
      price: '4000',
      regular_price: '4400',
      sale_price: '4000',
      currency_code: 'INR',
      currency_symbol: '₹',
    },
    images: [
      {
        src: 'https://i0.wp.com/tarshari.in/wp-content/uploads/2024/05/cr7075901218.jpeg?fit=1200%2C1800&ssl=1',
      },
      {
        src: 'https://i0.wp.com/tarshari.in/wp-content/uploads/2024/05/second.jpeg',
      },
    ],
    attributes: [
      {
        name: 'Color',
        terms: [{ name: 'Red' }, { name: 'Black' }],
      },
      {
        name: 'Size',
        terms: [
          { name: 'XXS' },
          { name: 'XS' },
          { name: 'S' },
          { name: 'M' },
          { name: 'L' },
          { name: 'XL' },
          { name: '2XL' },
          { name: '3XL' },
        ],
      },
      {
        name: 'Height',
        terms: [{ name: "Less than 5'2\"" }, { name: "Between 5'2\" to 5'7\"" }],
      },
    ],
    categories: [
      { name: 'All Dresses' },
      { name: 'Bodycon Fits' },
      { name: 'Clothing' },
      { name: 'Daphnie' },
    ],
    tags: [{ name: 'cotton' }, { name: 'handprinted' }],
  },
];

// Minimal WooCommerce response without optional fields — checks
// graceful degradation (missing images, no attributes, no tags, no
// sale price).
const SAMPLE_MINIMAL_RESPONSE = [
  {
    id: 1,
    name: 'Plain Tee',
    slug: 'plain-tee',
    type: 'simple',
    prices: {
      price: '999',
      currency_code: 'INR',
    },
  },
];

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  } as Response);
}

describe('tryWooCommerceJSON', () => {
  it('returns null for URLs that are not /product/<handle>', async () => {
    const fetchFn = vi.fn();
    const result = await tryWooCommerceJSON(
      new URL('https://example.com/shop/item-123'),
      fetchFn
    );
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does NOT request for Shopify-style /products/ URLs', async () => {
    // Important: Shopify URLs use `/products/<handle>` (plural). The
    // Shopify direct-fetch layer handles those; this layer must not
    // intercept them — otherwise we double-fetch and the WC endpoint
    // 404s on every Shopify storefront.
    const fetchFn = vi.fn();
    const result = await tryWooCommerceJSON(
      new URL('https://summeraway.in/products/costa-top'),
      fetchFn
    );
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('requests the WC Store API for /product/<handle> URLs', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/?ref=share'),
      fetchFn
    );
    expect(fetchFn).toHaveBeenCalledWith(
      'https://tarshari.in/wp-json/wc/store/v1/products?slug=orla-slip-dress',
      expect.any(Object)
    );
  });

  it('extracts core product fields from the WC Store API JSON', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result).not.toBeNull();
    // The site serves "Daphnie Slip Dress" content at the orla URL —
    // we trust the API name field, not the URL slug.
    expect(result!.title).toBe('Daphnie Slip Dress');
    expect(result!.price).toBe('4000');
    expect(result!.currency).toBe('INR');
    expect(result!.imageUrl).toContain('cr7075901218.jpeg');
  });

  it('surfaces compareAtPrice when on_sale and regular_price > sale_price', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result!.compareAtPrice).toBe('4400');
  });

  it('strips HTML from the short_description', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result!.description).toContain('Material');
    expect(result!.description).toContain('Handprinted Cotton');
    expect(result!.description).not.toContain('<p>');
    expect(result!.description).not.toContain('&#8211;');
  });

  it('picks the Size attribute (not Color or Height) for availableSizes', async () => {
    // Mirrors the Shopify multi-axis fix from April 2026: WooCommerce
    // sites also stack Color / Size / Height attributes per product.
    // Picking the wrong axis surfaces colour names (Red/Black) or
    // height bands as "sizes".
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result!.availableSizes).toEqual([
      'XXS',
      'XS',
      'S',
      'M',
      'L',
      'XL',
      '2XL',
      '3XL',
    ]);
  });

  it('exposes category names as a string (first category wins)', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result!.category).toBe('All Dresses');
  });

  it('exposes tags as an array of strings', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result!.tags).toEqual(['cotton', 'handprinted']);
  });

  it('infers brandName from the hostname when WooCommerce does not expose one', async () => {
    const fetchFn = mockFetch(SAMPLE_TARSHARI_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result!.brandName).toBe('Tarshari');
  });

  it('returns null when the endpoint 404s (not a WooCommerce site)', async () => {
    const fetchFn = mockFetch(null, 404);
    const result = await tryWooCommerceJSON(
      new URL('https://random-blog.com/product/whatever'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network failure / timeout)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('returns null when the payload is an empty array (slug not found)', async () => {
    const fetchFn = mockFetch([]);
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/missing-handle/'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('returns null when the payload is the wrong shape', async () => {
    const fetchFn = mockFetch({ not_a_product_array: true });
    const result = await tryWooCommerceJSON(
      new URL('https://tarshari.in/product/orla-slip-dress/'),
      fetchFn
    );
    expect(result).toBeNull();
  });

  it('handles minimal payloads without crashing on missing optional fields', async () => {
    const fetchFn = mockFetch(SAMPLE_MINIMAL_RESPONSE);
    const result = await tryWooCommerceJSON(
      new URL('https://example.in/product/plain-tee/'),
      fetchFn
    );
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Plain Tee');
    expect(result!.price).toBe('999');
    expect(result!.currency).toBe('INR');
    expect(result!.imageUrl).toBeUndefined();
    expect(result!.availableSizes).toBeUndefined();
    expect(result!.tags).toBeUndefined();
    expect(result!.compareAtPrice).toBeUndefined();
  });
});
