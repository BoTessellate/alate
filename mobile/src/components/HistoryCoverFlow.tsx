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

import React, { useMemo, useState } from 'react';
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
// Elongated rectangular proportions — portrait-heavy so product images
// (dresses, tops, full-length looks) read as full-body shots without
// aggressive cropping. Aspect ratio ~ 1 : 1.65.
const CARD_W = Math.min(SCREEN_W * 0.62, 260);
const CARD_H = Math.min(CARD_W * 1.65, 430);
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
 *
 *  The STATIC zIndex on the outer slot (driven by React state, not the UI
 *  thread) is what actually wins on Android. Animated zIndex on the inner
 *  transformed view gets clobbered by sibling paint order — which is why
 *  the right neighbour (rendered later in the array) used to climb in
 *  front of the centre card.
 */
function CoverFlowCard({
  entry,
  index,
  activeIndex,
  scrollX,
  onTap,
}: {
  entry: FitHistoryEntry;
  index: number;
  activeIndex: number;
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
    // Seven-point interpolation so the d=±2 card peeks out from behind
    // d=±1, and d=±3 peeks out from behind d=±2 — stacked receding cards,
    // Cover-Flow / Vision Pro style. Inward tilt intensifies with distance
    // (72°–78°) without going fully edge-on (which would invisibly thin
    // the card at the side). At the extremes, Extrapolation.CLAMP freezes
    // further cards at the d=±3 pose so nothing flies off.
    const rotateY = interpolate(
      d,
      [-3, -2, -1, 0, 1, 2, 3],
      [-78, -72, -60, 0, 60, 72, 78],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      d,
      [-3, -2, -1, 0, 1, 2, 3],
      [0.5, 0.62, 0.78, 1, 0.78, 0.62, 0.5],
      Extrapolation.CLAMP
    );
    // Aggressive inward tuck for |d|≥2 so outer cards sit BEHIND-and-just-
    // peeking-past the nearer ones instead of flying off-screen. Left-of-
    // centre (d>0) pulls right; right-of-centre (d<0) pulls left. Values
    // expressed as a fraction of CARD_W (tuned against ITEM_GAP so outer
    // cards overlap with the inner neighbours, not spread).
    const translateX = interpolate(
      d,
      [-3, -2, -1, 0, 1, 2, 3],
      [-CARD_W * 1.2, -CARD_W * 0.7, -CARD_W * 0.12, 0,
        CARD_W * 0.12, CARD_W * 0.7, CARD_W * 1.2],
      Extrapolation.CLAMP
    );
    // Progressive atmospheric fade — distant cards wash into the bg so
    // the centre card gets the visual attention. Paired with the opacity
    // gradient veil (styles.veil below) to simulate depth-of-field.
    const opacity = interpolate(
      Math.abs(d),
      [0, 1, 2, 3],
      [1, 0.88, 0.45, 0.18],
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
        [0, 1, 2, 3],
        [0, 0.05, 0.28, 0.48],
        Extrapolation.CLAMP
      ),
    };
  });

  // Static zIndex on the OUTER slot: centre card is 1000, neighbours drop
  // off steeply. React applies this as a view prop, which Android honours
  // in sibling draw order — unlike animated zIndex, which loses to DOM
  // render order when transforms are involved. We intentionally DON'T set
  // `elevation` here: Fabric rejects inline `elevation` on a non-leaf view
  // that already has transformed/shadowed descendants.
  const slotDistance = Math.abs(index - activeIndex);
  const slotZ = { zIndex: 1000 - slotDistance * 100 };

  // Perspective lives on the static parent wrapper, NOT in the animated
  // transform array. On Android RN, inlining `{ perspective }` alongside
  // `rotateY` silently degenerates to a 2D shear — the Z-axis only stays
  // alive when perspective is mounted a layer up.
  return (
    <View style={[styles.cardSlot, slotZ]}>
      <View style={styles.cardPerspective}>
        <Animated.View style={[styles.cardAnim, animatedStyle]}>
          <TouchableOpacity activeOpacity={0.9} onPress={onTap} style={styles.cardTouch}>
            <CardFace entry={entry} />
          </TouchableOpacity>
          <Animated.View style={[styles.veil, veilStyle]} pointerEvents="none" />
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
  // Local JS copy of the snapped index — drives the static zIndex on each
  // card slot so the centre card wins the paint-order fight on Android.
  const [activeIndex, setActiveIndex] = useState(0);

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

  // Local JS activeIndex drives the slot zIndex, which forces React to
  // re-render all CoverFlowCard siblings whenever it changes. Doing that
  // on every snap-crossing during a rapid scroll stutters the animation.
  // Defer it to momentum-end: the z-order only needs to be right when the
  // card lands. During the glide the animated transform already hides
  // any transient paint-order flicker.
  const onMomentumEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const raw = Math.round(e.nativeEvent.contentOffset.x / ITEM_GAP);
    const snapped = Math.max(0, Math.min(entries.length - 1, raw));
    setActiveIndex(snapped);
  };

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
        onMomentumScrollEnd={onMomentumEnd}
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
            activeIndex={activeIndex}
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
    // Deep drop shadow grounds the card — lifts it off the solid bg and
    // gives the centre card clear depth separation from the receding
    // neighbours. Purple-tinted instead of stock black so the shadow
    // reads as part of the brand palette, not a generic drop.
    shadowColor: '#1a0f28',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 14,
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
