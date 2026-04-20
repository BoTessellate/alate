/**
 * FitDetailBar — dark glass pill that shows the currently-focused card's
 * fit verdict + product name + size recommendation. Mirrors the Vision Pro
 * music-bar reference: translucent dark background, rounded rectangle,
 * compact content bar that sits below the cover-flow deck.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { spacing, borderRadius, typography } from '../constants/theme';
import { FitHistoryEntry } from '../store/fitHistoryStore';
import { sanitize } from '../utils/sanitize';

type Score = FitHistoryEntry['fitScore'];

const scoreMeta = (score: Score) => {
  switch (score) {
    case 'great':
      return { dot: '#7de0a0', label: 'GREAT FIT' };
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
  if (!entry) return null;

  const meta = scoreMeta(entry.fitScore);
  const name = sanitize(entry.productName) || 'Unknown product';
  const size = entry.sizeRecommendation?.size;

  return (
    <View style={styles.wrap} testID="fit-detail-bar">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
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
    // On Android BlurView is a soft stub — the translucent dark tint on top
    // guarantees the dark-glass read regardless of the platform's blur.
    backgroundColor: 'rgba(28, 18, 42, 0.62)',
    borderRadius: borderRadius.pill,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#fff',
  },
  name: {
    ...typography.body,
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    // The name is the Vision-Pro-bar's "song title" slot — a bit quieter
    // than the accent pills so the eye still lands on the fit verdict first.
    opacity: 0.95,
  },
  sizeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sizeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#fff',
  },
});
