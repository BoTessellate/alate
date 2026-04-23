/**
 * Theme typography tests — DM Serif Display Italic for headings, lowercase.
 *
 * User picked DM Serif Display (Google Fonts) as a free stand-in for the
 * paid TAN Nightingale that Canva mocks used. Rule:
 *   - Display + heading tokens use the serif display family
 *   - Display + heading tokens render in lowercase
 *   - Body/label/caption stay on the default sans (untouched)
 *
 * These tokens are the single source of truth — if a heading anywhere drifts
 * off them, that's a bug. Keeps typography consistent across screens without
 * every screen having to remember to set fontFamily + textTransform.
 */

import { typography, fontFamily } from '../constants/theme';

describe('theme — heading typography', () => {
  it('exposes DMSerifDisplay-Italic as the display font family', () => {
    expect(fontFamily.display).toBe('DMSerifDisplay-Italic');
  });

  const headingKeys = [
    'displayLarge',
    'displayMedium',
    'headingXL',
    'headingL',
    'headingM',
  ] as const;

  headingKeys.forEach((key) => {
    it(`${key} uses the display serif font`, () => {
      expect((typography as any)[key].fontFamily).toBe('DMSerifDisplay-Italic');
    });

    it(`${key} renders in lowercase`, () => {
      expect((typography as any)[key].textTransform).toBe('lowercase');
    });
  });

  // Body / label tokens should not be touched — they stay on system sans
  const nonHeadingKeys = ['body', 'bodyLarge', 'bodySmall', 'label', 'labelLarge', 'caption'] as const;
  nonHeadingKeys.forEach((key) => {
    it(`${key} is not forced into lowercase`, () => {
      expect((typography as any)[key].textTransform).toBeUndefined();
    });
    it(`${key} does not hard-code the display serif`, () => {
      expect((typography as any)[key].fontFamily).toBeUndefined();
    });
  });
});
