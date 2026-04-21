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
// Portrait-heavy product cards. Per Claude Design mockup: cards are
// roughly 47% of the viewport wide with a 1:1.65 aspect. Smaller than
// the previous 0.62 setting so both neighbours (d=±1 and d=±2) on each
// side have room to sit on-screen without cropping.
const CARD_W = Math.min(SCREEN_W * 0.55, 220);
const CARD_H = Math.min(CARD_W * 1.65, 380);
// Snap step ~ 0.65·CARD_W so adjacent cards overlap enough to read
// as a tight deck (looser gap made the d=±1 card feel detached).
const ITEM_GAP = CARD_W * 0.65;
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
  /** Fires when the user taps the trash icon on a card's top-right corner.
   *  Parent is responsible for confirming + removing from the store. */
  onCardDelete?: (entry: FitHistoryEntry) => void;
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
 *
 *  zIndex is animated on the UI thread on the OUTER slot (not the inner
 *  transformed view). Key distinctions:
 *    - Inner animated view's zIndex gets clobbered by sibling paint order
 *      when transforms are involved — that's why we tried static zIndex.
 *    - Static zIndex only updates on snap-end → paint-order flip happens
 *      AFTER the card arrives, causing a visible "stop, then pop behind"
 *      stutter at the crossover.
 *    - Animated zIndex on the UNTRANSFORMED slot wrapper is respected by
 *      Fabric's sibling draw order and updates on every scroll frame, so
 *      the flip is continuous — the approaching card climbs in front at
 *      the exact midpoint of the crossover.
 */
function CoverFlowCard({
  entry,
  index,
  scrollX,
  onTap,
  onDelete,
}: {
  entry: FitHistoryEntry;
  index: number;
  scrollX: SharedValue<number>;
  onTap: () => void;
  onDelete?: () => void;
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
    // Five-point interpolation per Claude Design mockup — exactly two
    // visible neighbours per side (d=±1 at ~0.88 opacity, d=±2 at
    // ~0.45). Tilts 0 / ±60° / ±72° read as 3D without going fully
    // edge-on. Cards at |d|>2 fade fully (opacity clamps to 0) and are
    // compressed against d=±2 so they don't stack weirdly behind.
    const rotateY = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [-72, -60, 0, 60, 72],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [0.66, 0.82, 1, 0.82, 0.66],
      Extrapolation.CLAMP
    );
    // Inward tuck — tuned so that at CARD_W ≈ 0.55·SCREEN_W, both
    // neighbours on each side sit comfortably on-screen with a visible
    // 3D depth band. Less aggressive than the previous 7-point values
    // (which pushed d=±2 partially off-screen).
    const translateX = interpolate(
      d,
      [-2, -1, 0, 1, 2],
      [-CARD_W * 0.56, -CARD_W * 0.1, 0, CARD_W * 0.1, CARD_W * 0.56],
      Extrapolation.CLAMP
    );
    // Opacity curve matches the design mockup: centre + both neighbours
    // stay legible, anything beyond d=±2 washes out entirely so it
    // doesn't stack up behind the visible deck.
    const opacity = interpolate(
      Math.abs(d),
      [0, 1, 2, 2.8],
      [1, 0.88, 0.45, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
    };
  });

  // Atmospheric haze overlay: an absolutely-positioned veil matching the
  // background colour, whose opacity grows with |d|. Combined with the
  // card's own opacity fade + scale reduction, this pushes side cards
  // visually "into the distance" so the centre card owns the focus.
  const veilStyle = useAnimatedStyle(() => {
    const d = (scrollX.value - index * ITEM_GAP) / ITEM_GAP;
    return {
      opacity: interpolate(
        Math.abs(d),
        [0, 1, 2, 2.8],
        [0, 0.04, 0.22, 0],
        Extrapolation.CLAMP
      ),
    };
  });

  // Animated zIndex on the OUTER slot — updates every frame from scrollX
  // so the paint order transitions smoothly as one card approaches the
  // centre and the previous centre recedes. Linear fall-off with |d|
  // (1000 at centre, -200 per unit distance); the rounding stabilises
  // the integer zIndex value Fabric actually uses. No `elevation` here
  // because Fabric rejects elevation on non-leaf transformed subtrees.
  const slotStyle = useAnimatedStyle(() => {
    const d = (scrollX.value - index * ITEM_GAP) / ITEM_GAP;
    return {
      zIndex: Math.round(1000 - Math.abs(d) * 200),
    };
  });

  // Perspective lives on the static parent wrapper, NOT in the animated
  // transform array. On Android RN, inlining `{ perspective }` alongside
  // `rotateY` silently degenerates to a 2D shear — the Z-axis only stays
  // alive when perspective is mounted a layer up.
  return (
    <Animated.View style={[styles.cardSlot, slotStyle]}>
      <View style={styles.cardPerspective}>
        <Animated.View style={[styles.cardAnim, animatedStyle]}>
          <TouchableOpacity activeOpacity={0.9} onPress={onTap} style={styles.cardTouch}>
            <CardFace entry={entry} />
          </TouchableOpacity>
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              activeOpacity={0.75}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`history-card-delete-${entry.id}`}
            >
              <Feather name="trash-2" size={14} color="#fff" />
            </TouchableOpacity>
          )}
          <Animated.View style={[styles.veil, veilStyle]} pointerEvents="none" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function HistoryCoverFlow({
  entries,
  onCardTap,
  onActiveIndexChange,
  onCardDelete,
}: HistoryCoverFlowProps) {
  const scrollX = useSharedValue(0);

  // Scroll handler just mirrors the offset to a SharedValue. zIndex + all
  // transforms derive from this on the UI thread — no JS state re-renders
  // on scroll, so rapid swipes stay smooth and the paint-order transition
  // is continuous (not a stop-then-pop at momentum-end).
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Derive the snapped index on the UI thread and surface it to JS only when
  // it changes. Avoids re-rendering on every scroll pixel.
  const activeIndexShared = useDerivedValue(() => {
    const raw = Math.round(scrollX.value / ITEM_GAP);
    return Math.max(0, Math.min(entries.length - 1, raw));
  });

  // Live-track the snapped index for the external callback (detail bar)
  // only. Cheap — only the consumer re-renders, not the whole grid.
  useAnimatedReaction(
    () => activeIndexShared.value,
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
        // "fast" ≈ 0.99 — snappy response to rapid swipes. The real smooth-
        // ness fix is NOT a slower deceleration (would feel sluggish); it's
        // deferring the JS activeIndex update to momentum-end (see below),
        // so rapid scrolls don't trigger 15-card re-renders per snap
        // crossing during the glide.
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
            onDelete={onCardDelete ? () => onCardDelete(entry) : undefined}
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
    // Deep drop shadow grounds the card — lifts it off the solid bg and
    // gives the centre card clear depth separation from the receding
    // neighbours. Purple-tinted instead of stock black so the shadow
    // reads as part of the brand palette, not a generic drop.
    shadowColor: '#1a1118',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 14,
  },
  // Floating trash icon on the top-right of each card. Semi-transparent
  // dark pill so it reads on any product image without fighting the
  // card content. Not part of the tappable cardTouch so the tap-to-open
  // gesture still works on the rest of the card.
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Atmospheric haze overlay, placed over each card. Opacity is animated
  // in CoverFlowCard's useAnimatedStyle (veilStyle) so side cards wash
  // toward the background colour as they recede.
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    borderRadius: borderRadius.xxl,
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
