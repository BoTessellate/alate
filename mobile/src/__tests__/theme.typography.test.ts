/**
 * Theme typography tests.
 *
 *   - Display + heading tokens use Viaoda Libre as the live fallback
 *     face (Google Fonts, OFL). TAN Nightingale SVGs replace these at
 *     the screen level when present — see HeadingImage.
 *   - Display + heading tokens render in lowercase.
 *   - Body / label / caption tokens run on the SYSTEM SERIF to pair
 *     with the display serif — the whole app now reads as serif-led.
 *   - DM Serif Display Italic stays loaded as `fontFamily.displayLegacy`
 *     so any caller still hard-coded to it doesn't break, but new
 *     tokens point at Viaoda Libre.
 *
 * These tokens are the single source of truth — if a heading anywhere
 * drifts off them, that's a bug.
 */

import { typography, fontFamily } from '../constants/theme';

describe('theme — heading typography', () => {
  it('exposes Viaoda Libre as the display font family', () => {
    expect(fontFamily.display).toBe('ViaodaLibre-Regular');
  });

  it('keeps DM Serif Display Italic loaded as the legacy fallback', () => {
    expect(fontFamily.displayLegacy).toBe('DMSerifDisplay-Italic');
  });

  const headingKeys = [
    'displayLarge',
    'displayMedium',
    'headingXL',
    'headingL',
    'headingM',
  ] as const;

  headingKeys.forEach((key) => {
    it(`${key} uses Viaoda Libre`, () => {
      expect((typography as any)[key].fontFamily).toBe('ViaodaLibre-Regular');
    });

    it(`${key} renders in lowercase`, () => {
      expect((typography as any)[key].textTransform).toBe('lowercase');
    });
  });

  // Body / label tokens now use the system serif (paired with TAN
  // Nightingale headings) — they should not inherit lowercase.
  const nonHeadingKeys = ['body', 'bodyLarge', 'bodySmall', 'label', 'labelLarge', 'caption'] as const;
  nonHeadingKeys.forEach((key) => {
    it(`${key} is not forced into lowercase`, () => {
      expect((typography as any)[key].textTransform).toBeUndefined();
    });
    it(`${key} uses the system serif (paired with the display serif)`, () => {
      expect((typography as any)[key].fontFamily).toBe('serif');
    });
  });
});
