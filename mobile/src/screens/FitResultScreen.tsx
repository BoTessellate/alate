import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Dimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
// @sbaiahmed1/react-native-blur — Fabric/new-arch-ready Turbo Module.
// Android backend is QmBlurView (com.qmdeve.blurview) which wraps
// RenderEffect (12+) / RenderScript (10–11) / overlay fallback with
// better quality than expo-blur on mid-range Android. iOS path uses
// UIVisualEffectView. We tried @react-native-community/blur first and
// it crashed on Fabric with a NoSuchMethodError (Dimezis v2 signature
// mismatch) — this library avoids that whole class of issue.
import { BlurView } from '@sbaiahmed1/react-native-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, shadows, borderRadius, glass, primaryAlpha, textAlpha, statusAlpha, whiteAlpha, fontFamily } from '../constants/theme';
import { sanitize } from '../utils/sanitize';
import { computeEffectiveFitScore } from '../utils/effectiveFitScore';
// `enrichProduct` import removed — enrichment is paused (2026-05-17);
// see the ENRICH PAUSED comment in the fit-check flow below.
import { checkFit, extractBrandFromUrl, scrapeProduct, ScrapedProduct, FitWarning } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { usePriceRange } from '../store/priceRangeStore';
// AffordabilityIcon retired from this screen May 4 2026 late-PM —
// the affordability indicator is now the BUDGET stat column rendered
// as an SVG arc-ring (see AffordabilityRing below). The icon
// component still ships for the History detail pill.
import { computeAffordability } from '../utils/affordability';
import { CURRENCY_SYMBOLS } from '../utils/currency';
import { useCalibrationStore, averageCalibration } from '../store/calibrationStore';
import FitLoader from '../components/FitLoader';
import FitResultErrorCard from '../components/FitResultErrorCard';
import HeadingImage from '../components/HeadingImage';
import ConfirmDialog from '../components/ConfirmDialog';
import BrandHeading from '../components/BrandHeading';
import { captureError } from '../utils/sentry';
import { formatRelativeTime, displayHostname } from '../utils/relativeTime';
// Currency formatting shared with HistoryCoverFlow so the same symbol
// map (incl. ₹ for INR) drives every price display.
import { formatPrice } from '../utils/currency';
// Tag filtering — strip merchandising noise (sale codes, drops, sizes,
// "best seller" labels, etc.) so users only see tags that describe
// the actual garment (material, colour, fit, occasion, vibe).
import { filterUserFacingTags } from '../utils/tagFilter';
// Last-ditch deterministic derivation when neither Shopify direct
// fetch nor Gemini enrichment surfaced a category / material —
// extracts from URL handle, product title, and tag list. See
// productInference.ts for the keyword tables.
import { inferCategory, inferMaterial } from '../utils/productInference';
// Availability — computed locally from the storefront's
// `availableSizes` list (Shopify direct-fetch surfaces this) + the
// user's recommended size. No separate backend call needed.
import { computeAvailability, describeAvailability, AvailabilityStatus } from '../utils/availability';
// Sample the dominant colour of the underlying product image so the
// hero brand+name can flip to dark text on light photos (white-on-
// white shorts, etc.) and stay white otherwise. May 4 2026 user
// direction: "can you detect if the background is light and make
// product fit screen brand and product name dark on a light
// background and keep it white on the rest?"
import { useImageBrightness } from '../utils/useImageBrightness';

type FitResultRouteProp = RouteProp<RootStackParamList, 'FitResult'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Expanded card occupies 70% of screen with symmetric side + bottom
// padding. Collapsed card docks at the screen bottom (full width, no
// padding, rounded top corners only) and is short enough to show just
// the verdict + price + stats row; fit concerns are hidden at that
// point. The user drags the handle up/down to switch.
const EXPANDED_H = Math.round(SCREEN_H * 0.7);
// Collapsed dock height. Iteratively tuned: 200 → 204 → 210 → 213 →
// 215 → 213 → 232 (May 5 2026 PM, +19 to fit a NEW divider beneath
// statsRow). User direction: "the overlay must be visible from the
// top to 2px below this line" — 'this line' is the new divider
// separating statsRow from the concerns / meta region. Math:
//   handle (8) + verdict header (~60) + divider1 (17) + stats (~64)
//   + divider2 (17) + 2 px buffer = ~168 visible content + dock
//   padding ≈ 232. If on-device the line still gets cut, bump in 2-3
//   px increments — the dock's `overflow: hidden` clips precisely
//   at this constant.
const COLLAPSED_H = 232;
const SIDE_PAD = spacing.lg;
const SWIPE_THRESHOLD = 80; // px of horizontal drag before sift fires

const FILTERED_CATEGORIES = new Set(['general', 'clothing', 'other', 'unknown', '']);

// Single source of truth for the four stat-column icon dimensions.
// Previously the SIZE badge was 44, the donut was 48, the FIT badge
// was 40 — they read as visually inconsistent because they really
// were inconsistent. All four icons now use STAT_ICON_SIZE so the
// row lines up vertically and looks like a coherent set of chips.
const STAT_ICON_SIZE = 44;

