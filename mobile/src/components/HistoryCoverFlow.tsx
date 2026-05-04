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

import React, { useEffect, useMemo, useRef } from 'react';
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
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography, whiteAlpha, textAlpha, scrim, fontFamily } from '../constants/theme';
import { FitHistoryEntry } from '../store/fitHistoryStore';
import { sanitize } from '../utils/sanitize';
import BrandHeading from './BrandHeading';

const { width: SCREEN_W } = Dimensions.get('window');
// Portrait-heavy product cards. Per Claude Design mockup: cards are
// roughly 47% of the viewport wide. Stretched to a 1:1.85 aspect per
// user direction ("a little more longer") — gives a lookbook-magazine
// feel rather than a square-ish thumbnail.
const CARD_W = Math.min(SCREEN_W * 0.55, 220);
const CARD_H = Math.min(CARD_W * 1.85, 420);
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

// Shared formatter — same symbol map as FitResultScreen (incl. ₹ INR).
import { formatPrice } from '../utils/currency';

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
      colors={[scrim.mid, scrim.zero]}
      locations={[0, 0.42]}
      style={styles.cardGradient}
    >
      <View style={styles.folio}>
        <BrandHeading
          brand={brand}
          height={26}
          color="#fff"
          uppercase
          textStyle={styles.folioBrand}
          testID={`folio-brand-${entry.id}`}
        />
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
        // Was iconLow (0.20). On the placeholder card's primaryDark
        // (#4c4356) background that gave a non-text-UI contrast of
        // ~1.7:1 — fails WCAG 1.4.11 (3:1). Bumped to textSecondary
        // (0.70 white) which clears 5:1+ on the same dark backdrop
        // while keeping the icon's "this is a placeholder, not the
        // hero" tone. May 3 2026 PM contrast pass.
        color={whiteAlpha.textSecondary}
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
  totalCount,
  scrollX,
  onTap,
  onDelete,
}: {
  entry: FitHistoryEntry;
  index: number;
  /** Total number of cards in the deck — needed to detect overscroll
   *  past the last card so the end card can give a subtle "this is
   *  the end" bounce. */
  totalCount: number;
  scrollX: SharedValue<number>;
  onTap: () => void;
  onDelete?: () => void;
}) {
  // Respect the OS-level "reduce motion" preference. When on, the
  // end-of-deck rubber-band stretch is suppressed (the snap is still
  // there — drag past the last card and it won't move; without the
  // bounce the user just feels resistance). Vestibular-disorder users
  // are particularly sensitive to spring-back overshoots, so this is
  // worth the few extra branches. See accessibility-review #8 (May 3
  // 2026 PM).
  const reducedMotion = useReducedMotion();
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
    // End-of-deck rubber-band: when the user drags past the last
    // card's snap point (Android's ScrollView lets you continue
    // scrolling slightly past max during a drag, even with snap), the
    // last card stretches with a small extra translateX + rotateY
    // tilt. This signals "you've reached the end" without a hard wall.
    // Applied only to the LAST card. Returns to neutral when the
    // ScrollView snaps back to the resting position.
    let endBounceTx = 0;
    let endBounceTilt = 0;
    if (index === totalCount - 1 && !reducedMotion) {
      const maxOffset = (totalCount - 1) * ITEM_GAP;
      const overshoot = scrollX.value - maxOffset;
      if (overshoot > 0) {
        // Cap the visible bounce — otherwise dragging far would tilt
        // the card off-screen. ~24px of stretch is plenty to feel.
        const capped = Math.min(overshoot, 60);
        endBounceTx = -capped * 0.4;
        endBounceTilt = -capped * 0.15;
      }
    }
    return {
      transform: [
        { translateX: translateX + endBounceTx },
        { rotateY: `${rotateY + endBounceTilt}deg` },
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
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onTap}
            style={styles.cardTouch}
            accessibilityRole="button"
            accessibilityLabel={`Open fit details for ${sanitize(entry.brand) || 'this product'}, ${sanitize(entry.productName) || 'product'}`}
          >
            <CardFace entry={entry} />
          </TouchableOpacity>
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              activeOpacity={0.75}
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`history-card-delete-${entry.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${sanitize(entry.productName) || 'product'} from history`}
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
  // Ref to the underlying ScrollView so we can programmatically snap
  // back when the entries list shrinks (e.g. user deletes the last
  // card while scrolled to it). Without this, scrollX retains the old
  // offset which lands the viewport on empty space and the detail bar
  // points at a stale index.
  const scrollRef = useRef<Animated.ScrollView>(null);
  const prevLengthRef = useRef(entries.length);

  // Scroll handler mirrors the offset to a SharedValue (UI thread) AND
  // emits the snap index to JS only when the gesture comes to rest —
  // either momentum-end after a flick, or drag-end with no momentum.
  // Per-frame JS callbacks during a swipe were the choppiness source:
  // every snap crossing fired runOnJS → setActiveIndex → FitDetailBar
  // re-render mid-glide, stalling the animation thread for one frame
  // per crossing. Deferring the JS hop to rest gives Vision-Pro / iPod-
  // shuffle smoothness while keeping the bar accurate at the destination.
  const reportActiveIndex = (offsetX: number) => {
    if (!onActiveIndexChange) return;
    const raw = Math.round(offsetX / ITEM_GAP);
    const clamped = Math.max(0, Math.min(entries.length - 1, raw));
    onActiveIndexChange(clamped);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      runOnJS(reportActiveIndex)(e.contentOffset.x);
    },
    onEndDrag: (e) => {
      // Fires when the user lifts the finger. If the gesture had
      // momentum, onMomentumEnd will fire later with the resting
      // offset; this call uses the lift-off offset which is close
      // enough to keep the bar live for short drags.
      runOnJS(reportActiveIndex)(e.contentOffset.x);
    },
  });

  const snapOffsets = useMemo(
    () => entries.map((_, i) => i * ITEM_GAP),
    [entries.length]
  );

  // When the entries list shrinks (typically because the user just
  // deleted a card), the ScrollView's internal offset can land past
  // the new content's max snap point — leaving the viewport on empty
  // space and the detail bar pointing at a stale index. Snap back
  // to the new last index so the second-last card becomes the active
  // one, matching the user's mental model of "the deck collapsed
  // forward".
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const newLen = entries.length;
    prevLengthRef.current = newLen;

    if (newLen >= prevLen) return; // grew or unchanged — no snap needed
    if (newLen === 0) return;       // empty state handled by parent

    const maxValidScrollX = (newLen - 1) * ITEM_GAP;
    if (scrollX.value > maxValidScrollX) {
      // Animated snap so the user perceives the next card sliding into
      // place rather than a hard jump.
      scrollRef.current?.scrollTo({ x: maxValidScrollX, animated: true });
      // Mirror the value to the shared so transforms snap in lockstep
      // (otherwise we'd briefly render at the old offset).
      scrollX.value = maxValidScrollX;
    }
  }, [entries.length, scrollX]);

  return (
    <View style={styles.root} testID="history-coverflow">
      <Animated.ScrollView
        ref={scrollRef}
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
            totalCount={entries.length}
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
    // History deck sits flex-end (cards anchored toward the bottom of
    // the available area) with a paddingBottom that floats them just
    // above the FitDetailBar pill on HistoryScreen. paddingBottom is
    // hand-tuned to ≈ (pill bottom-offset + pill height + small gap),
    // so the deck appears to dock onto the pill like Vision Pro's
    // cover-flow + now-playing bar.
    //
    // Bumped 200 → 240 (May 4 2026) in tandem with the pill's bottom
    // 130 → 155 lift — keeps the gap between deck-bottom and pill-top
    // tight (~15-20 px) and pulls the cards' visual centre slightly
    // higher into the viewport so they read as deliberately framed
    // rather than slumped against the pill.
    justifyContent: 'flex-end',
    paddingBottom: 240,
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
  // Floating trash icon — BOTTOM-right of each card (moved from top-
  // right per user direction). Deep brand-purple tint (colors.text @ 0.55)
  // instead of pure black — stock black rgba read as a grey chip that
  // fought the grey-purple palette. The new fill picks up the brand
  // palette without losing contrast on bright product images.
  deleteBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: textAlpha.tintLg,
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
  // Folio brand — text style overrides applied to the BrandHeading
  // fallback path (the wrap when no SVG is registered for this slug).
  // Critical: NO `fontFamily` or `fontWeight` here — that would stomp
  // BrandHeading's Viaoda Libre + 400 weight and force the brand
  // name into system serif, which is the wrong voice for this
  // surface. Per April 29 2026 user feedback ("SUMMER AWAY rendered
  // as bold sans-serif on the History card") — the fix is to keep
  // visual treatment (size, colour, shadow) here and let BrandHeading
  // own the typeface.
  folioBrand: {
    // Viaoda Libre override (May 3 2026 trial) — brand name on
    // history cards specifically renders in the italic display
    // serif. textStyle overrides BrandHeading's internal
    // fontFamily.display (Marcellus).
    fontFamily: 'ViaodaLibre-Regular',
    fontSize: 22,
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  // Folio price — Viaoda Libre per user direction April 29 2026.
  // Display serif on the digit makes the price read as editorial
  // not utilitarian. Drop fontWeight to 400 (single-weight font;
  // anything else falls back to system serif bold and we lose the
  // display character — same trap as headings, see anti-pattern
  // #12 in project_anti_patterns.md). Slightly larger and tighter
  // letterSpacing for the heavier glyphs.
  folioPrice: {
    fontFamily: fontFamily.display,
    fontSize: 16,
    color: whiteAlpha.textBright,
    fontWeight: '400',
    marginTop: 2,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

});
