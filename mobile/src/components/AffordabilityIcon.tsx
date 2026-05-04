/**
 * AffordabilityIcon — small `$ / $$ / $$$` chip showing how a product's
 * price sits inside the user's configured budget range. Renders only
 * when the user has set a range AND the price has a comparable currency
 * (see [computeAffordability](../utils/affordability.ts)).
 *
 * `overBudget` (price > range.max) renders 3 dollar signs in the
 * warning hue, so users can spot above-range products at a glance.
 */

import React from 'react';
import { Text, View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { colors, typography, borderRadius } from '../constants/theme';
import {
  computeAffordability,
  PriceRangeShape,
  PriceShape,
} from '../utils/affordability';

interface AffordabilityIconProps {
  price: PriceShape | undefined | null;
  range: PriceRangeShape | null;
  /** Compact mode for narrow chip surfaces (history cards, recent rows). */
  size?: 'sm' | 'md';
  /** Override hue (e.g. white on a dark hero card). */
  color?: string;
  /** Override the warning hue used when overBudget. */
  warningColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function AffordabilityIcon({
  price,
  range,
  size = 'sm',
  color = colors.textSecondary,
  warningColor = colors.warningDeep,
  style,
  testID,
}: AffordabilityIconProps) {
  const result = computeAffordability(price, range);
  if (!result) return null;

  const fontSize = size === 'sm' ? 11 : 13;
  const padV = size === 'sm' ? 2 : 4;
  const padH = size === 'sm' ? 6 : 8;

  const symbols = '$'.repeat(result.scale);
  const tone = result.overBudget ? warningColor : color;

  // Approx chip height: padV*2 + lineHeight (~fontSize * 1.4). Use
  // that as a minWidth so a single-$ chip renders as a circle / soft
  // square rather than an oblong (May 4 2026 user feedback: "single
  // $ shows up in an oblong shaped element"). For 2-/3-$ counts the
  // intrinsic text width exceeds this floor and the chip flexes
  // wider — pill shape preserved.
  const minWidth = Math.round(padV * 2 + fontSize * 1.4);

  return (
    <View
      style={[
        styles.chip,
        {
          paddingVertical: padV,
          paddingHorizontal: padH,
          minWidth,
          borderColor: result.overBudget ? warningColor : tone,
        },
        style,
      ]}
      testID={testID ?? `affordability-${result.scale}${result.overBudget ? '-over' : ''}`}
      accessibilityLabel={
        result.overBudget
          ? `Above your budget — ${symbols}`
          : `Affordability ${symbols}`
      }
    >
      <Text
        style={[
          styles.text,
          { fontSize, color: tone, fontWeight: result.overBudget ? '700' : '600' },
        ]}
      >
        {symbols}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    ...typography.labelSmall,
    letterSpacing: 0.6,
  },
});
