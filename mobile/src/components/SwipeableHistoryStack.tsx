/**
 * SwipeableHistoryStack — Tinder-style card stack for fit history.
 *
 * Renders up to 3 cards stacked vertically. The top card responds to pan
 * gestures — swipe left or right past the threshold to dismiss it and
 * advance to the next entry. The 2nd and 3rd cards peek from behind,
 * scaled down and offset to signal depth.
 *
 * Card content is magazine-lookbook styled:
 * - full-bleed product image as background
 * - oversized serif brand folio in the top-left
 * - bold serif product name at the bottom
 * - bright accent colour block behind the fit-score pill
 *
 * Tap the top card → opens the fit detail screen (same as the old list).
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography, ms, fontFamily, whiteAlpha, textAlpha, primaryAlpha, scrim, hexToRgba } from '../constants/theme';
import { FitHistoryEntry } from '../store/fitHistoryStore';
import { sanitize } from '../utils/sanitize';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Slim elongated rectangle — portrait orientation, slimmer per user feedback.
// 0.68 of screen width keeps it tall & narrow like a magazine cover.
// Height is capped conservatively so the card sits cleanly between the stats
// row above and the clear-history button below without overlap.
const CARD_W = Math.min(SCREEN_W * 0.68, 300);
const CARD_H = Math.min(SCREEN_H * 0.5, 460);
const SWIPE_THRESHOLD = SCREEN_W * 0.22;
const SERIF = Platform.OS === 'ios' ? 'Times New Roman' : 'serif';

interface SwipeableHistoryStackProps {
  entries: FitHistoryEntry[];
  onCardTap: (entry: FitHistoryEntry) => void;
  onCardRemove?: (entry: FitHistoryEntry) => void;
}

const getScoreAccent = (score: 'great' | 'moderate' | 'poor') => {
  switch (score) {
    case 'great':
      return { block: '#d4f5d0', dot: '#2a7a1f', label: 'GREAT FIT' };
    case 'moderate':
      return { block: '#ffe8c2', dot: '#a65d00', label: 'CONCERNS' };
    case 'poor':
      return { block: '#ffd4d4', dot: '#a41818', label: 'POOR FIT' };
  }
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Shared formatter — same symbol map as FitResultScreen (incl. ₹ INR).
import { formatPrice } from '../utils/currency';

/** Non-top card (2nd / 3rd in the stack) — peeks behind the active card. */
function BehindCard({ entry, depth }: { entry: FitHistoryEntry; depth: number }) {
  // depth: 1 = second card, 2 = third card
  const scale = 1 - depth * 0.05;
  const translateY = depth * 10;
  const opacity = 1 - depth * 0.22;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.cardAbs,
        {
          transform: [{ translateY }, { scale }],
          opacity,
          zIndex: -depth,
        },
      ]}
    >
      <CardFace entry={entry} compact />
    </View>
  );
}

/** The visible card content — magazine-lookbook layout. */
function CardFace({ entry, compact = false }: { entry: FitHistoryEntry; compact?: boolean }) {
  const accent = getScoreAccent(entry.fitScore);
  const brand = sanitize(entry.brand) || 'UNKNOWN';
  const name = sanitize(entry.productName) || 'Unknown Product';
  const price = formatPrice(entry.price);

  const inner = (
    <LinearGradient
      colors={[
        scrim.faint,
        scrim.soft,
        scrim.strong,
        scrim.deep,
      ]}
      locations={[0, 0.35, 0.82, 1]}
      style={styles.cardGradient}
    >
      {/* Oversized brand folio — top-left, magazine style */}
      <View style={styles.folio}>
        <Text style={styles.folioBrand} numberOfLines={1}>
          {brand.toUpperCase()}
        </Text>
        {price && <Text style={styles.folioPrice}>{price}</Text>}
      </View>

      {/* Bottom block: bold serif name + score accent block */}
      <View style={styles.bottom}>
        {/* Bright accent colour block behind the pill */}
        <View style={[styles.accentBlock, { backgroundColor: accent.block }]}>
          <View style={[styles.accentDot, { backgroundColor: accent.dot }]} />
          <Text style={[styles.accentLabel, { color: accent.dot }]}>{accent.label}</Text>
          {entry.sizeRecommendation && (
            <>
              <View style={styles.accentDivider} />
              <Text style={[styles.accentLabel, { color: accent.dot }]}>
                SIZE {entry.sizeRecommendation.size}
              </Text>
            </>
          )}
        </View>

        <Text style={styles.productName} numberOfLines={compact ? 1 : 3}>
          {name}
        </Text>

        {!compact && (
          <View style={styles.metaRow}>
            <Text style={styles.metaDate}>{formatDate(entry.checkedAt)}</Text>
            {entry.warnings.length > 0 && (
              <Text style={styles.metaWarning}>
                {entry.warnings.length} concern{entry.warnings.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}
      </View>
    </LinearGradient>
  );

  if (entry.productImage) {
    return (
      <ImageBackground
        source={{ uri: entry.productImage }}
        style={styles.cardInner}
        imageStyle={styles.cardImage}
        resizeMode="cover"
      >
        {inner}
      </ImageBackground>
    );
  }
  return (
    <View style={[styles.cardInner, styles.placeholder]}>
      <Feather
        name="shopping-bag"
        size={64}
        color={whiteAlpha.iconLowest}
        style={styles.placeholderIcon}
      />
      {inner}
    </View>
  );
}

/** The active card — pannable. */
function TopCard({
  entry,
  onSwipedOut,
  onTap,
}: {
  entry: FitHistoryEntry;
  onSwipedOut: () => void;
  onTap: () => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-15, 0, 15],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD * 1.5],
      [1, 0.6],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  // Like / Nope stamp overlays
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      const shouldSwipe = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      if (shouldSwipe) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * SCREEN_W * 1.5, { duration: 260 });
        translateY.value = withTiming(e.translationY, { duration: 260 }, () => {
          runOnJS(onSwipedOut)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 18 });
        translateY.value = withSpring(0, { damping: 18 });
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.cardAbs, animatedStyle]}>
        <TouchableOpacity
          activeOpacity={0.95}
          style={styles.cardTouch}
          onPress={onTap}
        >
          <CardFace entry={entry} />
          <Animated.View style={[styles.stamp, styles.stampRight, likeStyle]}>
            <Text style={styles.stampText}>KEEP</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampLeft, nopeStyle]}>
            <Text style={styles.stampText}>SKIP</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

