/**
 * GradientBackground
 *
 * Full-bleed 180° linear gradient that matches the website tonal scale:
 *   #e4e2e9 → #c5c0d2 → #b5afc4 → #9a92ac
 *
 * Use as the outermost element of every screen so the lavender→gray-purple
 * canvas reads consistently across the app. Glass cards and surfaces sit on
 * top of this gradient.
 */
import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/theme';

export interface GradientBackgroundProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override gradient stops if a screen needs a different range */
  colorsOverride?: readonly [string, string, ...string[]];
}

export default function GradientBackground({
  children,
  style,
  colorsOverride,
}: GradientBackgroundProps) {
  const stops = (colorsOverride ?? colors.backgroundGradient) as readonly [
    string,
    string,
    ...string[]
  ];
  return (
    <LinearGradient
      colors={stops}
      // 180° (top → bottom)
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
