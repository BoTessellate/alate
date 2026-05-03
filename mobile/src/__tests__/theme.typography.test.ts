/**
 * Theme typography tests.
 *
 * May 3 2026 trial: collapse to a SINGLE typeface across the whole
 * app — Marcellus (Google Fonts, OFL). Single-weight serif: every
 * fontFamily token (primary / primaryMedium / primarySemiBold /
 * primaryBold / display) points at the same `Marcellus-Regular`
 * file. The weight-named tokens stay in the registry so call sites
 * don't have to change, but the rendered face is identical;
 * hierarchy comes from size + colour + spacing instead of weight.
 *
 * Revert to the prior DM Sans + Viaoda Libre setup if the uniform
 * weight reads flat.
 */

import { typography, fontFamily } from '../constants/theme';

const MARCELLUS = 'Marcellus-Regular';

describe('theme — heading typography', () => {
  it('exposes Marcellus on every fontFamily token (single typeface trial)', () => {
    expect(fontFamily.primary).toBe(MARCELLUS);
    expect(fontFamily.primaryMedium).toBe(MARCELLUS);
    expect(fontFamily.primarySemiBold).toBe(MARCELLUS);
    expect(fontFamily.primaryBold).toBe(MARCELLUS);
    expect(fontFamily.display).toBe(MARCELLUS);
  });

  it('the fontFamily registry keeps the 5-key shape (no extra aliases)', () => {
    // Token names stay so consumers don't have to change. Only the
    // value moved.
    expect(Object.keys(fontFamily).sort()).toEqual([
      'display',
      'primary',
      'primaryBold',
      'primaryMedium',
      'primarySemiBold',
    ]);
  });

  const headingKeys = [
    'displayLarge',
    'displayMedium',
    'headingXL',
    'headingL',
    'headingM',
  ] as const;

  headingKeys.forEach((key) => {
    it(`${key} uses Marcellus`, () => {
      expect((typography as any)[key].fontFamily).toBe(MARCELLUS);
    });

    it(`${key} no longer forces lowercase (April 29 2026: title-case page headings)`, () => {
      expect((typography as any)[key].textTransform).toBeUndefined();
    });
  });

  // All non-heading tokens render in the same Marcellus file. The
  // weight-named token references stay so callers can express intent.
  const nonHeadingKeys = [
    'body', 'bodyLarge', 'bodySmall', 'caption', 'banner',
    'label', 'labelLarge', 'labelSmall',
    'overline', 'headingS',
  ] as const;
  nonHeadingKeys.forEach((key) => {
    it(`${key} renders in Marcellus`, () => {
      expect((typography as any)[key].fontFamily).toBe(MARCELLUS);
    });
  });
});
