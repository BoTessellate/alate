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

// TAN Nightingale headings — exported from Canva Pro as SVG with the
// font's glyphs already rasterised to <path>s (transparent bg). We
// don't ship the font itself; the SVG IS the font, baked into shapes.
import HomeVerseSvg from '../../assets/images/headings/home-verse.svg';
import HistorySvg from '../../assets/images/headings/history.svg';
import ProfileSvg from '../../assets/images/headings/profile.svg';
import BodyProfileSvg from '../../assets/images/headings/body-profile.svg';
import BeforeWeBeginSvg from '../../assets/images/headings/before-we-begin.svg';

// ── Slot → SVG module registry ───────────────────────────────────
// May 4 2026 — TAN Nightingale SVG path re-enabled per user direction
// ("Bring back Tan Nightingale.. Nothing seems to fit quite like that
// one"). The April 29 banding regression on Android Skia was the
// reason this registry was emptied; re-enabling now pairs with a
// fresh device check. If the banding artefacts return on Pixel 2 XL,
// flip the slots back to undefined here and the styled-text fallback
// (Viaoda Libre via typography.display tokens) takes over again — no
// other code change needed.
//
// The fit-result slots ('great-fit', 'some-concerns', 'may-not-fit')
// stay text-only. Their SVGs were deleted in commit c2c34a5
// (`feat(v2): story-share + gender + tummy + font + ...`); when those
// assets get re-exported they'd plug into the same registry shape.
type Slot =
  | 'home-verse'     // "paste anything. / we'll tell you / if it fits."
  | 'history'        // "your history"
  | 'profile'        // "profile"
  | 'body-profile'   // "body profile"
  | 'before-we-begin' // "Before we begin" — AgeGateOverlay
  | 'great-fit'      // text-only
  | 'some-concerns'  // text-only
  | 'may-not-fit';   // text-only

const SVG_BY_SLOT: Partial<Record<Slot, React.FC<{ width?: number; height?: number }>>> = {
  'home-verse': HomeVerseSvg,
  history: HistorySvg,
  profile: ProfileSvg,
  'body-profile': BodyProfileSvg,
  'before-we-begin': BeforeWeBeginSvg,
};

// ── Per-slot intrinsic aspect ratios (from tightened viewBoxes) ──
// Width is computed at render time as `height * aspect` so the SVG
// scales correctly. These values came from the Canva export's
// content-bounds viewBox; if a new SVG replaces one of these, the
// aspect will need to be re-measured.
const SVG_ASPECTS: Record<Slot, number> = {
  // viewBoxes re-measured May 4 2026 late-PM via svgpathtools' actual
  // path-bbox parser (cubic curves + relative deltas all accounted
  // for). Earlier values came from M-command-start sampling, which
  // missed glyph widths past the start point — that's why home-verse
  // was cropping its right edge ("truncated on the right" + "space
  // left on the left"). The registered aspect MUST equal the SVG's
  // intrinsic aspect because `preserveAspectRatio="xMidYMid meet"`
  // (the default) preserves the SVG's intrinsic ratio when scaling
  // into our render box.
  'home-verse': 369 / 257,        // viewBox "39 84 369 257"
  history: 265 / 74,              // viewBox "107 180 265 74"
  profile: 332 / 118,             // viewBox "55 137 332 118"
  'body-profile': 346 / 93,       // viewBox "54 152 346 93"
  'before-we-begin': 289 / 65,    // viewBox "81 178 289 65"
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
