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
import { borderRadius, shadows } from '../constants/theme';

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
      <BlurView
        intensity={effectiveIntensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      {/* Frosted white tint over the blur for warmth */}
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {/* Hairline highlight border */}
      <View style={[StyleSheet.absoluteFill, styles.border]} pointerEvents="none" />
      {/* Content sits above the blur layers */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  tint: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  border: {
    borderRadius: borderRadius.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
