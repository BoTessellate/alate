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
import { CURRENCY_SYMBOLS } from '../utils/currency';

interface AffordabilityIconProps {
  price: PriceShape | undefined | null;
  range: PriceRangeShape | null;
  /** Compact mode for narrow chip surfaces (history cards, recent rows). */
  size?: 'sm' | 'md';
  /** Override hue (e.g. white on a dark hero card). */
  color?: string;
  /** Override the warning hue used when overBudget. */
  warningColor?: string;
  /** Override the affordability symbol — defaults to "$" for back-compat
   *  but should be overridden with the user's actual currency symbol so
   *  the chip reads as "£/££/£££" or "₹/₹₹/₹₹₹" instead of always "$".
   *  May 4 2026 user direction: on the History pill, the affordability
   *  chip should reflect the actual currency, not a hardcoded dollar. */
  symbol?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function AffordabilityIcon({
  price,
  range,
  size = 'sm',
  color = colors.textSecondary,
  warningColor = colors.warningDeep,
  symbol,
  style,
  testID,
}: AffordabilityIconProps) {
  const result = computeAffordability(price, range);
  if (!result) return null;

  const fontSize = size === 'sm' ? 11 : 13;
  const padV = size === 'sm' ? 2 : 4;
  const padH = size === 'sm' ? 6 : 8;

  // Resolve the per-chip symbol. Priority:
  //   1. Caller-provided `symbol` prop (explicit override).
  //   2. Symbol of the user's price-range currency (passed via the
  //      computed result's range — falls back to the price's own
  //      currency when the price is in-range and the range exists).
  //   3. "$" (legacy default — kept so callers that don't pass a
  //      symbol render unchanged).
  // Using `range.currency` (not `price.currency`) so the chip always
  // reads in the user's chosen denomination, even on cards where the
  // product was scraped in a different currency (the comparison is
  // currency-strict so this only fires when both match anyway).
  const resolvedSymbol =
    symbol ??
    (range?.currency ? CURRENCY_SYMBOLS[range.currency] : undefined) ??
    '$';
  const symbols = resolvedSymbol.repeat(result.scale);
  const tone = result.overBudget ? warningColor : color;

  // Single-$ chips render as a perfect circle. Earlier minWidth-only
  // attempt left the chip oblong-tall because the labelSmall mixin
  // sets lineHeight: 18, making total height ~22 px while the
  // computed minWidth was ~19 (May 4 2026 PM live test). Forcing both
  // explicit width and height for the single-symbol case sidesteps
  // RN's text-flow sizing entirely and guarantees a circle. For 2-/
  // 3-symbol counts the text intrinsic width exceeds the chip height,
  // so we drop back to natural padding-based sizing — the chip
  // stretches into a horizontal pill, which is the correct shape for
  // "$$" / "$$$".
  const isSingleSymbol = result.scale === 1;
  const chipDim = Math.round(padV * 2 + fontSize + 8); // height ≈ width for circle
  const sizingStyle = isSingleSymbol
    ? { width: chipDim, height: chipDim, paddingVertical: 0, paddingHorizontal: 0 }
    : { paddingVertical: padV, paddingHorizontal: padH };

  return (
    <View
      style={[
        styles.chip,
        sizingStyle,
        { borderColor: result.overBudget ? warningColor : tone },
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
    // Center BOTH axes — required for the single-$ circular variant
    // (where width === height) so the glyph sits dead-centre instead
    // of nudging top-right because of text baseline offset.
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    // Don't spread `typography.labelSmall` — its lineHeight: 18 was
    // pushing the chip total height beyond the square-circle
    // calculation. Specify only what we need.
    fontFamily: typography.labelSmall.fontFamily,
    fontWeight: typography.labelSmall.fontWeight,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
