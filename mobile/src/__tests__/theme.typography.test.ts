/**
 * Theme typography tests.
 *
 * May 4 2026 late-PM: Viaoda Libre retired entirely ("replace all VL
 * font with jost please. I'm keeping only jost and tan nightingale").
 *   - Display tier (display* + headingXL/L/M) renders in Jost-Regular.
 *     Page-title chrome uses TAN Nightingale via the HeadingImage SVG
 *     paths; Jost is the styled-text fallback when no SVG slot is
 *     registered.
 *   - Body / labels / caption / overline / headingS stay on Marcellus.
 *
 * Both Jost-Regular and Marcellus-Regular ship as single-weight files.
 * Heading tokens stay at fontWeight: '400' so Android's typeface
 * resolver doesn't try to synthesise a bold variant that doesn't
 * exist (anti-pattern #13).
 */

import { typography, fontFamily } from '../constants/theme';

const MARCELLUS = 'Marcellus-Regular';
const JOST = 'Jost-Regular';

describe('theme — heading typography', () => {
  it('exposes the right family on every fontFamily token', () => {
    expect(fontFamily.primary).toBe(MARCELLUS);
    expect(fontFamily.primaryMedium).toBe(MARCELLUS);
    expect(fontFamily.primarySemiBold).toBe(MARCELLUS);
    expect(fontFamily.primaryBold).toBe(MARCELLUS);
    // Display tier — Jost-Regular as of May 4 2026 late-PM.
    expect(fontFamily.display).toBe(JOST);
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

  // Heading tokens that mix in `headingSerif` and therefore inherit
  // `fontFamily.display` (Jost-Regular).
  const headingKeys = [
    'displayLarge',
    'displayMedium',
    'headingXL',
    'headingL',
    'headingM',
  ] as const;

  headingKeys.forEach((key) => {
    it(`${key} uses Jost (display tier)`, () => {
      expect((typography as any)[key].fontFamily).toBe(JOST);
    });

    it(`${key} no longer forces lowercase (April 29 2026: title-case page headings)`, () => {
      expect((typography as any)[key].textTransform).toBeUndefined();
    });

    it(`${key} stays at fontWeight: '400' (single-weight font; see anti-pattern #13)`, () => {
      expect((typography as any)[key].fontWeight).toBe('400');
    });
  });

  // Body tier — stays in Marcellus.
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
