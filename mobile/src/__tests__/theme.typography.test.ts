/**
 * Theme typography tests.
 *
 * May 4 2026 late-PM (round 2): Jost retired alongside the
 * already-retired Viaoda Libre — user direction "replace all jost
 * text with marcellus". The app is back to a single-typeface trial:
 *   - Body + display tier all render in Marcellus-Regular.
 *   - Page-title chrome uses TAN Nightingale via the HeadingImage
 *     SVG paths; Marcellus is the styled-text fallback when no SVG
 *     slot is registered.
 *
 * Marcellus is single-weight (Regular only). Heading tokens stay at
 * fontWeight: '400' so Android's typeface resolver doesn't try to
 * synthesise a bold variant that doesn't exist (anti-pattern #13).
 */

import { typography, fontFamily } from '../constants/theme';

const MARCELLUS = 'Marcellus-Regular';

describe('theme — heading typography', () => {
  it('exposes Marcellus on every fontFamily token (single typeface)', () => {
    expect(fontFamily.primary).toBe(MARCELLUS);
    expect(fontFamily.primaryMedium).toBe(MARCELLUS);
    expect(fontFamily.primarySemiBold).toBe(MARCELLUS);
    expect(fontFamily.primaryBold).toBe(MARCELLUS);
    expect(fontFamily.display).toBe(MARCELLUS);
  });

  it('the fontFamily registry keeps the 5-key shape (no extra aliases)', () => {
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

    it(`${key} stays at fontWeight: '400' (Marcellus is single-weight; see anti-pattern #13)`, () => {
      expect((typography as any)[key].fontWeight).toBe('400');
    });
  });

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
