/**
 * Theme typography tests.
 *
 *   - Display + heading tokens use Viaoda Libre (Google Fonts, OFL)
 *     bundled via expo-font; family name resolves on Android only
 *     when set to the ttf's NameID 1 ("Viaoda Libre" with space).
 *   - Body / label / caption tokens run on the SYSTEM SERIF so the
 *     whole app reads as serif-led without bundling a second face.
 *   - The fontFamily registry is intentionally minimal: ONLY
 *     `primary` (system serif) and `display` (Viaoda Libre). No
 *     accent, mono, fallback, or legacy aliases. See anti-pattern
 *     comment in theme.ts.
 *
 * These tokens are the single source of truth — if a heading anywhere
 * drifts off them, that's a bug.
 */

import { typography, fontFamily } from '../constants/theme';

describe('theme — heading typography', () => {
  it('exposes Viaoda Libre as the display font family', () => {
    expect(fontFamily.display).toBe('ViaodaLibre-Regular');
  });

  it('the fontFamily registry exposes ONLY primary + display (no accent/mono/legacy bloat)', () => {
    // Regression guard: April 29 2026 we slimmed the registry to two
    // faces after the user flagged "too many fonts for an app". Don't
    // add a new key without an explicit reason logged in theme.ts.
    expect(Object.keys(fontFamily).sort()).toEqual(['display', 'primary']);
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

    it(`${key} no longer forces lowercase (April 29 2026: title-case page headings)`, () => {
      // Earlier versions forced textTransform: 'lowercase' on every
      // heading token for an editorial feel. The user moved to
      // title-case page titles ("Body Profile", "History", "Profile")
      // so the lowercase transform was dropped — render whatever case
      // the source string supplies.
      expect((typography as any)[key].textTransform).toBeUndefined();
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
