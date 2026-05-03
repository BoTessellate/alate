/**
 * BrandHeading — renders a brand name as a TAN Nightingale SVG export
 * if one has been dropped into [assets/images/brands](../../assets/images/brands/),
 * otherwise falls back to the styled DM Serif Display Italic text from
 * the theme.
 *
 * Same loophole as [HeadingImage](./HeadingImage.tsx): TAN Nightingale
 * ships with Canva Pro, and Canva-exported SVGs carry their own use
 * licence under the user's Canva subscription. We never bundle the
 * font file — only static glyph paths in SVG. So no separate font
 * licence is required for the brand-name SVGs we ship.
 *
 * Slug rule:
 *   "ASOS"             → asos
 *   "& Other Stories"  → and-other-stories
 *   "COS"              → cos
 *   "H&M"              → h-and-m
 *
 * Adding a brand:
 *   1. Open Canva, type the brand name in TAN Nightingale Italic lowercase
 *   2. Tight-trim canvas, export SVG transparent bg
 *   3. Drop into `mobile/assets/images/brands/<slug>.svg`
 *   4. Re-bundle — the lookup is dynamic via the registry below
 */

import React from 'react';
import { Text, View, StyleProp, TextStyle, ViewStyle, StyleSheet } from 'react-native';
import { typography, colors, fontFamily } from '../constants/theme';
import { isEnabled } from '../constants/featureFlags';

// Slug → SVG component registry. Add a brand in two steps:
//   1. Drop the Canva-exported SVG at `assets/images/brands/<slug>.svg`
//   2. Add ONE line below: `'<slug>': require('../../assets/images/brands/<slug>.svg').default,`
// (`react-native-svg-transformer` compiles the default export to React.FC<SvgProps>.)
//
// To check the slug for a brand string, use `slugifyBrand('Cos')` → 'cos'.
//
// Empty registry on day one — every brand falls back to DM Serif Display
// Italic text. Add entries lazily as Canva exports get committed.
const BRAND_SVGS: Record<string, React.FC<{ width?: number; height?: number }>> = {
  // First wave (April 29 2026) — Canva/TAN Nightingale exports the
  // user committed to the repo. Slug rule:
  //   "& Other Stories"      → and-other-stories
  //   "COS"                  → cos
  //   "Marks and Spencers"   → marks-and-spencers
  //   "Zara"                 → zara
  // (See `slugifyBrand` below for the canonical transform.)
  'and-other-stories': require('../../assets/images/brands/and-other-stories.svg').default,
  'cos':               require('../../assets/images/brands/cos.svg').default,
  'marks-and-spencers': require('../../assets/images/brands/marks-and-spencers.svg').default,
  'zara':              require('../../assets/images/brands/zara.svg').default,
  // EXAMPLES — uncomment + drop matching file to activate.
  // 'asos':              require('../../assets/images/brands/asos.svg').default,
  // 'h-and-m':           require('../../assets/images/brands/h-and-m.svg').default,
  // 'weekday':           require('../../assets/images/brands/weekday.svg').default,
};

/**
 * Lowercase, replace `&` with `and`, collapse non-alphanumerics to `-`.
 * Stable across UI casing differences ("ASOS" vs "Asos" → "asos").
 */
export function slugifyBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface BrandHeadingProps {
  brand: string;
  /** Render height in px. SVG width scales by intrinsic aspect; fallback text uses fontSize ~= height * 0.72. */
  height?: number;
  /** Override fallback text colour (e.g. white on dark hero bg). */
  color?: string;
  /** Force uppercase fallback (legacy chips / pills look). SVGs are exported as the user typed them in Canva. */
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
}

export default function BrandHeading({
  brand,
  height = 22,
  color = colors.text,
  uppercase = false,
  style,
  textStyle,
  testID,
  numberOfLines = 1,
}: BrandHeadingProps) {
  const slug = slugifyBrand(brand);
  const Svg = BRAND_SVGS[slug];

  // SVG path is the v2 aesthetic upgrade (TAN Nightingale via Canva SVGs).
  // - In `__DEV__` builds: SVGs render whenever a slug is registered, so
  //   you can drop a Canva export into assets/images/brands/ and see the
  //   look on your dev device immediately (validates whether buying the
  //   real TAN font is worth it before committing).
  // - In production builds: gated by `featureFlags.V2` so a committed SVG
  //   asset can't ship to users until the v2 release flips.
  if (Svg && (isEnabled('V2') || __DEV__)) {
    return (
      <View
        accessible
        accessibilityLabel={brand}
        style={[styles.wrap, style]}
        testID={testID}
      >
        <Svg height={height} />
      </View>
    );
  }

  // Fallback — Viaoda Libre via theme tokens. The italic-style display
  // serif we use whenever the SVG path doesn't fire (no slug match, V2
  // off in production, etc.).
  return (
    <Text
      accessibilityLabel={brand}
      numberOfLines={numberOfLines}
      style={[
        typography.headingS,
        {
          fontFamily: fontFamily.display,
          fontSize: Math.round(height * 0.72),
          lineHeight: height,
          letterSpacing: 0.4,
          color,
        },
        textStyle,
      ]}
      testID={testID}
    >
      {uppercase ? brand.toUpperCase() : brand.toLowerCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
});
