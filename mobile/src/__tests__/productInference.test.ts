/**
 * Product inference — derives a likely category + material from
 * URL handle, product title, and tag list when the upstream scrape
 * + AI enrichment didn't surface them.
 *
 * Three real-world tests this is designed to handle:
 *
 * 1. yamayoga.in's `aero-flared-yoga-pants-malaga-pink` —
 *    product_type drops as title-echo, no fabric in tags.
 *    Inference: handle has "yoga pants" → category Activewear.
 *    Material: still unknowable (no signal anywhere).
 *
 * 2. reistor.in's `striped-matching-set-...` —
 *    Shopify fetch already pulls material "Cotton" from tags, but
 *    if it ever drops, inference can recover from `Cotton` tag.
 *    Category from `CO-ORD SETS` tag.
 *
 * 3. wild-cherry's `OLIVIA LINEN SET` (title) —
 *    Title contains "Linen" → material Linen, "Set" → category Set.
 */

import { inferCategory, inferMaterial } from '../utils/productInference';

describe('inferCategory', () => {
  it('picks "Activewear" from a yoga-pants handle (yamayoga regression)', () => {
    expect(
      inferCategory({
        url: 'https://yamayoga.in/products/aero-flared-yoga-pants-malaga-pink',
        title: 'aeroyama Flared Yoga Pants',
        tags: ['bottoms', 'yoga_pilates', 'working_out'],
      })
    ).toBe('Activewear');
  });

  it('picks "Co-ord Set" from a matching-set title (reistor regression)', () => {
    expect(
      inferCategory({
        title: 'Striped Matching Set with Regular Shorts and V-neck Top',
        tags: ['CO-ORD SETS', 'Cotton'],
      })
    ).toBe('Co-ord Set');
  });

  it('picks "Dresses" from a midi-dress title', () => {
    expect(
      inferCategory({
        title: 'Linen Midi Dress',
      })
    ).toBe('Dresses');
  });

  it('picks "Tops" from a v-neck top title', () => {
    expect(
      inferCategory({
        title: 'Vanya Cotton V-Neck Top',
      })
    ).toBe('Tops');
  });

  it('picks "Outerwear" from a blazer title', () => {
    expect(
      inferCategory({
        title: 'Wool Blend Blazer',
      })
    ).toBe('Outerwear');
  });

  it('picks "Bottoms" from a trousers title', () => {
    expect(
      inferCategory({
        title: 'Linen Blend Wide-Leg Trousers',
      })
    ).toBe('Bottoms');
  });

  it('returns undefined when no signal matches anywhere', () => {
    expect(
      inferCategory({
        title: 'aaaaaaa unrecognised qqqqq',
        tags: ['mystery'],
      })
    ).toBeUndefined();
  });

  it('returns undefined for empty / missing inputs', () => {
    expect(inferCategory({})).toBeUndefined();
  });

  it('is case-insensitive on the haystack', () => {
    expect(inferCategory({ title: 'BLACK MIDI DRESS' })).toBe('Dresses');
  });

  it('prefers the more specific match when both are present (yoga > bottoms)', () => {
    // Yoga is a subcategory of bottoms; the inference table is
    // ordered specific-first so "yoga pants" beats "pants".
    expect(
      inferCategory({
        title: 'Aero Flared Yoga Pants',
        tags: ['bottoms'],
      })
    ).toBe('Activewear');
  });
});

describe('inferMaterial', () => {
  it('extracts "Linen" from the title (wild-cherry regression)', () => {
    expect(
      inferMaterial({ title: 'OLIVIA LINEN SET' })
    ).toBe('Linen');
  });

  it('extracts "Cotton" from a tag list (reistor regression)', () => {
    expect(
      inferMaterial({
        title: 'Vanya V-neck Top',
        tags: ['CO-ORD SETS', 'Cotton', 'organic cotton'],
      })
    ).toBe('Cotton');
  });

  it('returns undefined when fabric word is absent (yamayoga regression)', () => {
    expect(
      inferMaterial({
        title: 'aeroyama Flared Yoga Pants',
        tags: ['bottoms', 'yoga_pilates'],
      })
    ).toBeUndefined();
  });

  it('Title-cases the matched fabric ("linen" → "Linen")', () => {
    expect(inferMaterial({ title: 'plain linen tee' })).toBe('Linen');
  });

  it('catches "silk" / "wool" / "denim" / "cashmere" etc.', () => {
    expect(inferMaterial({ title: 'silk camisole' })).toBe('Silk');
    // Merino is more specific than wool — return the specific label.
    expect(inferMaterial({ title: 'merino wool sweater' })).toBe('Merino Wool');
    expect(inferMaterial({ title: 'wool blend coat' })).toBe('Wool');
    expect(inferMaterial({ title: 'denim jacket' })).toBe('Denim');
    expect(inferMaterial({ title: 'cashmere shawl' })).toBe('Cashmere');
  });

  it('returns undefined for empty / missing inputs', () => {
    expect(inferMaterial({})).toBeUndefined();
  });
});
