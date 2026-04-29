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
// TAN Nightingale headings exported from Canva Pro (SVG, transparent
// background). Each slot corresponds to one screen-level heading.
// Metro's `react-native-svg-transformer` (wired in metro.config.js)
// compiles the default export as a React.FC<SvgProps>.

import HomeVerseSvg from '../../assets/images/headings/home-verse.svg';
import HistorySvg from '../../assets/images/headings/history.svg';
import ProfileSvg from '../../assets/images/headings/profile.svg';
import BodyProfileSvg from '../../assets/images/headings/body-profile.svg';

// Verdict-label SVGs (great-fit, some-concerns, may-not-fit) were
// retired April 29 2026. Those three slots now route through the
// styled-text fallback path below, rendering in Viaoda Libre via
// `typography.displayMedium` / `headingL`. Slot enum keeps the
// values so existing callsites in FitResultScreen continue to
// compile; the SVG_BY_SLOT registry simply omits them.
type Slot =
  | 'home-verse'     // "paste anything. / we'll tell you / if it fits."
  | 'history'        // "your history"
  | 'profile'        // "profile"
  | 'body-profile'   // "body profile"
  | 'great-fit'      // text-only (was "great fit!" SVG)
  | 'some-concerns'  // text-only (was "some concerns" SVG)
  | 'may-not-fit';   // text-only (was "may not fit well" SVG)

const SVG_BY_SLOT: Partial<Record<Slot, React.FC<{ width?: number; height?: number }>>> = {
  'home-verse': HomeVerseSvg,
  history: HistorySvg,
  profile: ProfileSvg,
  'body-profile': BodyProfileSvg,
};

// ── Per-slot intrinsic aspect ratios (from tightened viewBoxes) ──
// Width is computed at render time as `height * aspect` so the SVG
// scales correctly. These values came from the Canva export's
// content-bounds viewBox; if a new SVG replaces one of these, the
// aspect will need to be re-measured.
const SVG_ASPECTS: Record<Slot, number> = {
  'home-verse': 1.47,
  history: 2.84,
  profile: 1.93,
  'body-profile': 3.39,
  'great-fit': 2.17,
  'some-concerns': 3.51,
  'may-not-fit': 3.23,
};

// ── Size presets ────────────────────────────────────────────────
// Matches the theme's display tokens so SVG replacements + text
// fallbacks line up at the same heights.
type Size = 'display-lg' | 'display-md' | 'heading-xl' | 'heading-l';

const SIZE_CONFIG: Record<Size, { height: number; fallbackStyle: TextStyle }> = {
  'display-lg': { height: 56, fallbackStyle: typography.displayLarge },
  'display-md': { height: 40, fallbackStyle: typography.displayMedium },
  'heading-xl': { height: 32, fallbackStyle: typography.headingXL },
  'heading-l': { height: 26, fallbackStyle: typography.headingL },
};

interface HeadingImageProps {
  slot: Slot;
  fallback: string;
  size?: Size;
  /** Explicit render height in px — overrides `size` when set. */
  height?: number;
  /** Override the fallback colour (dark text → white on dark bg, etc.) */
  color?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Forwarded to the outer View / fallback Text so existing e2e +
   *  component tests can still query the heading by testID. */
  testID?: string;
}

export default function HeadingImage({
  slot,
  fallback,
  size = 'display-md',
  height,
  color = colors.text,
  style,
  textStyle,
  numberOfLines,
  testID,
}: HeadingImageProps) {
  const SvgComponent = SVG_BY_SLOT[slot];
  const config = SIZE_CONFIG[size];
  const renderHeight = height ?? config.height;
  const renderWidth = renderHeight * SVG_ASPECTS[slot];

  // TEMPORARY COMPONENT — retire for v2.
  //
  // This whole SVG-image approach to page headings is a stopgap while
  // the user evaluates licensing for TAN Nightingale. User plans to
  // purchase the font for use beyond page headings (body, labels,
  // marketing site). Once the font is licensed + loaded via
  // expo-font, swap all <HeadingImage> callsites for plain <Text>
  // using the font family and retire this component entirely.
  // See memory/project_font_tan_nightingale.md for the purchase plan.
  //
  // Defensive type-guard (ALATE-15 regression guard).
  //
  // During hot-reload, react-native-svg-transformer can momentarily
  // return a module-ID integer instead of the React component while
  // Metro is mid-transform. React then tries to render `<{number}/>`
  // and throws `Element type is invalid ... got: number`. This only
  // happened in development (Sentry issue ALATE-15, 12 events in one
  // dev session) because prod bundles don't run react-refresh — but
  // since the fallback path already renders perfectly usable text,
  // defending against a non-function SvgComponent is strictly safer
  // and costs nothing at runtime in normal execution.
  const isValidComponent = typeof SvgComponent === 'function' || typeof SvgComponent === 'object';

  if (SvgComponent && isValidComponent) {
    return (
      <View
        style={[styles.wrap, style]}
        accessible
        accessibilityRole="header"
        accessibilityLabel={fallback}
        testID={testID}
      >
        <SvgComponent width={renderWidth} height={renderHeight} />
      </View>
    );
  }

  // Fallback — plain styled text until a file lands. We mirror the
  // accessibilityLabel on the SVG path here so screen readers + the
  // testing-library `getByLabelText` query find the heading
  // identically across both render paths (after the verdict-label
  // SVGs were retired April 29 2026, the FitResult tests rely on
  // `getAllByLabelText('Great Fit!')` matching the text fallback).
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={fallback}
      style={[config.fallbackStyle, { color }, textStyle]}
      numberOfLines={numberOfLines}
      testID={testID}
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
