/**
 * HeadingImage — swaps a TAN Nightingale SVG export in for the styled
 * text heading if the SVG is present, otherwise falls back to the
 * theme's DM Serif Italic display headings.
 *
 * Usage:
 *   <HeadingImage slot="history" fallback="your history" size="display-md" />
 *
 * To swap in a real heading:
 *   1. Export the text from Canva Pro as SVG with a transparent bg.
 *   2. Drop it into `mobile/assets/images/headings/<slot>.svg`
 *      (e.g. `history.svg`, `profile.svg`, `home-verse.svg`, etc.)
 *   3. Uncomment the matching `require` line in SVG_BY_SLOT below.
 *
 * The wrapper keeps the original text rendered with `accessibilityLabel`
 * + `importantForAccessibility="no-hide-descendants"` equivalent so
 * screen readers still hear the heading even when the visual is an
 * SVG with no text layer.
 */

import React from 'react';
import { Text, StyleProp, TextStyle, View, StyleSheet, ViewStyle } from 'react-native';
import { typography, colors } from '../constants/theme';

// ── Slot → SVG module registry ───────────────────────────────────
// When a heading SVG is exported from Canva, uncomment the matching
// line and import the default export as a React component. Leave
// slots commented out to keep the text fallback.
//
// Example after dropping `history.svg`:
//   import HistorySvg from '../../assets/images/headings/history.svg';
//   const SVG_BY_SLOT = { history: HistorySvg };

type Slot =
  | 'home-verse'     // "paste anything. / we'll tell you / if it fits."
  | 'history'        // "your history"
  | 'profile'        // "profile"
  | 'body-profile'   // "body profile"
  | 'great-fit'      // "Great Fit!"
  | 'some-concerns'  // "Some Concerns"
  | 'may-not-fit';   // "May Not Fit Well"

const SVG_BY_SLOT: Partial<Record<Slot, React.FC<{ width?: number; height?: number }>>> = {
  // home-verse: require('../../assets/images/headings/home-verse.svg').default,
  // history: require('../../assets/images/headings/history.svg').default,
  // profile: require('../../assets/images/headings/profile.svg').default,
  // 'body-profile': require('../../assets/images/headings/body-profile.svg').default,
  // 'great-fit': require('../../assets/images/headings/great-fit.svg').default,
  // 'some-concerns': require('../../assets/images/headings/some-concerns.svg').default,
  // 'may-not-fit': require('../../assets/images/headings/may-not-fit.svg').default,
};

// ── Size presets ────────────────────────────────────────────────
// Matches the theme's display tokens so SVG replacements + text
// fallbacks line up at the same heights.
type Size = 'display-lg' | 'display-md' | 'heading-xl' | 'heading-l';

const SIZE_CONFIG: Record<Size, { height: number; fallbackStyle: TextStyle }> = {
  'display-lg': { height: 56, fallbackStyle: typography.displayLarge },
  'display-md': { height: 44, fallbackStyle: typography.displayMedium },
  'heading-xl': { height: 36, fallbackStyle: typography.headingXL },
  'heading-l': { height: 32, fallbackStyle: typography.headingL },
};

interface HeadingImageProps {
  slot: Slot;
  fallback: string;
  size?: Size;
  /** Override the fallback colour (dark text → white on dark bg, etc.) */
  color?: string;
  /** Width the SVG should render at. Height comes from the size preset. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function HeadingImage({
  slot,
  fallback,
  size = 'display-md',
  color = colors.text,
  width,
  style,
  textStyle,
  numberOfLines,
}: HeadingImageProps) {
  const SvgComponent = SVG_BY_SLOT[slot];
  const config = SIZE_CONFIG[size];

  if (SvgComponent) {
    // SVG path — render the Canva export at the preset height,
    // calculated width if not explicitly set. `accessibilityLabel`
    // keeps the heading readable by screen readers.
    return (
      <View
        style={[styles.wrap, style]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={fallback}
      >
        <SvgComponent
          width={width}
          height={config.height}
        />
      </View>
    );
  }

  // Fallback — plain styled text until a file lands.
  return (
    <Text
      accessibilityRole="header"
      style={[config.fallbackStyle, { color }, textStyle]}
      numberOfLines={numberOfLines}
    >
      {fallback}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
});
