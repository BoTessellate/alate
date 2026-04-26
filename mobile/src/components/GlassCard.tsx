/**
 * GlassCard — true iOS-grade glassmorphism card.
 *
 * Wraps `expo-blur` BlurView with a frosted overlay tint and hairline border.
 * Use this anywhere a `<View style={[..., glass]}>` was used. The visible
 * frost is provided by the OS-level blur on the layer behind the card, then a
 * very low-opacity white tint adds warmth and a hairline border defines the
 * edge — matching the look of iOS Control Centre / macOS Sonoma sheets.
 *
 * Props:
 * - `intensity`  the BlurView intensity (default 60 — iOS Control Centre is ~50-70)
 * - `tint`       expo-blur tint (default 'light' — works on the lavender bg)
 * - `style`      passes through outer style (border radius, padding, margin etc)
 *
 * NOTE: BlurView clips the inner blur to its own bounds, so the parent style
 *       MUST set the desired `borderRadius` for the corners to round cleanly.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { borderRadius, shadows, whiteAlpha } from '../constants/theme';

export interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'extraLight' | 'systemMaterial' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterialLight' | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight' | 'systemMaterialDark' | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark';
  /** Disable the elevation shadow (use when nested inside another shadowed card) */
  noShadow?: boolean;
  /** Accessibility id forwarded to the outer View for E2E selectors */
  testID?: string;
  accessibilityLabel?: string;
}

export default function GlassCard({
  children,
  style,
  intensity = 60,
  tint = 'light',
  noShadow = false,
  testID,
  accessibilityLabel,
}: GlassCardProps) {
  // On Android, expo-blur quality is lower — bump intensity slightly so the
  // frost reads as glass rather than as a flat translucent rectangle.
  const effectiveIntensity = Platform.OS === 'android' ? Math.min(100, intensity + 20) : intensity;

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.outer, !noShadow && shadows.glass, style]}
    >
      {/* Blur & tint layers are absolute — they don't affect flex flow */}
      <BlurView
        intensity={effectiveIntensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      {/* Frosted white tint over the blur for warmth */}
      <View style={[StyleSheet.absoluteFill, styles.tint]} pointerEvents="none" />
      {/* Hairline highlight border */}
      <View style={[StyleSheet.absoluteFill, styles.border]} pointerEvents="none" />
      {/* Children render directly — they inherit flexDirection/alignItems from the
          caller's `style` on the outer View, so `flexDirection: 'row'` works. */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    // Near-opaque white base — critical for visual uniformity. The 4-stop
    // gradient darkens noticeably from top to bottom of the screen; any
    // transparency here lets the gradient bleed through the card and creates
    // a visible top-light / bottom-purple split within a single tall card.
    // 0.92 keeps it frost-feel (hint of gradient tint) without the 2-tone bug.
    backgroundColor: whiteAlpha.surfaceSolid,
  },
  tint: {
    // Near-zero — the solid outer already gives the frost read.
    backgroundColor: 'transparent',
  },
  border: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    // Hairline edge — keeps card edges crisp on the gradient.
    borderColor: whiteAlpha.borderMid,
  },
});
