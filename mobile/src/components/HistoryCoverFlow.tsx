/**
 * HistoryCoverFlow — iPod-style cover flow for fit history.
 *
 * Horizontal carousel where cards behave like album covers:
 *   - The centered card faces straight (rotateY 0)
 *   - Cards to the left tilt right (rotateY +50°, scaled down, pushed right)
 *   - Cards to the right tilt left (rotateY -50°, scaled down, pushed left)
 *   - Scrolling horizontally rotates cards smoothly in 3D space
 *
 * Tap the centered card → opens the fit detail screen.
 *
 * Implemented with reanimated's scroll handler so the perspective transform
 * follows every frame of the scroll (no jank). Uses a `perspective` transform
 * on each card's wrapper so the rotation reads as 3D depth, not flat skew.
 */

import React, { useMemo } from 'react';
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
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../constants/theme';
import { FitHistoryEntry } from '../store/fitHistoryStore';
import { sanitize } from '../utils/sanitize';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Square-ish album-cover proportions — iPod Cover Flow used square covers.
const CARD_W = Math.min(SCREEN_W * 0.62, 260);
const CARD_H = Math.min(CARD_W * 1.35, 350);
// Each "snap" step = CARD_W * 0.72 so adjacent cards overlap slightly (like Cover Flow).
const ITEM_GAP = CARD_W * 0.72;
// Side padding so the first + last card can centre cleanly.
const SIDE_PAD = (SCREEN_W - CARD_W) / 2;
const SERIF = Platform.OS === 'ios' ? 'Times New Roman' : 'serif';

interface HistoryCoverFlowProps {
  entries: FitHistoryEntry[];
  onCardTap: (entry: FitHistoryEntry) => void;
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

const formatPrice = (price?: { amount: number; currency: string }) => {
  if (!price) return null;
  if (typeof price.amount !== 'number' || !Number.isFinite(price.amount)) return null;
  if (!price.currency) return String(price.amount);
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  return `${symbols[price.currency] || price.currency + ' '}${price.amount}`;
};

/** The card face — magazine-lookbook style overlaid on the product image. */
function CardFace({ entry }: { entry: FitHistoryEntry }) {
  const accent = getScoreAccent(entry.fitScore);
  const brand = sanitize(entry.brand) || 'UNKNOWN';
  const name = sanitize(entry.productName) || 'Unknown Product';
  const price = formatPrice(entry.price);

  const inner = (
    <LinearGradient
      colors={[
        'rgba(28,18,42,0.05)',
        'rgba(28,18,42,0.35)',
        'rgba(28,18,42,0.88)',
        'rgba(28,18,42,0.96)',
      ]}
      locations={[0, 0.35, 0.82, 1]}
      style={styles.cardGradient}
    >
      <View style={styles.folio}>
        <Text style={styles.folioBrand} numberOfLines={1}>
          {brand.toUpperCase()}
        </Text>
        {price && <Text style={styles.folioPrice}>{price}</Text>}
      </View>

      <View style={styles.bottom}>
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
        <Text style={styles.productName} numberOfLines={2}>
          {name}
        </Text>
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
        size={56}
        color="rgba(255,255,255,0.2)"
        style={styles.placeholderIcon}
      />
      {inner}
    </View>
  );
}

/** One card in the cover-flow carousel. Its transform is driven by the
 *  global scroll offset — when the card is at the current snap position it
 *  sits upright; otherwise it tilts away in 3D.
 */
function CoverFlowCard({
  entry,
  index,
  scrollX,
  onTap,
}: {
  entry: FitHistoryEntry;
  index: number;
  scrollX: SharedValue<number>;
  onTap: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    // Distance from this card's snap point to the current scroll offset,
    // expressed in units of ITEM_GAP. 0 = centred, ±1 = neighbour, etc.
    const d = (scrollX.value - index * ITEM_GAP) / ITEM_GAP;
    // Inward tilt — side cards face the centre card (Vision Pro song
    // shuffle / Apple Music style). Left-of-centre: positive rotateY turns
    // the face to the right (toward centre). Right-of-centre: negative.
    const rotateY = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [70, 60, 0, -60, -70],
      Extrapolation.CLAMP
    );
    const scale = interpolate(d, [-2, 0, 2], [0.78, 1, 0.78], Extrapolation.CLAMP);
    // Shift left/right neighbours inward so they tuck behind the centre card,
    // Cover-Flow style (no pure left/right spread).
    const translateX = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [CARD_W * 0.18, CARD_W * 0.12, 0, -CARD_W * 0.12, -CARD_W * 0.18],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      Math.abs(d),
      [0, 1, 2.5],
      [1, 0.9, 0.4],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
      zIndex: Math.round(100 - Math.abs(d) * 10), // centre card on top
    };
  });

  // Perspective lives on the static parent wrapper, NOT in the animated
  // transform array. On Android RN, inlining `{ perspective }` alongside
  // `rotateY` silently degenerates to a 2D shear — the Z-axis only stays
  // alive when perspective is mounted a layer up.
  return (
    <View style={styles.cardSlot}>
      <View style={styles.cardPerspective}>
        <Animated.View style={[styles.cardAnim, animatedStyle]}>
          <TouchableOpacity activeOpacity={0.9} onPress={onTap} style={styles.cardTouch}>
            <CardFace entry={entry} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

export default function HistoryCoverFlow({ entries, onCardTap }: HistoryCoverFlowProps) {
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const snapOffsets = useMemo(
    () => entries.map((_, i) => i * ITEM_GAP),
    [entries.length]
  );

  return (
    <View style={styles.root} testID="history-coverflow">
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD },
        ]}
      >
        {entries.map((entry, i) => (
          <CoverFlowCard
            key={entry.id}
            entry={entry}
            index={i}
            scrollX={scrollX}
            onTap={() => onCardTap(entry)}
          />
        ))}
      </Animated.ScrollView>

      {/* Subtle reflection band at the bottom — iPod Cover Flow had a mirror
          reflection beneath covers. A soft gradient strip is a lighter hint. */}
      <LinearGradient
        colors={[
          'rgba(90, 67, 119, 0.0)',
          'rgba(90, 67, 119, 0.08)',
          'rgba(90, 67, 119, 0.0)',
        ]}
        style={styles.reflection}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    // Match height so cards centre vertically in the scroll area.
    height: CARD_H + spacing.lg * 2,
  },
  cardSlot: {
    // Each card occupies ITEM_GAP of horizontal space so snapping aligns
    // with the interpolation math in CoverFlowCard above.
    width: ITEM_GAP,
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPerspective: {
    width: CARD_W,
    height: CARD_H,
    transform: [{ perspective: 1000 }],
  },
  cardAnim: {
    width: CARD_W,
    height: CARD_H,
  },
  cardTouch: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    ...shadows.lg,
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
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  placeholder: {
    backgroundColor: colors.primaryDark,
  },
  placeholderIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '32%',
  },

  // Folio
  folio: {
    flexDirection: 'column',
  },
  folioBrand: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  folioPrice: {
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Bottom
  bottom: {
    gap: spacing.xs,
  },
  accentBlock: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  accentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  accentLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  accentDivider: {
    width: 1,
    height: 9,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginHorizontal: 2,
  },
  productName: {
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // Reflection strip under the cover row
  reflection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '18%',
    height: 12,
  },
});