export default function FitResultScreen() {
  const route = useRoute<FitResultRouteProp>();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const {
    product: routeProduct,
    url: routeUrl,
    historyEntryId: routeHistoryId,
    precomputed,
    historyEntries,
    currentIndex = 0,
  } = route.params;
  const { avatar } = useAvatarStore();
  const lastChangedAt = useAvatarStore((s) => s.lastChangedAt);
  const { addEntry, updateEntry, removeEntry } = useFitHistoryStore();
  const priceRange = usePriceRange();
  const { garments: calibrationGarments } = useCalibrationStore();

  // When we navigated in from History with a siblings list, the user
  // can sift horizontally AND delete without leaving the screen. The
  // siblings list lives in component state (NOT route params directly)
  // so we can mutate it on delete — filtering the removed entry and
  // clamping the index — without forcing a navigation back.
  const [siblings, setSiblings] = useState(historyEntries ?? []);
  const canSift = siblings.length > 1;
  const [localIndex, setLocalIndex] = useState(currentIndex);
  const activeEntry = siblings.length > 0 ? siblings[Math.min(localIndex, siblings.length - 1)] : null;

  // When no product is passed via route params (HomeScreen URL-paste
  // flow now navigates immediately, before scraping), FitResult runs
  // the scrape itself as the first step of analyzeFit and stores the
  // result here. Three priority order in the derived `product`:
  //   1. activeEntry (history sift mode)
  //   2. routeProduct (history-mode direct nav, share-intent post-scrape)
  //   3. scrapedProduct (live URL-paste flow — set by analyzeFit)
  const [scrapedProduct, setScrapedProduct] = useState<ScrapedProduct | null>(null);

  // Optional inline error card — shown when the internal scrape fails
  // (brand we can't read, network error, blocked origin). Replaces the
  // brand-nudge / blocked-brand UX that used to live on HomeScreen
  // before the loader-flow restructure.
  const [scrapeError, setScrapeError] = useState<{
    kind: 'unsupported' | 'blocked' | 'unknown';
    origin?: string;
    message: string;
  } | null>(null);

  // Effective route-derived values. Either come from the swiped-to entry
  // (history+sift mode) or direct route params (live mode), or the
  // scrape result we ran internally.
  const product: ScrapedProduct | undefined = activeEntry
    ? {
        name: activeEntry.productName,
        image: activeEntry.productImage,
        price: activeEntry.price,
        brand: activeEntry.brand,
        // Carry customFit through the history-mode remap so the
        // lavender pill stays visible when the user re-enters this
        // fit from History (it would otherwise drop on back-nav).
        customFit: activeEntry.customFit,
      }
    : routeProduct ?? scrapedProduct ?? undefined;
  const url = activeEntry ? activeEntry.url : routeUrl;
  // Live-mode fit auto-saves to history once analyzeFit completes.
  // The resulting entry id flips this screen into history mode so
  // the action buttons (Re-evaluate / View on Store / Change
  // measurements) + remove-from-history affordance match what the
  // user sees when sifting in from the History tab. Declared early
  // so the historyEntryId derivation below can fall through to it.
  const [liveSavedHistoryId, setLiveSavedHistoryId] = useState<string | null>(null);
  const historyEntryId = activeEntry
    ? activeEntry.id
    : routeHistoryId ?? liveSavedHistoryId ?? undefined;
  const isHistoryMode =
    !!historyEntryId && (!!activeEntry || !!precomputed || !!liveSavedHistoryId);

  // Lazy state init — from activeEntry when available, else precomputed.
  const [loading, setLoading] = useState(!isHistoryMode);
  const [warnings, setWarnings] = useState<FitWarning[]>(() =>
    activeEntry?.warnings ?? precomputed?.warnings ?? []
  );
  const [fitScore, setFitScore] = useState<'great' | 'moderate' | 'poor'>(() =>
    activeEntry?.fitScore ?? precomputed?.fitScore ?? 'great'
  );
  const [enrichedProduct, setEnrichedProduct] = useState<{
    category?: string;
    material?: string;
    tags?: string[];
  } | null>(() =>
    activeEntry
      ? {
          category: activeEntry.category,
          material: activeEntry.material,
          tags: activeEntry.tags,
        }
      : precomputed?.enrichedProduct ?? null
  );
  const [sizeRec, setSizeRec] = useState<{
    size: string;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  } | null>(() => activeEntry?.sizeRecommendation ?? precomputed?.sizeRecommendation ?? null);
  const [reevaluating, setReevaluating] = useState(false);
  const [reevaluated, setReevaluated] = useState(false);

  // Collapse/expand state + progress. 1 = expanded (default), 0 = collapsed.
  const [isExpanded, setIsExpanded] = useState(true);
  // Themed delete confirmation — replaces native Alert so the modal
  // matches the rest of the grey-purple glass aesthetic.
  const [pendingDelete, setPendingDelete] = useState(false);
  const collapseProgress = useSharedValue(1);
  const startProgress = useSharedValue(1);

  const wentToAvatarSetup = useRef(false);
  const prevAvatarRef = useRef(avatar);

  // Sync local fit-result state whenever the sift index changes. Skip on
  // first mount — the lazy useState initialisers already handled that.
  //
  // Also CLEAR `reevaluating` + `reevaluated` here — the previous card's
  // banner state must not bleed into the new card's view. May 5 2026 user
  // report: "if I scroll too fast or back and forth a lot then
  // 'reevaluating...' gets stuck and starts blinking in and out". Root
  // cause: runReevaluation is async and writes setReevaluating(false) at
  // the end; if the user sifts mid-flight, the now-stale `reevaluating`
  // state stays true on the NEW card, then resolves later → flicker.
  // Clearing on sift breaks the race: any in-flight reeval still runs
  // (and persists its result to the store), but its visible banner is
  // forgotten when the user navigates away.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!activeEntry) return;
    setWarnings(activeEntry.warnings);
    setFitScore(activeEntry.fitScore);
    setSizeRec(activeEntry.sizeRecommendation ?? null);
    setEnrichedProduct({
      category: activeEntry.category,
      material: activeEntry.material,
      tags: activeEntry.tags,
    });
    setReevaluating(false);
    setReevaluated(false);
  }, [localIndex]);

  // Enter animation — the card rises from below and scales up, approximating
  // the history "fit pill" morphing into the full analysis box. Separate
  // from the collapse progress so both can compose on the same view.
  const enterProgress = useSharedValue(0);
  useEffect(() => {
    enterProgress.value = withTiming(1, { duration: 420 });
  }, []);
  const cardEnterStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [
      { translateY: interpolate(enterProgress.value, [0, 1], [80, 0]) },
    ],
  }));

  // Animated layout: height + side + bottom padding + border radii all
  // interpolate off collapseProgress so the card smoothly docks to the
  // screen edge on collapse and lifts back to its 70% floating state on
  // expand.
  const cardLayoutStyle = useAnimatedStyle(() => ({
    height: interpolate(collapseProgress.value, [0, 1], [COLLAPSED_H, EXPANDED_H]),
    // SIDE_PAD - 1 each side: +2 px total overlay width vs. SIDE_PAD
    // alone (May 5 2026 user direction "increase width of the
    // product fit overlay by 2px"). Collapsed value stays at 0
    // (full-bleed dock — unchanged).
    left: interpolate(collapseProgress.value, [0, 1], [0, SIDE_PAD - 1]),
    right: interpolate(collapseProgress.value, [0, 1], [0, SIDE_PAD - 1]),
    bottom: interpolate(
      collapseProgress.value,
      [0, 1],
      // Raised the docked-state bottom from 0 → 2 (May 3 2026 PM
      // user feedback: "raise docked overlay by 2px"). Tiny visual
      // breathing room between the dock's bottom edge and the device
      // screen edge — reads less like the dock is fused to the
      // chrome. Expanded state's bottom is unchanged
      // (insets.bottom + SIDE_PAD) so the floating treatment stays.
      [2, insets.bottom + SIDE_PAD]
    ),
    borderBottomLeftRadius: interpolate(
      collapseProgress.value,
      [0, 1],
      [0, borderRadius.xxxl]
    ),
    borderBottomRightRadius: interpolate(
      collapseProgress.value,
      [0, 1],
      [0, borderRadius.xxxl]
    ),
  }));

  // Animated tint alpha: dock background becomes more translucent
  // when collapsed so the underlying product image breathes through
  // the dock strip ("dock" mode feels pinned to the image; expanded
  // is the analysis card). Iterations:
  //   0.65 → 0.58 → 0.55 → 0.54 expanded (1% increments per user)
  //   collapsed pulls a further ~20% (0.34) so the dock-strip mode
  //   reads as image-first; BlurView keeps legibility for verdict +
  //   stats at that lower alpha.
  //   May 4 2026 late-PM: -2% across the board ("increase translucency
  //   of overlay card by 2%"). Now 0.32 collapsed / 0.52 expanded.
  const cardTintStyle = useAnimatedStyle(() => {
    const alpha = interpolate(collapseProgress.value, [0, 1], [0.32, 0.52]);
    return {
      backgroundColor: `rgba(255, 255, 255, ${alpha})`,
    };
  });

  // Hero brand+name follows the dock as it collapses (May 3 2026 PM).
  // User direction: "on pulling the overlay into a dock, drag the
  // brand name and product name with the overlay and place it right
  // above but in smaller font."
  //
  // At progress=1 (expanded): translateY=0, scale=1 → hero sits at
  //   its anchored top position (closer to dock per May 4 2026
  //   feedback: "bring heading closer to the cards on product fit
  //   card"). Top padding dropped from spacing.xl → spacing.md.
  // At progress=0 (collapsed): hero translates DOWN to a y-position
  //   ~24px above the docked card's top edge, scales to ~70% (lifted
  //   from 0.58 May 4 2026 — user wanted the collapsed name to use
  //   more horizontal width so a longer name ("Regular Drawstring
  //   Shorts in Stripes") reads on a single line instead of being
  //   shrunk + truncated mid-word).
  //
  // The COLLAPSED_H + insets.bottom math anchors the target position
  // to the same coordinates the dock uses (cardLayoutStyle, above).
  // SCREEN_H is computed once at module load — fine because the
  // FitResult screen is full-bleed and doesn't reflow on rotation.
  const heroOriginTop = insets.top + spacing.md;
  const heroDockStyle = useAnimatedStyle(() => {
    // Collapsed: hero base sits ~20px above the dock's top edge.
    //   dockTopWhenCollapsed = SCREEN_H - COLLAPSED_H
    //   (cardLayoutStyle.bottom is 2 when collapsed → use COLLAPSED_H + 2)
    const dockTopCollapsed = SCREEN_H - COLLAPSED_H - 2;
    const targetTopCollapsed = dockTopCollapsed - 60; // ~brand + name + 20px gap
    const translateY = interpolate(
      collapseProgress.value,
      [0, 1],
      [targetTopCollapsed - heroOriginTop, 0]
    );
    const scale = interpolate(collapseProgress.value, [0, 1], [0.7, 1]);
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  // Sample dominant colour of the product image so the hero text +
  // chip backdrop can flip on light photos. MUST be declared before
  // any early-return guard (loading / scrapeError / !product) so the
  // hook count stays stable across renders — regression #1 in
  // project_anti_patterns.md (white-screen on conditional hooks).
  // Hook handles `null` URI by returning `null` brightness, which we
  // treat as "stay white" downstream.
  const heroImageUri =
    activeEntry?.productImage ??
    routeProduct?.image ??
    scrapedProduct?.image ??
    null;
  const heroBrightness = useImageBrightness(heroImageUri);

  // Subtle white-translucent backdrop chip behind brand+name.
  //
  // Iteration history:
  //   v1 (May 3 PM): solid dark fill, only at collapse — looked
  //     disconnected from the dock.
  //   v2 (May 4 late-PM): BlurView + animated tint matching the
  //     dock card. Read too loud, plus a white border on the tint
  //     layer produced a visible outline at collapse ("strange line
  //     showing up when docked").
  //   v3 (May 4 late-PM, current): plain `rgba(255, 255, 255, 0.18)`
  //     fill — quiet enough to NOT compete with the dock, present
  //     enough to lift text legibility on busy product photos.
  //     Padding still animates with collapseProgress; bg alpha is
  //     static (no second animated layer needed).
  const heroChipStyle = useAnimatedStyle(() => {
    const padH = interpolate(collapseProgress.value, [0, 1], [14, 12]);
    const padV = interpolate(collapseProgress.value, [0, 1], [8, 6]);
    return {
      paddingHorizontal: padH,
      paddingVertical: padV,
    };
  });
  // Brand-chip marginBottom: 3 px when docked, 2 px when expanded.
  // Per user direction May 5 2026 "bring the brand name closer by
  // 2px and 1px to the product name in large and docked style
  // respectively" — large = expanded (was 4 → 2, -2 px), docked
  // (was 4 → 3, -1 px).
  const heroChipBrandStyle = useAnimatedStyle(() => {
    // Tightened May 5 2026 PM ("brand and product name must appear
    // slightly tighter (bring brand name closer)"). Was [3, 2]
    // (collapsed=3, expanded=2). Now [2, 1] — both down 1 px.
    const m = interpolate(collapseProgress.value, [0, 1], [2, 1]);
    return { marginBottom: m };
  });

  // Factory: every drag-target on the overlay (top header, tags region)
  // gets its own Pan instance built from the same recipe so they all
  // toggle the dock with identical thresholds + easing. Pulled into a
  // function because RNGH's `Gesture.Pan()` instance can only be bound
  // to ONE GestureDetector — we need two (one for the headerArea, one
  // for the tags View further down the dock).
  //
  // `activeOffsetY([-10, 10])` means small nudges still go to the
  // inner ScrollView; only deliberate vertical swipes trigger the
  // collapse. 300px of drag = full transition.
  //
  // Latency note: previously `setIsExpanded(true)` was deferred until
  // the withTiming completion callback. That added a ~280ms gap
  // between the user lifting their finger and the analysis content
  // (concerns, banners, tags, actions, attribution) appearing — felt
  // like "the data is loading". Now we flip the React state right
  // after committing on the expand path, so content mounts in
  // parallel with the height animation. The collapse path keeps the
  // deferred flip so content doesn't unmount mid-shrink.
  const makeCollapseGesture = () =>
    Gesture.Pan()
      .activeOffsetY([-10, 10])
      .onBegin(() => {
        startProgress.value = collapseProgress.value;
      })
      .onUpdate((e) => {
        const delta = -e.translationY / 300;
        collapseProgress.value = Math.max(
          0,
          Math.min(1, startProgress.value + delta)
        );
      })
      .onEnd(() => {
        const target = collapseProgress.value > 0.5 ? 1 : 0;
        // Expand path: mount content immediately so React's render +
        // layout passes overlap with the dock height animation.
        if (target === 1) {
          runOnJS(setIsExpanded)(true);
        }
        // Switched from withSpring to withTiming + cubic ease — user
        // flagged the spring bounce as "still too much, very very
        // subtle". A timing curve has zero overshoot by definition;
        // the 280ms cubic-out duration keeps the dock change feeling
        // responsive without ANY perceptible bounce.
        collapseProgress.value = withTiming(
          target,
          { duration: 280, easing: Easing.out(Easing.cubic) },
          (finished) => {
            // Collapse path: defer the unmount until the dock has
            // finished shrinking, so content doesn't reflow as it
            // disappears.
            if (finished && target === 0) {
              runOnJS(setIsExpanded)(false);
            }
          }
        );
      });

  const dragGesture = makeCollapseGesture();
  // Second drag target — wraps the tags chip row inside the
  // ScrollView. Same recipe as `dragGesture` so the user gets the
  // identical "10px deliberate vertical swipe" feel from both ends of
  // the dock (top header + tags region near the bottom of the
  // analysis content). Per user feedback: "make the overlay
  // collapsible from around the tags region of the overlay".
  const tagsDragGesture = makeCollapseGesture();

  // Horizontal drag sifts to the next/prev entry. HOISTED to the root
  // view (below) so it works regardless of where the card is — key for
  // the collapsed state, where the card only occupies the bottom 200px
  // and users instinctively swipe at mid-screen (i.e. OVER the product
  // image, not the dock).
  //
  //   - `activeOffsetX([-25, 25])`: bumped from 15 → 25 so vertical
  //     scroll inside the ScrollView wins more decisively. Users were
  //     reporting "scroll feels wonky" — root cause was sift competing
  //     with ScrollView for ownership during the first ~15px of
  //     ambiguous motion.
  //   - `failOffsetY([-10, 10])`: tightened from 25 → 10 so any clear
  //     vertical movement immediately yields to scroll. Combined with
  //     the activeOffsetX bump, vertical scroll has unambiguous priority
  //     over diagonal-leaning swipes.
  // The onEnd guard (`entriesLen > 0`) handles the non-sift case without
  // needing `.enabled(canSift)`.
  const swipeX = useSharedValue(0);
  const siftGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      swipeX.value = e.translationX * 0.4;
    })
    .onEnd((e) => {
      const entriesLen = siblings.length;
      if (e.translationX < -SWIPE_THRESHOLD && localIndex < entriesLen - 1) {
        runOnJS(setLocalIndex)(localIndex + 1);
      } else if (e.translationX > SWIPE_THRESHOLD && localIndex > 0) {
        runOnJS(setLocalIndex)(localIndex - 1);
      }
      // Same bounce-free treatment as the dock collapse. A 200ms
      // ease-out brings the card back to centre cleanly without the
      // subtle overshoot a spring would produce.
      swipeX.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    });

  const siftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  // Stale-check: if the user has changed their avatar AFTER the entry's
  // last `checkedAt`, the displayed verdict is from an older body and
  // must be re-evaluated. This catches the case where the avatar was
  // edited via a path that didn't pass through this screen's "Change
  // measurements" button (Profile tab → Edit, etc.) — the explicit
  // `wentToAvatarSetup.current` flag below misses those paths, but a
  // timestamp comparison doesn't.
  const isStale =
    !!lastChangedAt &&
    !!activeEntry?.checkedAt &&
    new Date(activeEntry.checkedAt).getTime() <
      new Date(lastChangedAt).getTime();

  // Mirror `reevaluating` into a ref so useFocusEffect's callback can
  // read it without being part of the dep array. Including
  // `reevaluating` in deps caused the callback to re-create on every
  // toggle, which under react-navigation's useFocusEffect re-runs the
  // effect → re-fires runReevaluation → toggle again → loop.
  // Stronger blink than the prior sift-only flicker (May 5 2026 user
  // report: "Reevaluate blinking has become stronger on this build.
  // Loading state of the button and banner flashes in and out of
  // animation"). Ref break + smaller dep set fixes the loop.
  const reevaluatingRef = useRef(false);
  useEffect(() => {
    reevaluatingRef.current = reevaluating;
  }, [reevaluating]);

  useFocusEffect(
    useCallback(() => {
      const cameBackFromAvatarSetup =
        wentToAvatarSetup.current && avatar !== prevAvatarRef.current;

      if (cameBackFromAvatarSetup || isStale) {
        prevAvatarRef.current = avatar;
        wentToAvatarSetup.current = false;
        if (!reevaluatingRef.current && (activeEntry?.id || historyEntryId)) {
          runReevaluation();
        }
      }
      // `lastChangedAt` deliberately included — when a user edits the
      // avatar in another tab, returning to this screen sees the new
      // timestamp and triggers stale-reeval without needing a button.
    }, [avatar, lastChangedAt, isStale, historyEntryId, activeEntry?.id])
  );

  useEffect(() => {
    if (!isHistoryMode) {
      analyzeFit();
    }
  }, []);

  const analyzeFit = async () => {
    if (!avatar) return;

    try {
      // Step 0 — internal scrape (only when HomeScreen passed URL only).
      // The unified single-loader flow has FitResult run scrape +
      // enrich + fit-check under one FitLoader instead of HomeScreen
      // running scrape under its own loader and then handing off.
      let workingProduct: ScrapedProduct | undefined = product;
      if (!workingProduct?.name) {
        if (!routeUrl) {
          // Should never happen — the navigator type requires `url`.
          setLoading(false);
          return;
        }
        try {
          const scrapeResult = await scrapeProduct(routeUrl);
          if (scrapeResult.blocked) {
            setScrapeError({
              kind: 'blocked',
              origin: scrapeResult.blockedOrigin,
              message:
                scrapeResult.blockedMessage ||
                'This brand has asked not to be scraped. Please visit their store directly.',
            });
            setLoading(false);
            return;
          }
          if (!scrapeResult.success || !scrapeResult.data) {
            setScrapeError({
              kind: 'unsupported',
              message: 'Unable to fetch product details. The brand may not be supported yet.',
            });
            setLoading(false);
            return;
          }
          setScrapedProduct(scrapeResult.data);
          workingProduct = scrapeResult.data;
        } catch (scrapeErr) {
          captureError(scrapeErr, { feature: 'fit-result-internal-scrape', url: routeUrl });
          setScrapeError({
            kind: 'unknown',
            message: 'Something went wrong. Please try again.',
          });
          setLoading(false);
          return;
        }
      }

      let enrichedData: { id?: string; name?: string; category?: string; material?: string; tags?: string[] } | null = null;

      // Fast path — the scrape result came with structured data
      // (Shopify direct-fetch returns category / tags / material from
      // the storefront's own JSON). Skip Claude enrichment entirely
      // when all three are present; otherwise fall through and ask
      // Claude to fill the gaps.
      const hasShopifyStructured =
        !!workingProduct.category && Array.isArray(workingProduct.tags) && workingProduct.tags.length > 0;
      if (hasShopifyStructured) {
        enrichedData = {
          name: workingProduct.name,
          category: workingProduct.category,
          material: workingProduct.material,
          tags: workingProduct.tags,
        };
        setEnrichedProduct({
          category: workingProduct.category,
          material: workingProduct.material,
          tags: workingProduct.tags,
        });
      } else {
        // ENRICH PAUSED — 2026-05-17, user direction. The Claude-based
        // enrichment that filled category / material / tags for
        // non-Shopify-structured scrapes is paused to cut AI cost.
        // `enrichedData` stays null here, so the checkFit call below
        // falls back to a generic `category: 'clothing'` with no
        // material/tag-aware warnings. The backend
        // /api/ai?action=enrich endpoint is also short-circuited — see
        // backend/api/ai.ts (ENRICH_PAUSED). To resume: restore the
        // enrichProduct call here, re-add `enrichProduct` to the import
        // from '../services/api', and flip ENRICH_PAUSED in the backend.
      }

      const calibration = averageCalibration(calibrationGarments);
      const fitResult = await checkFit(
        {
          id: enrichedData?.id || 'temp',
          product_name: enrichedData?.name || workingProduct.name || 'Unknown Product',
          category: enrichedData?.category || 'clothing',
          material: enrichedData?.material,
          tags: enrichedData?.tags,
          description: workingProduct.description,
        },
        avatar,
        calibration ?? undefined,
        calibrationGarments.length
      );

      if (fitResult.success) {
        setWarnings(fitResult.warnings || []);
        setFitScore(fitResult.fit_score || 'great');
        setSizeRec(fitResult.size_recommendation ?? null);

        const brandInfo = extractBrandFromUrl(url);
        const safeBrand = sanitize(workingProduct.brand) || brandInfo?.brandName;
        const safeName = sanitize(workingProduct.name) || 'Unknown';

        // Availability snapshot at the time of fit-check. Persisted
        // on the history entry so opening this card later shows the
        // same answer without a refetch (prices + stock can drift
        // between visits).
        const availabilitySnapshot = computeAvailability(
          fitResult.size_recommendation?.size,
          workingProduct.availableSizes
        );

        const savedId = addEntry({
          url,
          productName: safeName,
          productImage: workingProduct.image,
          fitScore: fitResult.fit_score || 'great',
          warnings: fitResult.warnings || [],
          checkedAt: new Date().toISOString(),
          sizeRecommendation: fitResult.size_recommendation
            ? {
                size: fitResult.size_recommendation.size,
                confidence: fitResult.size_recommendation.confidence,
                note: fitResult.size_recommendation.note,
              }
            : undefined,
          category: enrichedData?.category,
          material: enrichedData?.material,
          tags: enrichedData?.tags,
          price: workingProduct.price
            ? { amount: workingProduct.price.amount, currency: workingProduct.price.currency }
            : undefined,
          brand: safeBrand,
          availability: availabilitySnapshot,
          // Persist made-to-measure / custom-fit signal so the
          // lavender pill stays visible the next time the user opens
          // this fit from History.
          customFit: workingProduct.customFit,
        });
        setLiveSavedHistoryId(savedId);
      }
    } catch (error) {
      console.error('Fit analysis failed:', error);
      captureError(error, { feature: 'fit-analysis', productName: product?.name, url });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Re-evaluate the current fit in-place. Re-scrapes the product URL
   * (so price / availability / category / tags refresh against
   * whatever the storefront says today) and re-runs checkFit against
   * the user's current avatar. Stays on FitResultScreen.
   *
   * Two ways this gets triggered:
   *   1. Direct user tap on "Re-evaluate" — this function runs.
   *   2. User taps "Change your measurements", edits in AvatarSetup,
   *      navigates back. The useFocusEffect detects an avatar change
   *      and calls this same function — same code path, same UX.
   *
   * On scrape failure we keep the existing product data and only
   * re-run checkFit. The user's intent ("did this still fit?") is
   * preserved even if the storefront briefly 503'd.
   */
  const runReevaluation = async () => {
    // Target the CURRENTLY-VISIBLE card, not the route's entry —
    // when the user has sifted to a sibling, runReevaluation should
    // refresh THAT card, not the original. Was causing two bugs
    // before May 5 2026:
    //   1. Re-eval ran scrape against the route URL (always card-A)
    //      but the user was looking at card-B → wrong product.
    //   2. updateEntry wrote back to historyEntryId (card-A's id),
    //      so card-B's `checkedAt` never refreshed → isStale stayed
    //      true → useFocusEffect kept re-firing → blinking banner.
    const targetId = activeEntry?.id || historyEntryId;
    const targetUrl = activeEntry?.url || url;
    if (!avatar || !targetId) return;
    setReevaluating(true);
    try {
      // Step 1 — refresh product data from the URL. Price + sizes +
      // category/tags can drift between visits (sale ends, item goes
      // out of stock in your size, merchant retags). This is exactly
      // what users want when they tap Re-evaluate. If the scrape fails
      // we silently fall through to the cached data.
      let workingProduct = product;
      const enrichedFromScrape: { category?: string; material?: string; tags?: string[] } = {};
      if (targetUrl) {
        try {
          const scrapeResult = await scrapeProduct(targetUrl);
          if (scrapeResult.success && scrapeResult.data) {
            workingProduct = scrapeResult.data;
            // Surface the freshly-scraped product to the rest of the
            // screen (price pill, hero image, availability stat) so
            // the user sees the update immediately.
            setScrapedProduct(scrapeResult.data);
            // Refresh enriched fields too if Shopify direct-fetch
            // returned them (storefronts often retag items between
            // visits).
            if (scrapeResult.data.category) enrichedFromScrape.category = scrapeResult.data.category;
            if (scrapeResult.data.material) enrichedFromScrape.material = scrapeResult.data.material;
            if (Array.isArray(scrapeResult.data.tags)) enrichedFromScrape.tags = scrapeResult.data.tags;
            if (Object.keys(enrichedFromScrape).length > 0) {
              setEnrichedProduct((prev) => ({ ...prev, ...enrichedFromScrape }));
            }
          }
        } catch {
          // Silent — fall through to checkFit with cached data.
        }
      }

      // Step 2 — re-run fit check with the freshest product + the
      // current avatar.
      const calibration = averageCalibration(calibrationGarments);
      const fitResult = await checkFit(
        {
          id: targetId,
          product_name: workingProduct?.name || 'Unknown',
          category:
            enrichedFromScrape.category ||
            enrichedProduct?.category ||
            precomputed?.enrichedProduct?.category ||
            'clothing',
          material:
            enrichedFromScrape.material ||
            enrichedProduct?.material ||
            precomputed?.enrichedProduct?.material,
          tags:
            enrichedFromScrape.tags ||
            enrichedProduct?.tags ||
            precomputed?.enrichedProduct?.tags,
        },
        avatar,
        calibration ?? undefined,
        calibrationGarments.length
      );
      if (fitResult.success) {
        const newWarnings = fitResult.warnings || [];
        const newScore = fitResult.fit_score || 'great';
        const newSizeRec = fitResult.size_recommendation ?? null;
        setWarnings(newWarnings);
        setFitScore(newScore);
        setSizeRec(newSizeRec);
        setReevaluated(true);

        // Persist the refreshed snapshot to the history entry so
        // re-opening this card later shows the same updated values.
        // Brand is sanitised here too — yamayoga.in (and any other
        // store with HTML in `vendor`) ships markup that the new
        // sanitize() strip-flow cleans. Without including `brand`
        // in this patch, the Home Recents pill kept showing the
        // stale (unsanitised) brand even after a successful re-eval
        // on the History coverflow path. (April 29 2026 fix.)
        const refreshedBrand = sanitize(workingProduct?.brand);
        updateEntry(targetId, {
          warnings: newWarnings,
          fitScore: newScore,
          sizeRecommendation: newSizeRec
            ? { size: newSizeRec.size, confidence: newSizeRec.confidence, note: newSizeRec.note }
            : undefined,
          // Refresh price + image if the scrape returned them — keeps
          // the History tab's coverflow card in sync with the dock.
          ...(workingProduct?.price ? { price: workingProduct.price } : {}),
          ...(workingProduct?.image ? { productImage: workingProduct.image } : {}),
          ...(refreshedBrand ? { brand: refreshedBrand } : {}),
          ...(enrichedFromScrape.category ? { category: enrichedFromScrape.category } : {}),
          ...(enrichedFromScrape.material ? { material: enrichedFromScrape.material } : {}),
          ...(enrichedFromScrape.tags ? { tags: enrichedFromScrape.tags } : {}),
          checkedAt: new Date().toISOString(),
        });

        // Also sync the local `siblings` array. siblings was
        // initialised from the historyEntries route param at mount
        // and isn't subscribed to the store, so without this the
        // sift-away-and-back path would re-populate fitScore /
        // warnings / sizeRec from the STALE entry in siblings.
        // Read the just-updated entry back from the store and swap
        // it into the local list. Keeps the user's "I changed my
        // measurements, hit Re-evaluate, then sifted to another
        // card and back" journey consistent (April 29 2026
        // regression fix).
        const refreshed = useFitHistoryStore
          .getState()
          .entries.find((e) => e.id === targetId);
        if (refreshed) {
          setSiblings((prev) =>
            prev.map((s) => (s.id === targetId ? refreshed : s))
          );
        }
      }
    } catch {
      // silently fail — keep showing original result
    } finally {
      setReevaluating(false);
    }
  };

  const openProductPage = () => {
    Linking.openURL(url);
  };

  // Re-tiered fit verdict — see `utils/effectiveFitScore.ts` for the
  // full rationale. Same logic now drives the FitDetailBar (cover-flow
  // detail pill) + HomeScreen RecentCard so a "Great Fit, with a
  // note" doesn't render as "Concerns" in those views.
  const effectiveScore = computeEffectiveFitScore(warnings, fitScore);

  const getScoreConfig = () => {
    // Use the *Deep text variants per Claude Design — the verdict label
    // reads as hero text on a white-tinted glass card, so it needs more
    // ink than the mid-saturation `success/warning/error` (which are
    // tuned for chip backgrounds). Same hue family, darker shade.
    switch (effectiveScore) {
      case 'great':
        return {
          color: colors.successDeep,
          icon: '✓',
          text: 'Great Fit!',
        };
      case 'minor':
        // Same icon + colour as 'great' — a minor note isn't a fit
        // warning, it's a sizing tip. The note itself appears below
        // in the FIT CONCERNS section. Copy pluralises off the
        // warnings count so the verdict line agrees with the
        // sub-line ("Great Fit, with a note" + "1 note" /
        // "Great Fit, with notes" + "2 notes"). The mismatch was a
        // user-flagged regression on May 3 2026 PM ("it says, 'great
        // fit with a note' but right under it says, '2 notes'").
        return {
          color: colors.successDeep,
          icon: '✓',
          text: warnings.length === 1 ? 'Great Fit, with a note' : 'Great Fit, with notes',
        };
      case 'moderate':
        return {
          color: colors.warningDeep,
          icon: '⚠',
          text: 'Some Concerns',
        };
      case 'poor':
        return {
          color: colors.errorDeep,
          icon: '✕',
          text: 'May Not Fit Well',
        };
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'major':
        return { color: colors.error, label: 'Major' };
      case 'moderate':
        return { color: colors.warning, label: 'Moderate' };
      default:
        return { color: colors.info, label: 'Minor' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <FitLoader url={routeUrl} />
      </View>
    );
  }

  // Internal-scrape failure path — shown when the URL-paste flow hits
  // an unsupported brand, a blocked origin, or a network error. The
  // FitResultErrorCard mirrors FitLoader's structure (URL pill + hero
  // orb + headline + body + CTAs) so the transition reads as one
  // screen resolving rather than two different states. For
  // kind='unsupported' the card POSTs to /api/brand-request as a
  // demand signal — see BACKLOG.md "Demand capture v1" for the
  // architecture decision (no email goes out to the brand).
  if (scrapeError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <FitResultErrorCard
          url={routeUrl}
          scrapeError={scrapeError}
          onGoBack={() => navigation.goBack()}
        />
      </View>
    );
  }

  // Defensive guard — if we somehow reached here without a product
  // (loading=false, no scrape error, but no product), bail out so the
  // render below can safely treat product as defined.
  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <FitLoader url={routeUrl} />
      </View>
    );
  }

  const scoreConfig = getScoreConfig();
  const safeBrand = sanitize(product.brand);
  const safeName = sanitize(product.name);
  const priceDisplay = formatPrice(product.price);

  // Availability for the user's recommended size. Three sources, in
  // priority order:
  //   1. The active history entry's persisted snapshot (history mode —
  //      respects the original "in stock at L?" answer at scrape time).
  //   2. Live computation against the current product.availableSizes
  //      and sizeRec (live mode — just-fetched data).
  //   3. Unknown (no data).
  // If the user re-evaluates with a fresh avatar, the LIVE computation
  // wins over the historical snapshot because sizeRec changes.
  const liveAvailability = computeAvailability(sizeRec?.size, product.availableSizes);
  const persistedAvailability = activeEntry?.availability;
  const displayAvailability =
    sizeRec && product.availableSizes
      ? liveAvailability
      : persistedAvailability
      ? {
          status: persistedAvailability.status as AvailabilityStatus,
          size: persistedAvailability.size,
          checkedAt: persistedAvailability.checkedAt,
        }
      : liveAvailability;
  const showAvailability = displayAvailability.status !== 'unknown' || !!displayAvailability.size;

  // Budget bucket — computed once for the new BUDGET stat column. Null
  // when the user hasn't set a price range, the product has no price,
  // or the currencies don't match (see computeAffordability for the
  // full nullification rules). The column is only rendered when the
  // result is non-null.
  const affordResult = computeAffordability(product?.price, priceRange);

  // Category + Material derivation chain (April 29 2026):
  //   1. Use enrichedProduct.category if it's specific (not in
  //      FILTERED_CATEGORIES — guards against AI returning
  //      "general"/"clothing"/empty).
  //   2. Otherwise infer from URL handle / title / tags via
  //      productInference.ts — deterministic regex fallback for
  //      stores that don't fill product_type / material fields
  //      (yamayoga and others). No network round-trip.
  //   3. Otherwise undefined → render "—" placeholder.
  const enrichedCategory =
    enrichedProduct?.category && !FILTERED_CATEGORIES.has(enrichedProduct.category.toLowerCase())
      ? enrichedProduct.category
      : undefined;
  const inferredCategory = enrichedCategory
    ? undefined
    : inferCategory({ url, title: product.name, tags: enrichedProduct?.tags });
  const displayCategory = enrichedCategory ?? inferredCategory;
  const showCategory = !!displayCategory;

  const enrichedMaterial = enrichedProduct?.material || undefined;
  const inferredMaterial = enrichedMaterial
    ? undefined
    : inferMaterial({ title: product.name, tags: enrichedProduct?.tags });
  const displayMaterial = enrichedMaterial ?? inferredMaterial;
  const showMaterial = !!displayMaterial;

  // Tags pass through the noise filter before render — keeps things
  // like "april26-sale-10" / "DROP XXIV-1" / "best seller" out of the
  // user-facing chip row. Also strips tags that duplicate the
  // CATEGORY (e.g. "Top" tag when category is already "Top") and the
  // MATERIAL (May 3 2026 — Cordstudio's `poem-dress` showed "100%
  // cotton" in both the MATERIAL row and the tag chip row).
  // `strict: true` (May 4 2026) also requires every surviving tag to
  // contain a known garment-attribute keyword (material, texture,
  // colour, length, product type, fit, occasion). Marketing copy
  // that the noise filter missed ("shop the look", "must have",
  // "as seen on") is dropped.
  const visibleTags = filterUserFacingTags(
    enrichedProduct?.tags,
    displayCategory,
    displayMaterial,
    { strict: true },
  );
  const showTags = visibleTags.length > 0;

  const confidenceLabel = sizeRec
    ? sizeRec.confidence === 'high'
      ? 'High'
      : sizeRec.confidence === 'medium'
      ? 'Medium'
      : 'Low'
    : null;

  const inStock =
    sizeRec && product.availableSizes && product.availableSizes.length > 0
      ? product.availableSizes.includes(sizeRec.size)
      : null;

  return (
    // Sift gesture wraps the ENTIRE screen so horizontal swipes on the
    // product-image area (above the docked card) also trigger product-
    // to-product sifting. Previously sift was scoped to the card, which
    // only covers the bottom 200px when collapsed — mid-screen swipes
    // hit the image and did nothing. Drag-to-collapse still lives on the
    // inner GestureDetector so small vertical nudges go to the ScrollView
    // instead of collapsing the overlay.
    <GestureDetector gesture={siftGesture}>
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-bleed product image behind everything */}
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.bgImage} resizeMode="cover" />
      ) : (
        <View style={[styles.bgImage, styles.bgPlaceholder]}>
          {/* Was 0.25 white — only ~1.9:1 contrast on the
              primaryDark (#4c4356) bg. WCAG 1.4.11 needs 3:1 for
              non-text UI. Bumped to textSecondary (0.70 white) to
              clear 5:1+ on the same backdrop. May 3 2026 PM. */}
          <Feather name="shopping-bag" size={96} color={whiteAlpha.textSecondary} />
        </View>
      )}

      {/* Subtle dim — helps the white back chevron + brand/name read */}
      <LinearGradient
        colors={['rgba(20,10,40,0.15)', 'rgba(20,10,40,0.05)', 'rgba(20,10,40,0.35)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Back chevron */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Feather name="chevron-left" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Remove-from-history trash — mirrors the back chevron on the
          right. Only shown in history mode (live mode just saved the
          entry; removing it here would feel adversarial). Acts on the
          CURRENTLY displayed entry (which may differ from the entered
          entry when the user has sifted). */}
      {isHistoryMode && historyEntryId && (
        <TouchableOpacity
          testID="remove-from-history-button"
          style={[styles.deleteBtn, { top: insets.top + spacing.sm }]}
          onPress={() => setPendingDelete(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Remove from history"
        >
          <Feather name="trash-2" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Brand + product name centred near the top of the image. Outer
          wrapper is the absolute-positioned hero slot (animated by
          heroDockStyle to translate + scale with the dock); inner
          `heroChip` is the legibility chip that fades in a dark
          frosted backdrop when collapsed, transparent when expanded.
          Splitting them keeps the chip width tied to the inner text's
          intrinsic size (so the backdrop is a tight pill behind the
          brand+name, not a full-width band). See heroDockStyle +
          heroChipStyle above for the interpolation math.

          Text colour adapts to the underlying image: dark on light
          photos (white-shorts on white bg, etc.), white otherwise.
          `heroBrightness` is `null` until the colour sampler resolves —
          we treat null as "stay white" so the screen never blocks on
          the sampler and falls through to the legacy behaviour on
          failure. */}
      <Animated.View
        style={[styles.hero, { paddingTop: insets.top + spacing.md }, heroDockStyle]}
        pointerEvents="none"
      >
        {/* Brand and product name each live in their OWN chip pill so
            in collapsed mode they read as two distinct beats stacked
            above the dock — like a music-player "artist" chip + "song
            title" chip — instead of one wide pill containing both
            (May 4 2026 PM user direction: "on collapsing to a dock,
            the brand name should be in it's own opaque background and
            the product name in it's own"). Both share heroChipStyle:
            transparent + zero padding when expanded, frosted pill
            with padding when collapsed. */}
        {safeBrand ? (
          <Animated.View style={[styles.heroChip, styles.heroChipBrand, heroChipStyle, heroChipBrandStyle]}>
            <BrandHeading
              brand={safeBrand}
              height={20}
              color="rgba(255,255,255,0.95)"
              uppercase
              style={{ alignSelf: 'center' }}
              textStyle={styles.heroBrand}
              testID="hero-brand"
            />
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.heroChip, heroChipStyle]}>
          <Text style={styles.heroName} numberOfLines={2}>
            {safeName || 'Product'}
          </Text>
        </Animated.View>
        {/* Custom-fit brand spotlight — appears when the storefront
            advertises made-to-measure / bespoke / custom sizing. The
            badge sits between the product name and the glass card so
            shoppers who care about tailored service notice it before
            they read the standard fit verdict. Per anti-pattern #1
            this is ephemeral per scrape — never persisted into a
            shared brand catalog. */}
        {product.customFit?.available && (
          <View style={styles.customFitBadge} testID="custom-fit-badge">
            <Text style={styles.customFitBadgeText}>
              {product.customFit.label ?? 'Custom sizing available'}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Glass info card — expanded = 70% screen + symmetric side/bottom
          padding, collapsed = screen-wide dock anchored to the bottom.
          Layout interpolates from collapseProgress; enter anim composes
          on top. ScrollView inside scrolls the analysis content; the
          horizontal sift gesture wraps it. */}
      <Animated.View
        style={[styles.cardWrap, cardLayoutStyle, cardEnterStyle]}
      >
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="light"
          blurAmount={22}
          reducedTransparencyFallbackColor="rgba(255,255,255,0.75)"
        />
        {/* Tint alpha animates with collapseProgress (see cardTintStyle
            above) — collapsed shows the product image through more
            clearly, expanded firms up for legibility. The static
            `cardTint` style still carries the border + radii. */}
        <Animated.View style={[styles.cardTint, cardTintStyle]} pointerEvents="none" />

        {/* Drag covers the WHOLE top of the overlay — handle bar + the
            verdict header (title, sub-line, price pill). User
            direction: dragging from anywhere at the top should
            collapse/expand, not just the small handle. The verdict
            block is pulled out of the ScrollView and into this
            gesture-wrapped header so it works as a drag target.
            ScrollView starts BELOW the divider, owns vertical scroll
            on the rest of the body. */}
        <Animated.View style={[styles.cardScrollWrap, siftStyle]}>
          <GestureDetector gesture={dragGesture}>
            <View style={styles.headerArea}>
              <View style={styles.handleHit}>
                <View style={styles.handle} />
              </View>

              {/* H1: Fit verdict — biggest element in the card. Uses the
                  TAN Nightingale SVG for the score label; styled-text
                  fallback kicks in if the asset is missing. */}
              <View style={styles.verdictRow}>
                <View style={styles.verdictMain}>
                  <HeadingImage
                    testID="fit-score-label"
                    // Slot follows effectiveScore so the SVG/heading
                    // matches the visual tier (a 1-minor result reads
                    // as great-fit, not some-concerns).
                    slot={
                      effectiveScore === 'great' || effectiveScore === 'minor'
                        ? 'great-fit'
                        : effectiveScore === 'moderate'
                        ? 'some-concerns'
                        : 'may-not-fit'
                    }
                    fallback={scoreConfig.text}
                    height={42}
                    color={scoreConfig.color}
                    textStyle={[styles.verdictText, { color: scoreConfig.color }]}
                  />
                </View>
                {priceDisplay && (
                  <View style={styles.priceColumn}>
                    <View style={styles.pricePill}>
                      <Text style={styles.priceText}>{priceDisplay}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator={false}
          >

          <View style={styles.divider} />

          {/* H2: Stats row — four centred, evenly-spaced columns with
              SIZE / CONFIDENCE / FIT / STOCK labels underneath. The
              4th column (availability) was added when we shipped the
              v1 availability feature: it gives shoppers an at-a-glance
              "is my size obtainable?" answer without forcing them to
              tap through to the store. Same circular-icon visual
              language as FIT for consistency. */}
          <View testID="fit-score-display" style={styles.statsRow}>
            {sizeRec && (
              <View style={styles.statCol}>
                <StatBadge value={sizeRec.size} testID="recommended-size-value" />
                <Text style={styles.statLabel}>SIZE</Text>
              </View>
            )}
            {/* Order is intentional: SIZE → FIT → CONFIDENCE → STOCK.
                Reads as a narrative — "what size? L. Does it fit?
                great. How sure are we? high. Is it in stock? yes."
                Earlier order had MATCH (renamed from CONFIDENCE)
                between SIZE and FIT, but that broke the verdict-then-
                certainty flow. */}
            <View style={styles.statCol}>
              <View style={styles.fitBadge}>
                <Text style={[styles.statIconText, { color: scoreConfig.color }]}>
                  {scoreConfig.icon}
                </Text>
              </View>
              <Text style={styles.statLabel}>FIT</Text>
            </View>
            <View style={styles.statCol}>
              <ConfidenceDonut level={sizeRec?.confidence ?? null} />
              <Text style={styles.statLabel}>CONFIDENCE</Text>
            </View>
            {showAvailability && (
              <View style={styles.statCol} testID="fit-availability-stat">
                <View
                  style={[
                    styles.fitBadge,
                    {
                      // Token-driven status tint — keeps the green/red/
                      // muted alphas consistent with chip backgrounds
                      // elsewhere (statusAlpha tokens in theme.ts).
                      backgroundColor:
                        displayAvailability.status === 'in_stock'
                          ? statusAlpha.successSoft
                          : displayAvailability.status === 'out_of_stock'
                          ? statusAlpha.errorSoft
                          : primaryAlpha.tintXxs,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statIconText,
                      {
                        color:
                          displayAvailability.status === 'in_stock'
                            ? colors.successDeep
                            : displayAvailability.status === 'out_of_stock'
                            ? colors.errorDeep
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {displayAvailability.status === 'in_stock'
                      ? '✓'
                      : displayAvailability.status === 'out_of_stock'
                      ? '✕'
                      : '?'}
                  </Text>
                </View>
                <Text style={styles.statLabel}>STOCK</Text>
              </View>
            )}
            {/* BUDGET — 5th stat column, only rendered when the user
                has a price range configured AND the product price's
                currency matches that range. AffordabilityRing fills
                1/3, 2/3, or 3/3 of the ring + colours warning when
                over budget. May 4 2026 late-PM user direction:
                "can option D fit into the existing stats panel". */}
            {affordResult && (
              <View style={styles.statCol} testID="fit-budget-stat">
                <AffordabilityRing
                  scale={affordResult.scale}
                  overBudget={affordResult.overBudget}
                  symbol={CURRENCY_SYMBOLS[priceRange.currency] ?? '$'}
                />
                <Text style={styles.statLabel}>BUDGET</Text>
              </View>
            )}
          </View>

          {/* Hairline divider directly under the stats row. May 5 2026
              PM user direction: "the line is missing when there's
              some content (there should be a line)". Pairs with the
              COLLAPSED_H bump so the dock cuts exactly 2 px past
              this line — the user's snap-point breakpoint. */}
          <View style={styles.divider} />

          {/* Re-eval banners — expanded only. Status indicators belong
              with the rest of the analysis detail; the dock should
              stay minimal. */}
          {isExpanded && reevaluating && (
            <View style={styles.banner}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.bannerText}>Re-evaluating with updated profile…</Text>
            </View>
          )}
          {isExpanded && reevaluated && !reevaluating && (
            <View style={[styles.banner, styles.bannerSuccess]}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>
                Re-evaluated with your updated profile
              </Text>
            </View>
          )}

          {/* Sizing note — expanded only. */}
          {isExpanded && sizeRec?.note && (
            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>SIZING NOTE</Text>
              <Text style={styles.noteText}>{sizeRec.note}</Text>
            </View>
          )}

          {/* Concerns — always render in expanded state so every fit
              card shows the same panel structure. When the analysis
              flagged no concerns we render a quiet positive line in
              the same visual treatment instead of hiding the section.
              Per user feedback April 29 2026: "all three [screenshots
              of real fit checks] have different analyzed information
              — which makes the app appear unreliable". The fix is
              consistent layout across cards. */}
          {/* Fit concerns section.
              May 5 2026 user direction: "when docked, fit concerns
              only reads a summary - this shouldn't be the case -
              display the whole fit concern section but keep the
              current copy for when fit is perfect..".
              So:
                - warnings.length > 0  → full section in BOTH states
                - warnings.length === 0 → only the meta-row "None —
                  fits comfortably" line in the collapsed state, plus
                  the "No concerns flagged…" reassurance in expanded. */}
          {(isExpanded || warnings.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FIT CONCERNS</Text>
              {warnings.length > 0 ? (
                warnings.map((warning, index) => {
                  const config = getSeverityConfig(warning.severity);
                  return (
                    <View key={index} style={styles.concernRow}>
                      <View style={[styles.concernDot, { backgroundColor: config.color }]} />
                      <View style={styles.concernBody}>
                        <Text style={[styles.concernSeverity, { color: config.color }]}>
                          {config.label.toUpperCase()}
                        </Text>
                        <Text style={styles.concernText}>{warning.message}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.concernEmptyText}>
                  No concerns flagged for your profile — this should fit comfortably.
                </Text>
              )}
            </View>
          )}

          {/* Tags — always render in expanded state. The whole tags
              section is a drag target so the user can collapse the
              overlay from around the tags region without scrolling
              back to the handle. When the scrape didn't surface any
              user-facing tags (Shopify storefront returned an empty
              tag array, or every tag was filtered as merchandising
              noise), we render a single "—" placeholder so the panel
              keeps the same structure as cards with rich tag data. */}
          {isExpanded && (
            <GestureDetector gesture={tagsDragGesture}>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TAGS</Text>
                {showTags ? (
                  <View style={styles.tagsContainer}>
                    {visibleTags.slice(0, 6).map((tag: string, i: number) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag.toLowerCase()}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.metaPlaceholder}>—</Text>
                )}
              </View>
            </GestureDetector>
          )}

          {/* Meta rows.
              - Collapsed (dock): a single "Fit concerns" preview line
                replaces the Material row. The verdict + stats already
                handle the high-level "does it fit", but a one-line
                concerns summary is the actionable detail a shopper
                wants to see WITHOUT expanding the dock — Material is
                still in the expanded view and on the history card.
                User direction May 3 2026 PM: "replace material bit
                with fit concerns bit (keep the rest of the
                interactions/design the same)".
              - Expanded: full Material + Category rows as before
                (Concerns themselves render in their own section
                above this one). */}
          {!isExpanded && warnings.length === 0 && (
            <View style={styles.metaSection}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Fit concerns</Text>
                <Text
                  style={warnings.length > 0 ? styles.metaValue : styles.metaPlaceholder}
                  numberOfLines={1}
                >
                  {warnings.length === 0
                    ? 'None — fits comfortably'
                    : warnings.length === 1
                    ? `1 ${effectiveScore === 'minor' ? 'note' : 'concern'}`
                    : `${warnings.length} ${effectiveScore === 'minor' ? 'notes' : 'concerns'}`}
                </Text>
              </View>
            </View>
          )}
          {isExpanded && (showMaterial || isExpanded) && (
            <View style={styles.metaSection}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Material</Text>
                <Text style={showMaterial ? styles.metaValue : styles.metaPlaceholder}>
                  {showMaterial ? displayMaterial : '—'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Category</Text>
                <Text style={showCategory ? styles.metaValue : styles.metaPlaceholder}>
                  {showCategory ? displayCategory : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Action buttons — expanded only. The dock should stay
              minimal; CTAs live behind a deliberate drag-up. */}
          {isExpanded && (
          <View style={styles.actionsSection}>
            {isHistoryMode ? (
              <>
                {/* Re-evaluate stays on this screen and refreshes
                    fit data in place. Re-scrapes the product URL +
                    re-runs checkFit against the current avatar — see
                    runReevaluation for the flow. The "Change your
                    measurements" button below is the dedicated path
                    to AvatarSetup; routing Re-evaluate through there
                    too felt round-about (per user direction April 29
                    2026). */}
                <TouchableOpacity
                  testID="reevaluate-button"
                  style={[styles.primaryButton, reevaluating && styles.primaryButtonDisabled]}
                  onPress={runReevaluation}
                  disabled={reevaluating}
                  activeOpacity={0.85}
                >
                  {reevaluating ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Re-evaluate</Text>
                  )}
                </TouchableOpacity>
                {/* Swapped order: View on Store above Change measurements
                    so the shopping-intent action sits closer to the
                    primary Re-evaluate CTA, and the profile-editing
                    action takes the deeper slot. */}
                <TouchableOpacity
                  testID="view-on-store-button"
                  style={styles.secondaryButton}
                  onPress={openProductPage}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>View on Store</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="change-measurements-button"
                  style={styles.ghostButton}
                  onPress={() => {
                    wentToAvatarSetup.current = true;
                    navigation.navigate('AvatarSetup');
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.ghostButtonText}>Change your measurements</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  testID="view-on-store-button"
                  style={styles.primaryButton}
                  onPress={openProductPage}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>View on Store</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="check-another-button"
                  style={styles.secondaryButton}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Check Another Product</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          )}

          {/* Attribution footer — expanded only. Citation belongs with
              the rest of the analysis content; the dock just shows the
              verdict at-a-glance.
              Combined with "View on Store" above (the loud referral),
              this is the quiet credit line. Timestamp answers "how
              fresh is this?" — critical for inventory + price fields
              which can go stale fast. */}
          {isExpanded && url && (
            <View style={styles.attributionFooter}>
              <Text
                testID="attribution-footer"
                style={styles.attributionText}
                numberOfLines={1}
              >
                Data from {displayHostname(url)} · checked{' '}
                {formatRelativeTime(
                  activeEntry?.checkedAt ?? precomputed?.checkedAt ?? new Date().toISOString()
                )}
              </Text>
            </View>
          )}
          </ScrollView>
        </Animated.View>
      </Animated.View>

      {/* Themed delete confirmation — same visual language as the
          rest of the app (replaces the native Alert popup that
          looked system-generated and broke the glass aesthetic). */}
      <ConfirmDialog
        visible={pendingDelete}
        title="Remove from history?"
        confirmLabel="Remove"
        icon="trash-2"
        confirmTestID="confirm-delete-fit-entry"
        onConfirm={() => {
          if (historyEntryId) {
            removeEntry(historyEntryId);
            // Prune local siblings + clamp index so the next sibling
            // becomes active. Only go back when we deleted the last
            // remaining sibling.
            const remaining = siblings.filter((e) => e.id !== historyEntryId);
            if (remaining.length > 0) {
              setSiblings(remaining);
              setLocalIndex((prev) => Math.min(prev, remaining.length - 1));
            } else {
              navigation.goBack();
            }
          }
          setPendingDelete(false);
        }}
        onCancel={() => setPendingDelete(false)}
      />
    </View>
    </GestureDetector>
  );
}

// Simple badge — circle with the size letter/number, no label below.
function StatBadge({ value, testID }: { value: string; testID?: string }) {
  return (
    <View style={styles.statBadge}>
      <Text testID={testID} style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// MATCH donut — circular arc whose length grows with the system's
// certainty in the size recommendation. Rendered at the same 44px
// circle dimension as the SIZE / FIT / STOCK badges so all four stat
// columns line up vertically. `high` stops just shy of 100% (0.98) —
// a fully-closed ring reads as "complete" which is wrong for
// confidence; the tiny gap signals "strong but not absolute".
function ConfidenceDonut({ level }: { level: 'high' | 'medium' | 'low' | null }) {
  if (!level) return null;
  const size = STAT_ICON_SIZE;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const percent = level === 'high' ? 0.98 : level === 'medium' ? 0.6 : 0.28;
  // Tap into the primary-alpha tokens so the saturation ramp is
  // adjustable in one place (theme.ts) instead of three inline values.
  const colour =
    level === 'high'
      ? colors.primary
      : level === 'medium'
      ? primaryAlpha.tintLg
      : primaryAlpha.tintMd;
  const label = level === 'high' ? 'H' : level === 'medium' ? 'M' : 'L';
  return (
    <View style={styles.confidenceDonut}>
      <Svg width={size} height={size}>
        {/* Track ring — always a full circle at very low alpha */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={primaryAlpha.tintSm}
          strokeWidth={stroke}
          fill="transparent"
        />
        {/* Filled arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colour}
          strokeWidth={stroke}
          strokeDasharray={`${c * percent} ${c}`}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* Single-letter centre glyph keeps the donut readable without a
          separate label — H/M/L maps directly to the arc length. */}
      <Text style={styles.confidenceDonutLabel}>{label}</Text>
    </View>
  );
}

/**
 * AffordabilityRing — battery-style filled-arc ring for the 5th stat
 * column ("BUDGET"). Mirrors `ConfidenceDonut` but the arc length
 * encodes 1/3, 2/3, or 3/3 of the user's price range.
 *   scale 1 → 1/3 arc (cheapest third)
 *   scale 2 → 2/3 arc (middle third)
 *   scale 3 → 3/3 arc (full ring, most expensive third — or
 *             over-budget when `overBudget`)
 *
 * Centre glyph is the user's currency symbol (£ / $ / € / ₹) resolved
 * from the configured price range. Over-budget renders the arc in
 * `colors.warningDeep` and the symbol in the same warning hue —
 * scannable at-a-glance "above your range" signal.
 */
function AffordabilityRing({
  scale,
  overBudget,
  symbol,
}: {
  scale: 1 | 2 | 3;
  overBudget: boolean;
  symbol: string;
}) {
  const size = STAT_ICON_SIZE;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const percent = scale === 1 ? 0.333 : scale === 2 ? 0.667 : 1.0;
  const colour = overBudget ? colors.warningDeep : colors.primary;
  return (
    <View style={styles.confidenceDonut}>
      <Svg width={size} height={size}>
        {/* Track ring — full circle at low alpha, same as the
            confidence donut. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={primaryAlpha.tintSm}
          strokeWidth={stroke}
          fill="transparent"
        />
        {/* Filled arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colour}
          strokeWidth={stroke}
          strokeDasharray={`${c * percent} ${c}`}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.confidenceDonutLabel, { color: colour }]}>{symbol}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Background product image (full-bleed) ---
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryDark,
  },
  bgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Back chevron ---
  //   Deep brand-purple tint (colors.text @ 0.55) instead of black @ 0.32 —
  //   the old grey-black fill fought the grey-purple palette. Matches the
  //   history trash + every other circular affordance now.
  backBtn: {
    position: 'absolute',
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: textAlpha.tintLg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // --- Remove-from-history trash (mirror of backBtn, right side) ---
  deleteBtn: {
    position: 'absolute',
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: textAlpha.tintLg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // --- Hero (brand + product name over image) ---
  // Side padding dropped from SIDE_PAD → spacing.sm so the inner
  // heroChip (which is sized to its content) can stretch to use
  // ~94% of the viewport width when the chip is in its collapsed
  // dark-pill mode. This is what gives a long product name like
  // "Regular Drawstring Shorts in Stripes" room to read on a single
  // line above the docked card (May 4 2026 user direction: "use more
  // width than you are using right now to display product name").
  hero: {
    position: 'absolute',
    top: 0,
    left: spacing.sm,
    right: spacing.sm,
    alignItems: 'center',
  },
  // Pill wrapping brand OR name. Backdrop retired May 4 2026 late-PM
  // ("remove the background treatment you have for heading and
  // subheading of the product fit page") — text now floats on the
  // product image with text shadows alone. Kept as a styled wrapper
  // to preserve the marginBottom between brand + name chips and
  // the heroChipStyle padding animation.
  heroChip: {
    alignItems: 'center',
  },
  // Brand chip — sits ABOVE the name chip. marginBottom is animated
  // at runtime via heroChipBrandStyle (2 px expanded → 3 px docked).
  // Static value here is just the fallback when animations haven't
  // initialised; same magnitude as the animated low-end.
  heroChipBrand: {
    marginBottom: 2,
  },
  heroBrand: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 6,
    // Stronger shadow than before — the chip backdrop carries most
    // of the legibility lift in collapsed mode, but in expanded mode
    // the text floats over the raw product image, so a heavier
    // shadow is the only safety net. Doubled radius + dropped vertical
    // offset for an even halo around each glyph.
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroName: {
    ...typography.headingXL,
    // Size reduced May 4 2026 late-PM ("reduce the size of product
    // name on the product fit screen"). headingXL is 28 px; dialed
    // down to 22 px so the name reads as a sub-line on the hero
    // rather than competing with the verdict heading inside the
    // dock. Line-height shrinks proportionally.
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Marcellus-Regular',
    color: '#fff',
    textAlign: 'center',
    // Heavier shadow to clear hard-to-read product backgrounds (May 4
    // 2026 — was 0.55 alpha / 8 px radius; bumped to 0.75 / 12 px so
    // the name reads on white-on-white shorts photos like the user
    // flagged with "Regular Drawstring Shorts in Stripes" on RIO).
    // Pairs with the heroChip's animated dark-pill backdrop in
    // collapsed mode.
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  // (heroBrandOnLight + heroNameOnLight overrides retired May 4 2026
  // late-PM. The brightness-driven dark-text-on-light-image flip
  // tested poorly on device — the user wanted white text everywhere.
  // Legibility on light product photos is now carried by the
  // permanent dark heroChip backdrop + text shadows.)

  // --- Custom-fit brand spotlight badge ---
  // Lavender-tinted pill in italic display serif. Sits below the
  // product name in the hero so the made-to-measure / bespoke /
  // custom-sizing service is the first thing a fit-conscious shopper
  // notices before the standard verdict. Background uses primaryAlpha
  // tokens so the saturation lines up with chip backgrounds elsewhere
  // (FIT badge, MATCH donut, price pill). The pill itself is
  // pointerEvents-passive (the parent hero blocks pointer events) —
  // it is informational, not a tap target. We can lift this out into
  // a Pressable later when we have a custom-sizing URL to link to.
  customFitBadge: {
    marginTop: 10,
    backgroundColor: primaryAlpha.tintMd,
    borderWidth: 1,
    borderColor: primaryAlpha.tintLg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    alignSelf: 'center',
  },
  customFitBadgeText: {
    // Route through the registry so the badge stays in the app face —
    // a hardcoded fontFamily string silently falls back to system
    // serif if it ever drifts from the bundled font.
    fontFamily: fontFamily.display,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // --- Glass card ---
  // Layout props (height / left / right / bottom / bottom-radii) are all
  // driven by `cardLayoutStyle` — animated from collapseProgress. We keep
  // the top radii + shadow static here; the animated style composes on top.
  cardWrap: {
    position: 'absolute',
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
    overflow: 'hidden',
    // Deep purple-tinted drop shadow — grounds the card over the image.
    shadowColor: '#1a1118',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.48,
    shadowRadius: 28,
    elevation: 18,
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
    // Border + radii are static; the backgroundColor is set
    // dynamically by `cardTintStyle` (interpolated off
    // collapseProgress so the dock flexes between 0.35 collapsed
    // and 0.55 expanded). The brighter inner edge catches "light"
    // and reads as glass rather than a solid wash.
    borderWidth: 1,
    borderColor: glass.dockBorderColor,
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
  },
  // Wrapper around the ScrollView that receives the horizontal sift pan.
  // `flex: 1` under the card (after the handle) so the scrollable area
  // fills the remaining height.
  cardScrollWrap: {
    flex: 1,
  },
  // Header area — wraps the handle + verdict block in the drag
  // gesture. The whole rectangle is a drag target ("anywhere at the
  // top of the overlay" per user direction). Padding mirrors
  // cardContent's horizontal padding so the verdict aligns with the
  // ScrollView content below.
  headerArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cardScroll: {
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  // Visible-handle hit zone — sits inside headerArea. No separate
  // gesture (the parent headerArea catches the drag). alignItems:
  // 'center' centres the small grip bar horizontally.
  handleHit: {
    width: '100%',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: textAlpha.tintMd,
  },

  // --- Verdict row (H1) ---
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  verdictMain: {
    flex: 1,
  },
  verdictText: {
    // headingM (20px) — bumped down from headingL (24px) per May 3 2026
    // user feedback: the verdict was reading too large on the FitResult
    // hero. Matches the visual weight of the size pill + stat row sitting
    // beside it.
    ...typography.headingM,
    fontFamily: 'Marcellus-Regular',
    // Marcellus is Regular-only — keep '400' so Android doesn't
    // synthesise fake bold (see anti-pattern #13).
    fontWeight: '400',
  },
  // verdictSub style retired May 4 2026 late-PM along with the
  // "N notes / N concerns" sub-line ("actually remove that 'n note(s)'
  // bit"). The affordability chip briefly moved into that slot
  // (verdictAfford) and was retired in turn — affordability now
  // renders as the BUDGET column in the stats row (see
  // AffordabilityRing above).
  // Holds just the price pill now that the affordability chip moved
  // up under the verdict heading (May 4 2026 late-PM). Single child
  // means flex layout no longer matters; left as a column for
  // future siblings.
  priceColumn: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  pricePill: {
    backgroundColor: primaryAlpha.tintSm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
  },
  priceText: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    fontWeight: '400',
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // --- Divider ---
  divider: {
    height: 1,
    backgroundColor: textAlpha.tintSm,
    marginBottom: spacing.md,
  },

  // --- Stats row (H2) — 3 centred columns, each with a tiny caps label
  //     underneath per Claude Design handoff ---
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  statCol: {
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 1.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // Size badge — circle with the size letter/number
  // SIZE / FIT / STOCK badges — all use the same STAT_ICON_SIZE so
  // they line up vertically with the MATCH donut. statBadge has a
  // visible border (it carries letter glyphs and benefits from the
  // sharper edge); fitBadge is borderless (it carries icon glyphs
  // ✓ / ⚠ / ✕ that have their own visual weight). Both fills come
  // from primaryAlpha tokens so the saturation ramp is adjustable
  // in one place.
  statBadge: {
    width: STAT_ICON_SIZE,
    height: STAT_ICON_SIZE,
    borderRadius: STAT_ICON_SIZE / 2,
    backgroundColor: primaryAlpha.tintSm,
    borderWidth: 1.25,
    borderColor: primaryAlpha.tintMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fitBadge: {
    width: STAT_ICON_SIZE,
    height: STAT_ICON_SIZE,
    borderRadius: STAT_ICON_SIZE / 2,
    backgroundColor: primaryAlpha.tintXxs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 16,
    fontWeight: '400',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  statIconText: {
    // Single-weight font — fontWeight stays '400' (anti-pattern #13).
    fontFamily: fontFamily.primaryBold,
    fontSize: 18,
    fontWeight: '400',
  },

  // --- Confidence donut — circular arc, purple saturation + arc length
  //     both grow with confidence. Centre letter (H/M/L) is the legible
  //     label without stealing space. ---
  confidenceDonut: {
    width: STAT_ICON_SIZE,
    height: STAT_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceDonutLabel: {
    fontFamily: fontFamily.primary,
    position: 'absolute',
    fontSize: 13,
    fontWeight: '400',
    color: colors.primary,
    letterSpacing: -0.3,
  },

  // --- Banners ---
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: primaryAlpha.tintXs,
    borderRadius: borderRadius.md,
  },
  bannerSuccess: {
    backgroundColor: statusAlpha.successSoft,
  },
  bannerText: {
    ...typography.banner,
    color: colors.text,
    flex: 1,
  },

  // --- Sizing note ---
  noteBlock: {
    backgroundColor: primaryAlpha.tintXs,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noteLabel: {
    ...typography.overline,
    color: colors.primary,
    marginBottom: 4,
  },
  noteText: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 20,
  },

  // --- Generic section ---
  section: {
    marginBottom: spacing.md,
  },
  // Section label — darkest text (`colors.text`) so the small-caps
  // overline visually OWNS the section above its body. The body
  // content underneath then drops to textSecondary or textMuted,
  // creating a three-tier colour ramp. Hierarchy leans on COLOUR
  // since the app is single-weight (Marcellus Regular only).
  sectionLabel: {
    ...typography.overline,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // --- Concerns ---
  concernRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  concernDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 6,
  },
  concernBody: {
    flex: 1,
  },
  concernSeverity: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  // Concern body — mid-tier `textSecondary` so it sits CLEARLY
  // below the section label (which is `colors.text`). Was `colors.text`
  // before; that put the label and the body at the same colour, which
  // is what the user flagged as "no visual hierarchy" April 29 2026.
  concernText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  // Empty-state line shown inside the FIT CONCERNS section when the
  // analysis flagged no warnings. Same colour tier as concernText
  // (`textSecondary` — WCAG AA-safe at 15px regular on white).
  // Was italic for an affirmative tone but the user flagged it as
  // unwanted (April 29 2026: "keep this as normal"); plain regular
  // weight reads as factual not decorative.
  concernEmptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  // --- Tags ---
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: primaryAlpha.tintSm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  tagText: {
    fontFamily: fontFamily.primarySemiBold,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.3,
    color: colors.primary,
  },

  // --- Meta ---
  metaSection: {
    borderTopWidth: 1,
    borderTopColor: textAlpha.tintSm,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  // Meta row — bumped DOWN to labelSmall (13px) + UPPERCASE per user
  // direction April 29 2026 ("material and category can be in one
  // size smaller and all caps"). The smaller-caps treatment reads
  // as a tight spec-table line rather than body copy, which is the
  // right register for a value-pair like Material: Cotton.
  //
  // Colour ramp stays:
  //   metaLabel        textSecondary + 500   (caption)
  //   metaValue        text + 700           (value, most prominent)
  //   metaPlaceholder  textSecondary + 500   (no value present)
  // textMuted (#8a7e94) is 3.75:1 on white — fails WCAG AA for
  // body text; reserved for ≥18px or decorative-only contexts.
  metaLabel: {
    ...typography.labelSmall,
    fontWeight: '400',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metaValue: {
    ...typography.labelSmall,
    // 800 (was 700) — Noto Serif has the variant. Visibly heavier
    // than the metaLabel (500) so the row reads as label-then-VALUE
    // even at 13px caps. Per user direction April 29 2026.
    fontWeight: '400',
    color: colors.text,
    textTransform: 'uppercase',
  },
  // Placeholder for "—" when the scrape didn't surface a value.
  // Same caps + size as the rest of the row so the empty state
  // doesn't break vertical rhythm; same colour tier as the label.
  metaPlaceholder: {
    ...typography.labelSmall,
    fontWeight: '400',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  // Availability row — colored dot + status text. Right-aligned to
  // match the existing metaValue placement so it lines up vertically
  // with Material + Category rows.
  availabilityValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // --- Actions ---
  // paddingHorizontal 1 (May 5 2026, "bring the buttons in by say
  // half a pixel - if possible") — RN doesn't honour sub-pixel
  // values reliably across Android densities, so 1 px each side
  // (= 2 px total) is the closest-we-can-get-to-half-pixel-each-
  // side without weird rounding.
  actionsSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: 1,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  // Disabled state for Re-evaluate while a re-scrape + checkFit
  // round-trip is in flight. Same brand-purple background but at
  // ~70% opacity so the user sees the press registered without an
  // ambiguous "did anything happen?" gap.
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 15,
    color: colors.white,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: primaryAlpha.tintSm,
    borderRadius: borderRadius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  ghostButton: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  ghostButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '400',
  },

  // Attribution footer — small, centred, muted. Intentionally quiet so
  // it reads as a citation, not a CTA. The big "View on Store" button
  // above is the loud referral path; this is the credit line.
  attributionFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: textAlpha.tintXs,
  },
  attributionText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.8,
  },
});