export default function SwipeableHistoryStack({
  entries,
  onCardTap,
}: SwipeableHistoryStackProps) {
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    setIndex((i) => Math.min(i + 1, entries.length));
  }, [entries.length]);

  const reset = useCallback(() => setIndex(0), []);

  // At end of stack — show a small reset card
  if (index >= entries.length) {
    return (
      <View style={styles.stackRoot}>
        <View style={[styles.cardAbs, styles.endCard]}>
          <Feather name="check-circle" size={48} color={colors.primary} />
          <Text style={styles.endTitle}>You're all caught up</Text>
          <Text style={styles.endSubtitle}>
            {entries.length} fit{entries.length > 1 ? 's' : ''} reviewed
          </Text>
          <TouchableOpacity onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetLabel}>Start over</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render up to 3 cards in stack: index+2 (back), index+1 (middle), index (top)
  const top = entries[index];
  const middle = entries[index + 1];
  const back = entries[index + 2];

  return (
    <View style={styles.stackRoot} testID="history-stack">
      {back && <BehindCard entry={back} depth={2} />}
      {middle && <BehindCard entry={middle} depth={1} />}
      <TopCard
        key={top.id}
        entry={top}
        onSwipedOut={advance}
        onTap={() => onCardTap(top)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stackRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAbs: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  cardTouch: {
    flex: 1,
  },
  cardInner: {
    flex: 1,
    backgroundColor: colors.backgroundTertiary,
  },
  cardImage: {
    borderRadius: borderRadius.xxl,
  },
  cardGradient: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  placeholder: {
    backgroundColor: colors.primaryDark,
  },
  placeholderIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
  },

  // Magazine folio — oversized brand name in top-left
  folio: {
    flexDirection: 'column',
  },
  folioBrand: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  folioPrice: {
    ...typography.labelLarge,
    color: whiteAlpha.textBright,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Bottom block — product name + accent score pill
  bottom: {
    gap: spacing.sm,
  },
  accentBlock: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4, // squarer, magazine-block feel
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  accentLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  accentDivider: {
    width: 1,
    height: 10,
    backgroundColor: primaryAlpha.tintMd,
    marginHorizontal: 2,
  },
  productName: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaDate: {
    ...typography.caption,
    color: whiteAlpha.textSecondary,
    fontWeight: '500',
  },
  metaWarning: {
    ...typography.caption,
    color: '#ffd4a8',
    fontWeight: '600',
  },

  // Like / Skip stamps
  stamp: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 3,
    borderRadius: 6,
  },
  stampRight: {
    right: 24,
    transform: [{ rotate: '-10deg' }],
    borderColor: '#2a7a1f',
    // Same pastel hue as the great-fit accent block (#d4f5d0), pushed
    // to 90% so the stamp reads cleanly over the product photo.
    backgroundColor: hexToRgba('#d4f5d0', 0.9),
  },
  stampLeft: {
    left: 24,
    transform: [{ rotate: '10deg' }],
    borderColor: '#a41818',
    // Same pastel hue as the poor-fit accent block (#ffd4d4), at 90%.
    backgroundColor: hexToRgba('#ffd4d4', 0.9),
  },
  stampText: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // End-of-stack card
  endCard: {
    backgroundColor: whiteAlpha.surfaceSolid,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  endTitle: {
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  endSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resetBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  resetLabel: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
