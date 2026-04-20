/**
 * HistoryCoverFlow — Vision Pro song-shuffle-style deck for fit history.
 *
 * Horizontal deck where only the centred card is upright and side cards
 * tuck behind it facing inward (toward the centre), like the Vision Pro
 * song-shuffle UI. Perspective 700 + 60° tilt is the combination that
 * reads as 3D on a phone-sized card. Don't loosen perspective without
 * updating project_history_coverflow_geometry memory.
 *
 * Tap the centred card → opens the fit detail screen.
 * onActiveIndexChange → lets a sibling detail bar follow the snap.
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
  useDerivedValue,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  SharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../constants/theme';
import { FitHistoryEntry } from '../store/fitHistoryStore';
import { sanitize } from '../utils/sanitize';

const { width: SCREEN_W } = Dimensions.get('window');
// Square-ish album-cover proportions — iPod Cover Flow used square covers.
const CARD_W = Math.min(SCREEN_W * 0.62, 260);
const CARD_H = Math.min(CARD_W * 1.35, 350);
// Each "snap" step = CARD_W * 0.72 so adjacent cards overlap slightly (like Cover Flow).
const ITEM_GAP = CARD_W * 0.72;
// Side padding centres the ITEM_GAP slot (not the whole card) in the viewport
// so the active card — which gets translateX=0 and sits in the slot centre —
// lands at true screen centre. This also makes the last card reach its snap
// offset (maxScrollX = (N-1)*ITEM_GAP), fixing the "last card stuck at angle"
// bug that happened when SIDE_PAD was based on CARD_W and the scroll couldn't
// travel far enough for the final card to centre.
const SIDE_PAD = (SCREEN_W - ITEM_GAP) / 2;
const SERIF = Platform.OS === 'ios' ? 'Times New Roman' : 'serif';

interface HistoryCoverFlowProps {
  entries: FitHistoryEntry[];
  onCardTap: (entry: FitHistoryEntry) => void;
  /** Fires on every snap change so a sibling detail bar can follow along. */
  onActiveIndexChange?: (index: number) => void;
}

const formatPrice = (price?: { amount: number; currency: string }) => {
  if (!price) return null;
  if (typeof price.amount !== 'number' || !Number.isFinite(price.amount)) return null;
  if (!price.currency) return String(price.amount);
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  return `${symbols[price.currency] || price.currency + ' '}${price.amount}`;
};

/** The card face — product image + top-corner brand/price folio only.
 *  The fit analysis (score, size, product name) lives in the sibling
 *  FitDetailBar so the card stays image-led. */
function CardFace({ entry }: { entry: FitHistoryEntry }) {
  const brand = sanitize(entry.brand) || 'UNKNOWN';
  const price = formatPrice(entry.price);

  // A lighter top-fade keeps the brand/price legible without the heavy
  // bottom darkening the old layout needed to seat the fit badge.
  const inner = (
    <LinearGradient
      colors={['rgba(28,18,42,0.55)', 'rgba(28,18,42,0.0)']}
      locations={[0, 0.42]}
      style={styles.cardGradient}
    >
      <View style={styles.folio}>
        <Text style={styles.folioBrand} numberOfLines={1}>
          {brand.toUpperCase()}
        </Text>
        {price && <Text style={styles.folioPrice}>{price}</Text>}
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
    // expressed in units of ITEM_GAP.
    //   d > 0 : card sits to the LEFT of the centred card (we've scrolled past it)
    //   d = 0 : card is the centred/main card
    //   d < 0 : card sits to the RIGHT of the centred card (still ahead)
    const d = (scrollX.value - index * ITEM_GAP) / ITEM_GAP;
    // Inward tilt — side cards face the centre card (Vision Pro song
    // shuffle reference). A left-of-centre card (d>0) needs to face RIGHT
    // (positive rotateY rotates the card's front toward +X). A right-of-
    // centre card (d<0) needs to face LEFT (negative rotateY).
    const rotateY = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [-70, -60, 0, 60, 70],
      Extrapolation.CLAMP
    );
    const scale = interpolate(d, [-2, 0, 2], [0.78, 1, 0.78], Extrapolation.CLAMP);
    // Tuck neighbours inward so they sit close to the centre card (overlap,
    // not spread). Left-of-centre (d>0) pulls right; right-of-centre (d<0)
    // pulls left — both move toward the centre.
    const translateX = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [-CARD_W * 0.18, -CARD_W * 0.12, 0, CARD_W * 0.12, CARD_W * 0.18],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      Math.abs(d),
      [0, 1, 2.5],
      [1, 0.82, 0.4],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
      // Android composites transformed siblings by draw order, so the
      // centre card must ALSO have a higher elevation to stay on top of
      // the neighbours' tucked-in edges. Big gap between states so
      // neighbours can't climb in front during the tilt transition.
      zIndex: Math.abs(d) < 0.5 ? 100 : 10,
      elevation: Math.abs(d) < 0.5 ? 12 : 2,
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

export default function HistoryCoverFlow({
  entries,
  onCardTap,
  onActiveIndexChange,
}: HistoryCoverFlowProps) {
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Derive the snapped index on the UI thread and surface it to JS only when
  // it changes. Avoids re-rendering the bar on every scroll pixel.
  const activeIndex = useDerivedValue(() => {
    const raw = Math.round(scrollX.value / ITEM_GAP);
    return Math.max(0, Math.min(entries.length - 1, raw));
  });

  // Mirror the UI-thread snapped index to JS only when it changes, so the
  // detail bar re-renders on snap transitions instead of every scroll pixel.
  useAnimatedReaction(
    () => activeIndex.value,
    (curr, prev) => {
      if (curr !== prev && onActiveIndexChange) {
        runOnJS(onActiveIndexChange)(curr);
      }
    },
    [onActiveIndexChange]
  );

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
    // Tighter perspective = stronger foreshortening, so a 60° rotation
    // reads clearly as 3D (not a flat shear). 700 matches the Vision Pro
    // song-shuffle feel on a phone-scale viewport.
    transform: [{ perspective: 700 }],
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

});
