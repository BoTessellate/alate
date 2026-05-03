/**
 * FitDetailBar — dark glass pill that shows the currently-focused card's
 * fit verdict + product name + size recommendation. Mirrors the Vision Pro
 * music-bar reference: translucent dark background, rounded rectangle,
 * compact content bar that sits below the cover-flow deck.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { spacing, borderRadius, typography, fontFamily, primaryAlpha, whiteAlpha } from '../constants/theme';
import { FitHistoryEntry } from '../store/fitHistoryStore';
import { sanitize } from '../utils/sanitize';
import { computeEffectiveFitScore, EffectiveFitScore } from '../utils/effectiveFitScore';
import AffordabilityIcon from './AffordabilityIcon';
import { usePriceRange } from '../store/priceRangeStore';

const scoreMeta = (score: EffectiveFitScore, noteCount: number) => {
  switch (score) {
    case 'great':
      return { dot: '#7de0a0', label: 'GREAT FIT' };
    case 'minor':
      // Same green dot as 'great' — the warning is informational, not
      // a fit concern. The "with a note" / "with notes" suffix tells
      // the user there's something to read on the full FitResult
      // screen. Pluralises off the warnings count so the label agrees
      // with the FitResult verdictSub line and the user doesn't see
      // "WITH A NOTE" alongside "2 notes" elsewhere (May 3 2026 PM
      // user feedback — see FitResultScreen.getScoreConfig).
      return {
        dot: '#7de0a0',
        label: noteCount === 1 ? 'GREAT FIT, WITH A NOTE' : 'GREAT FIT, WITH NOTES',
      };
    case 'moderate':
      return { dot: '#ffc97a', label: 'CONCERNS' };
    case 'poor':
      return { dot: '#ff8a8a', label: 'POOR FIT' };
  }
};

interface Props {
  entry: FitHistoryEntry | null;
}

export default function FitDetailBar({ entry }: Props) {
  const range = usePriceRange();
  if (!entry) return null;

  const meta = scoreMeta(
    computeEffectiveFitScore(entry.warnings, entry.fitScore),
    entry.warnings?.length ?? 0,
  );
  const name = sanitize(entry.productName) || 'Unknown product';
  const size = entry.sizeRecommendation?.size;

  return (
    <View style={styles.wrap} testID="fit-detail-bar">
      <BlurView intensity={30} tint="default" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} pointerEvents="none" />

      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: meta.dot }]} />
        <Text style={styles.label}>{meta.label}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>

      {size && (
        <View style={styles.sizeChip}>
          <Text style={styles.sizeLabel}>SIZE {size}</Text>
        </View>
      )}

      <AffordabilityIcon
        price={entry.price}
        range={range}
        size="sm"
        color="#fff"
        warningColor="#ffc97a"
        style={styles.affordChip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    // Drop shadow so the bar reads as elevated above the deck's reflection.
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    // Medium-shade glass: brand purple at mid opacity. Sits between the
    // light #e4e2e9 canvas and a fully-dark reference bar — reads as a
    // soft tonal pill, not a heavy dark overlay.
    backgroundColor: primaryAlpha.tintXl,
    borderRadius: borderRadius.pill,
  },
  left: {
    // Inner background dropped May 3 2026 — the double-pill nesting
    // (outer wrap pill + inner verdict chip + inner size chip) read
    // as visual clutter. Outer pill alone now carries the bar; the
    // dot + label sit on it directly.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    color: '#fff',
  },
  name: {
    ...typography.body,
    flex: 1,
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    // The name is the Vision-Pro-bar's "song title" slot — a bit quieter
    // than the accent pills so the eye still lands on the fit verdict first.
    opacity: 0.95,
  },
  sizeChip: {
    // Inner background dropped May 3 2026 — see `left` comment.
    paddingLeft: 4,
  },
  sizeLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    color: '#fff',
  },
  affordChip: {
    backgroundColor: whiteAlpha.surfaceStrong,
    borderColor: whiteAlpha.surfaceSoft,
  },
});
