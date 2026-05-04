/**
 * Theme typography tests.
 *
 * May 3 2026 PM (partial revert of the May-3 single-typeface trial):
 *   - Page headings (display* + headingXL/L/M) move BACK to Viaoda
 *     Libre per user direction. The display tier carries the brand
 *     voice on the hero verses ("paste anything"), page titles
 *     ("body profile", "profile"), and section titles.
 *   - Body / labels / caption / overline / headingS stay on Marcellus
 *     so the body voice the user has been A/B-ing isn't disturbed.
 *
 * Same single-weight constraint applies to Viaoda Libre — every
 * heading token MUST stay at fontWeight: '400'. See anti-pattern #13
 * for why bumping to 700 silently falls back to Noto Serif Bold on
 * Android. The non-heading tokens render in `Marcellus-Regular`,
 * which is also single-weight; the same constraint applies there too.
 */

import { typography, fontFamily } from '../constants/theme';

const MARCELLUS = 'Marcellus-Regular';
const VIAODA = 'ViaodaLibre-Regular';

describe('theme — heading typography', () => {
  it('exposes the right family on every fontFamily token', () => {
    expect(fontFamily.primary).toBe(MARCELLUS);
    expect(fontFamily.primaryMedium).toBe(MARCELLUS);
    expect(fontFamily.primarySemiBold).toBe(MARCELLUS);
    expect(fontFamily.primaryBold).toBe(MARCELLUS);
    // Display tier flipped back to Viaoda Libre — see file header.
    expect(fontFamily.display).toBe(VIAODA);
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
  // `fontFamily.display` (Viaoda Libre).
  const headingKeys = [
    'displayLarge',
    'displayMedium',
    'headingXL',
    'headingL',
    'headingM',
  ] as const;

  headingKeys.forEach((key) => {
    it(`${key} uses Viaoda Libre (display tier)`, () => {
      expect((typography as any)[key].fontFamily).toBe(VIAODA);
    });

    it(`${key} no longer forces lowercase (April 29 2026: title-case page headings)`, () => {
      expect((typography as any)[key].textTransform).toBeUndefined();
    });

    it(`${key} stays at fontWeight: '400' (Viaoda Libre is single-weight; see anti-pattern #13)`, () => {
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
