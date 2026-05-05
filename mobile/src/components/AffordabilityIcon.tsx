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

  // ALL three variants ($, $$, $$$) render as the same-size circle.
  // User said the single-$ subtle circle reads well; making 2/3-$
  // variants match means scaling the FONT down so multiple glyphs
  // fit in the same circle (May 5 2026: "I really like the subtle
  // design of the single $ … $$ and $$$ inside a circle instead of
  // an oblong shape"). letterSpacing pulls glyphs tight.
  const chipDim = Math.round(padV * 2 + fontSize + 8); // ~circle dim
  const scaledFontSize =
    result.scale === 1
      ? fontSize        // 1 char — full font size
      : result.scale === 2
      ? Math.round(fontSize * 0.78) // 2 chars — slight shrink so they fit
      : Math.round(fontSize * 0.6); // 3 chars — tighter shrink
  const tightLetterSpacing = result.scale > 1 ? -0.6 : 0;

  return (
    <View
      style={[
        styles.chip,
        { width: chipDim, height: chipDim, paddingVertical: 0, paddingHorizontal: 0 },
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
          {
            fontSize: scaledFontSize,
            letterSpacing: tightLetterSpacing,
            color: tone,
            fontWeight: result.overBudget ? '700' : '600',
          },
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
