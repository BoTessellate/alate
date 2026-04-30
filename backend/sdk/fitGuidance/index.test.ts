/**
 * Fit Guidance SDK — unit tests.
 *
 * Focus: tummy/midsection rules added April 30 2026 to wire the new
 * `tummy` avatar field through to backend warning generation. Mobile
 * was already collecting the value; backend now branches on it for
 * non-stretch waistband-fitted garments.
 */

import { describe, it, expect } from 'vitest';
import {
  predictFit,
  type AvatarMeasurements,
  type ProductData,
} from './index';

const baseAvatar: AvatarMeasurements = {
  height_cm: 168,
  shoulders: 'average',
  bust: 'medium',
  waist: 'average',
  hips: 'average',
  thighs: 'average',
  torso_length: 'average',
};

const baseProduct: ProductData = {
  id: 'p1',
  product_name: 'High Waist Trousers',
  category: 'pants',
  material: 'cotton',
  tags: ['high-waisted', 'fitted'],
  description: 'High waist tailored trousers in 100% cotton.',
};

describe('predictFit — tummy rules', () => {
  it('warns when tummy is "full" + non-stretch + fitted high-waist', () => {
    const warnings = predictFit(baseProduct, { ...baseAvatar, tummy: 'full' });
    expect(warnings.some(w => /tummy|midsection|waistband|stomach|abdomen/i.test(w.message))).toBe(true);
  });

  it('warns when tummy is "soft" + non-stretch + fitted', () => {
    const warnings = predictFit(baseProduct, { ...baseAvatar, tummy: 'soft' });
    expect(warnings.some(w => /tummy|midsection|waistband|stomach|abdomen/i.test(w.message))).toBe(true);
  });

  it('does not add a tummy warning for "flat" tummy', () => {
    const warnings = predictFit(baseProduct, { ...baseAvatar, tummy: 'flat' });
    expect(warnings.some(w => /tummy|midsection|stomach|abdomen/i.test(w.message))).toBe(false);
  });

  it('does not add a tummy warning when tummy field is omitted (legacy avatar)', () => {
    const warnings = predictFit(baseProduct, baseAvatar);
    expect(warnings.some(w => /tummy|midsection|stomach|abdomen/i.test(w.message))).toBe(false);
  });

  it('skips the tummy warning for stretch fabrics even when tummy is "full"', () => {
    const stretchProduct: ProductData = {
      ...baseProduct,
      material: 'cotton spandex',
      tags: ['high-waisted', 'fitted', 'stretch'],
    };
    const warnings = predictFit(stretchProduct, { ...baseAvatar, tummy: 'full' });
    expect(warnings.some(w => /tummy|midsection|stomach|abdomen/i.test(w.message))).toBe(false);
  });

  it('skips the tummy warning for oversized cuts even when tummy is "full"', () => {
    const oversizedProduct: ProductData = {
      ...baseProduct,
      tags: ['oversized', 'relaxed'],
    };
    const warnings = predictFit(oversizedProduct, { ...baseAvatar, tummy: 'full' });
    expect(warnings.some(w => /tummy|midsection|stomach|abdomen/i.test(w.message))).toBe(false);
  });

  it('warns on bodycon dresses for "full" tummy + non-stretch', () => {
    const bodyconDress: ProductData = {
      id: 'p2',
      product_name: 'Bodycon Dress',
      category: 'dress',
      material: 'cotton',
      tags: ['bodycon', 'fitted'],
      description: 'Knee-length bodycon dress.',
    };
    const warnings = predictFit(bodyconDress, { ...baseAvatar, tummy: 'full' });
    expect(warnings.some(w => /tummy|midsection|stomach|abdomen/i.test(w.message))).toBe(true);
  });

  it('keeps existing non-tummy warnings intact for legacy avatars', () => {
    // Sanity check that adding tummy didn't accidentally regress other rules.
    const broadShoulderAvatar: AvatarMeasurements = {
      ...baseAvatar,
      shoulders: 'broad',
    };
    const fittedTop: ProductData = {
      id: 'p3',
      product_name: 'Slim Fit Tee',
      category: 'top',
      material: 'cotton',
      tags: ['slim fit', 'fitted'],
      description: 'Slim fit cotton t-shirt.',
    };
    const warnings = predictFit(fittedTop, broadShoulderAvatar);
    expect(warnings.some(w => /shoulders/i.test(w.message))).toBe(true);
  });
});
