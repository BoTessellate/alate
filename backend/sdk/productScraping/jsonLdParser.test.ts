/**
 * jsonLdParser — unit tests.
 *
 * Tier 1 broadened JSON-LD coverage. Confirms the parser handles
 * @graph wrappers, array-typed @type, multi-offer payloads, brand
 * objects, ImageObject image fields, and rich attributes.
 */

import { describe, it, expect } from 'vitest';
import { parseJSONLDProduct } from './jsonLdParser';

function wrap(json: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`;
}

describe('parseJSONLDProduct', () => {
  it('returns empty when no JSON-LD scripts are present', () => {
    expect(parseJSONLDProduct('<html></html>')).toEqual({});
  });

  it('returns empty when JSON-LD is malformed', () => {
    const html = '<script type="application/ld+json">{not json</script>';
    expect(parseJSONLDProduct(html)).toEqual({});
  });

  it('extracts a flat Product node', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Linen Tee',
        description: 'Soft linen tee in oat',
        brand: { '@type': 'Brand', name: 'Acme' },
        image: 'https://cdn.example.com/tee.jpg',
        offers: { '@type': 'Offer', price: '4500.00', priceCurrency: 'INR' },
      })
    );
    expect(result.title).toBe('Linen Tee');
    expect(result.brandName).toBe('Acme');
    expect(result.imageUrl).toBe('https://cdn.example.com/tee.jpg');
    expect(result.price).toBe('4500.00');
    expect(result.currency).toBe('INR');
  });

  it('handles brand as a plain string', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'X',
        brand: 'Acme',
        offers: { price: '100', priceCurrency: 'USD' },
      })
    );
    expect(result.brandName).toBe('Acme');
  });

  it('descends into @graph wrappers (Hydrogen / headless storefronts)', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'Some page' },
          {
            '@type': 'Product',
            name: 'Dress',
            offers: { price: '8000', priceCurrency: 'INR' },
          },
        ],
      })
    );
    expect(result.title).toBe('Dress');
    expect(result.price).toBe('8000');
  });

  it('handles @type as an array containing Product', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': ['Product', 'schema:Thing'],
        name: 'Dress',
        offers: { price: '6000', priceCurrency: 'INR' },
      })
    );
    expect(result.title).toBe('Dress');
    expect(result.price).toBe('6000');
  });

  it('picks an in-stock offer when multiple offers are present', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'Pants',
        offers: [
          { '@type': 'Offer', price: '3000', priceCurrency: 'INR', availability: 'OutOfStock' },
          { '@type': 'Offer', price: '3500', priceCurrency: 'INR', availability: 'InStock' },
        ],
      })
    );
    expect(result.price).toBe('3500');
  });

  it('falls back to the first offer when none flag availability', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'Pants',
        offers: [
          { '@type': 'Offer', price: '3000', priceCurrency: 'INR' },
          { '@type': 'Offer', price: '3500', priceCurrency: 'INR' },
        ],
      })
    );
    expect(result.price).toBe('3000');
  });

  it('reads lowPrice from an AggregateOffer wrapper', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'Pants',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '2999',
          highPrice: '4999',
          priceCurrency: 'INR',
        },
      })
    );
    expect(result.price).toBe('2999');
    expect(result.currency).toBe('INR');
  });

  it('extracts URL from ImageObject', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'X',
        image: { '@type': 'ImageObject', contentUrl: 'https://cdn.example.com/x.jpg' },
        offers: { price: '1', priceCurrency: 'USD' },
      })
    );
    expect(result.imageUrl).toBe('https://cdn.example.com/x.jpg');
  });

  it('extracts the first usable URL from an image array', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'X',
        image: [
          { '@type': 'ImageObject', url: 'https://cdn.example.com/a.jpg' },
          'https://cdn.example.com/b.jpg',
        ],
        offers: { price: '1', priceCurrency: 'USD' },
      })
    );
    expect(result.imageUrl).toBe('https://cdn.example.com/a.jpg');
  });

  it('extracts material, color, and category attributes', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'Linen Tee',
        material: 'Linen',
        color: 'Oat',
        category: 'Tops',
        offers: { price: '1', priceCurrency: 'USD' },
      })
    );
    expect(result.material).toBe('Linen');
    expect(result.color).toBe('Oat');
    expect(result.category).toBe('Tops');
  });

  it('reads the leaf segment of a breadcrumb category list', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'Linen Tee',
        category: ['Apparel', 'Womenswear', 'Tops'],
        offers: { price: '1', priceCurrency: 'USD' },
      })
    );
    expect(result.category).toBe('Tops');
  });

  it('returns the first usable partial when no node has price data', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'Catalog Listing',
        description: 'No price published',
      })
    );
    expect(result.title).toBe('Catalog Listing');
    expect(result.price).toBeUndefined();
  });

  it('caps description length at 500 chars', () => {
    const longDesc = 'x'.repeat(800);
    const result = parseJSONLDProduct(
      wrap({
        '@type': 'Product',
        name: 'X',
        description: longDesc,
        offers: { price: '1', priceCurrency: 'USD' },
      })
    );
    expect(result.description?.length).toBe(500);
  });

  it('skips non-Product nodes inside @graph', () => {
    const result = parseJSONLDProduct(
      wrap({
        '@graph': [
          { '@type': 'BreadcrumbList', itemListElement: [] },
          { '@type': 'Organization', name: 'Acme' },
        ],
      })
    );
    expect(result).toEqual({});
  });

  it('finds Product across multiple script tags', () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'Organization', name: 'Acme' }) +
      '</script>' +
      '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'Product',
        name: 'Found Me',
        offers: { price: '7000', priceCurrency: 'INR' },
      }) +
      '</script>';
    const result = parseJSONLDProduct(html);
    expect(result.title).toBe('Found Me');
    expect(result.price).toBe('7000');
  });
});
