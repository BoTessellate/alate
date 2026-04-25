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
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import { sanitize } from '../utils/sanitize';
import { checkFit, enrichProduct, extractBrandFromUrl, scrapeProduct, ScrapedProduct, FitWarning } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useCalibrationStore, averageCalibration } from '../store/calibrationStore';
import FitLoader from '../components/FitLoader';
import HeadingImage from '../components/HeadingImage';
import { captureError } from '../utils/sentry';
import { formatRelativeTime, displayHostname } from '../utils/relativeTime';
// Currency formatting shared with HistoryCoverFlow + SwipeableHistoryStack
// so the same symbol map (incl. ₹ for INR) drives every price display.
import { formatPrice } from '../utils/currency';
// Tag filtering — strip merchandising noise (sale codes, drops, sizes,
// "best seller" labels, etc.) so users only see tags that describe
// the actual garment (material, colour, fit, occasion, vibe).
import { filterUserFacingTags } from '../utils/tagFilter';
// Availability — computed locally from the storefront's
// `availableSizes` list (Shopify direct-fetch surfaces this) + the
// user's recommended size. No separate backend call needed.
import { computeAvailability, describeAvailability, AvailabilityStatus } from '../utils/availability';

type FitResultRouteProp = RouteProp<RootStackParamList, 'FitResult'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Expanded card occupies 70% of screen with symmetric side + bottom
// padding. Collapsed card docks at the screen bottom (full width, no
// padding, rounded top corners only) and is short enough to show just
// the verdict + price + stats row; fit concerns are hidden at that
// point. The user drags the handle up/down to switch.
const EXPANDED_H = Math.round(SCREEN_H * 0.7);
// Collapsed dock height — tight enough to feel like a dock, wide enough
// to keep the verdict + stats row + material + availability readable
// without scrolling. Bumped 200 → 204 to give the new availability row
// a comfortable breathing margin without changing visual weight.
const COLLAPSED_H = 204;
const SIDE_PAD = spacing.lg;
const SWIPE_THRESHOLD = 80; // px of horizontal drag before sift fires

const FILTERED_CATEGORIES = new Set(['general', 'clothing', 'other', 'unknown', '']);

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
  const { addEntry, updateEntry, removeEntry } = useFitHistoryStore();
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
      }
    : routeProduct ?? scrapedProduct ?? undefined;
  const url = activeEntry ? activeEntry.url : routeUrl;
  const historyEntryId = activeEntry ? activeEntry.id : routeHistoryId;
  const isHistoryMode = !!historyEntryId && (!!activeEntry || !!precomputed);

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
  const collapseProgress = useSharedValue(1);
  const startProgress = useSharedValue(1);

  const wentToAvatarSetup = useRef(false);
  const prevAvatarRef = useRef(avatar);

  // Sync local fit-result state whenever the sift index changes. Skip on
  // first mount — the lazy useState initialisers already handled that.
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
    left: interpolate(collapseProgress.value, [0, 1], [0, SIDE_PAD]),
    right: interpolate(collapseProgress.value, [0, 1], [0, SIDE_PAD]),
    bottom: interpolate(
      collapseProgress.value,
      [0, 1],
      [0, insets.bottom + SIDE_PAD]
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

  // Vertical drag toggles collapse. Lives on the outer card so the user
  // can drag from anywhere on the overlay (per user direction "from any
  // place on the upper half"). `activeOffsetY([-10, 10])` means small
  // nudges still go to the inner ScrollView; only deliberate vertical
  // swipes trigger the collapse. 300px of drag = full transition.
  const dragGesture = Gesture.Pan()
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
      collapseProgress.value = withSpring(target, { damping: 18, stiffness: 160 });
      runOnJS(setIsExpanded)(target === 1);
    });

  // Horizontal drag sifts to the next/prev entry. HOISTED to the root
  // view (below) so it works regardless of where the card is — key for
  // the collapsed state, where the card only occupies the bottom 200px
  // and users instinctively swipe at mid-screen (i.e. OVER the product
  // image, not the dock). Before this was scoped to cardScrollWrap and
  // mid-screen swipes fell on dead area.
  //
  //   - `activeOffsetX([-15, 15])`: small horizontal nudges pass through
  //   - `failOffsetY([-25, 25])`: yields to the inner drag gesture on
  //     clear vertical motion (dragGesture lives on cardScrollWrap, so
  //     within the card a vertical pan still collapses instead of sifts)
  // The onEnd guard (`entriesLen > 0`) handles the non-sift case without
  // needing `.enabled(canSift)` — keeping this gesture built unconditionally
  // so the GestureDetector doesn't churn refs when canSift flips.
  const swipeX = useSharedValue(0);
  const siftGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-25, 25])
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
      swipeX.value = withSpring(0, { damping: 20, stiffness: 180 });
    });

  const siftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      if (wentToAvatarSetup.current && avatar !== prevAvatarRef.current) {
        prevAvatarRef.current = avatar;
        wentToAvatarSetup.current = false;
        runReevaluation();
      }
    }, [avatar])
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
        try {
          const enrichResult = await enrichProduct({
            name: workingProduct.name || 'Unknown Product',
            image_url: workingProduct.image,
            description: workingProduct.description,
            price: workingProduct.price?.amount,
            currency: workingProduct.price?.currency,
          });
          if (enrichResult.success && enrichResult.product) {
            setEnrichedProduct(enrichResult.product);
            enrichedData = enrichResult.product;
          } else {
            captureError(new Error('Enrichment returned success:false'), {
              feature: 'product-enrichment',
              productName: workingProduct.name,
              url,
            });
          }
        } catch (enrichError) {
          captureError(enrichError, {
            feature: 'product-enrichment',
            productName: workingProduct.name,
            url,
          });
        }
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

        addEntry({
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
        });
      }
    } catch (error) {
      console.error('Fit analysis failed:', error);
      captureError(error, { feature: 'fit-analysis', productName: product?.name, url });
    } finally {
      setLoading(false);
    }
  };

  const runReevaluation = async () => {
    if (!avatar || !historyEntryId) return;
    setReevaluating(true);
    try {
      const calibration = averageCalibration(calibrationGarments);
      const fitResult = await checkFit(
        {
          id: historyEntryId,
          product_name: product?.name || 'Unknown',
          category: enrichedProduct?.category || precomputed?.enrichedProduct?.category || 'clothing',
          material: enrichedProduct?.material || precomputed?.enrichedProduct?.material,
          tags: enrichedProduct?.tags || precomputed?.enrichedProduct?.tags,
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
        updateEntry(historyEntryId, {
          warnings: newWarnings,
          fitScore: newScore,
          sizeRecommendation: newSizeRec
            ? { size: newSizeRec.size, confidence: newSizeRec.confidence, note: newSizeRec.note }
            : undefined,
        });
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

  const getScoreConfig = () => {
    // Use the *Deep text variants per Claude Design — the verdict label
    // reads as hero text on a white-tinted glass card, so it needs more
    // ink than the mid-saturation `success/warning/error` (which are
    // tuned for chip backgrounds). Same hue family, darker shade.
    switch (fitScore) {
      case 'great':
        return {
          color: colors.successDeep,
          icon: '✓',
          text: 'Great Fit!',
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
  // an unsupported brand, a blocked origin, or a network error. Quiet
  // glass card with a way back. The brand-nudge UX from the previous
  // architecture (when HomeScreen handled scrape errors) is on the
  // backlog — this is the minimum-viable "we couldn't read this URL"
  // state.
  if (scrapeError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorCardWrap}>
          <Feather
            name={scrapeError.kind === 'blocked' ? 'shield' : 'alert-circle'}
            size={32}
            color={colors.textSecondary}
            style={{ marginBottom: spacing.md }}
          />
          <Text style={styles.errorCardTitle}>
            {scrapeError.kind === 'blocked'
              ? `${scrapeError.origin || 'This brand'} has opted out`
              : "We couldn't read this product"}
          </Text>
          <Text style={styles.errorCardBody}>{scrapeError.message}</Text>
          <TouchableOpacity
            testID="fit-result-error-go-back"
            style={[styles.primaryButton, { marginTop: spacing.lg }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Go back</Text>
          </TouchableOpacity>
          {routeUrl ? (
            <TouchableOpacity
              testID="fit-result-error-open-store"
              style={[styles.secondaryButton, { marginTop: spacing.sm }]}
              onPress={() => Linking.openURL(routeUrl)}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Visit store directly</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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

  const showCategory = !!(enrichedProduct?.category && !FILTERED_CATEGORIES.has(enrichedProduct.category.toLowerCase()));
  const showMaterial = !!enrichedProduct?.material;
  // Tags pass through the noise filter before render — keeps things
  // like "april26-sale-10" / "DROP XXIV-1" / "best seller" out of the
  // user-facing chip row. Also strips a tag that duplicates the
  // category (e.g. "Top" tag when category is already "Top").
  const visibleTags = filterUserFacingTags(enrichedProduct?.tags, enrichedProduct?.category);
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
          <Feather name="shopping-bag" size={96} color="rgba(255,255,255,0.25)" />
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
          onPress={() => {
            Alert.alert(
              'Remove from history',
              `Remove "${safeName || 'this item'}" from your history?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => {
                    // Drop from the Zustand store (authoritative list).
                    removeEntry(historyEntryId);
                    // Also prune our local siblings view so the card
                    // immediately reflects the deletion. If there's
                    // another sibling to show, stay on this screen and
                    // land on it. Only go back when we deleted the
                    // last remaining sibling — there's nothing left
                    // to display.
                    const remaining = siblings.filter((e) => e.id !== historyEntryId);
                    if (remaining.length > 0) {
                      setSiblings(remaining);
                      setLocalIndex((prev) => Math.min(prev, remaining.length - 1));
                    } else {
                      navigation.goBack();
                    }
                  },
                },
              ]
            );
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Feather name="trash-2" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Brand + product name centred near the top of the image */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]} pointerEvents="none">
        {safeBrand ? <Text style={styles.heroBrand}>{safeBrand.toUpperCase()}</Text> : null}
        <Text style={styles.heroName} numberOfLines={2}>
          {safeName || 'Product'}
        </Text>
      </View>

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
        {/* Tint is lighter now that the QmBlurView backend does a real
            blur on mid-range Android. Inner border catches "light" on
            the edge for a frosted-glass feel. */}
        <View style={styles.cardTint} pointerEvents="none" />

        {/* Inner GestureDetector — drag-only. Sift was hoisted to the
            root view (see top of component) so horizontal swipes on the
            product-image area above the collapsed dock also sift. Drag
            stays scoped to the card so its activeOffsetY threshold only
            competes with the ScrollView's native vertical gesture, not
            the whole screen (which would eat all vertical taps). */}
        <GestureDetector gesture={dragGesture}>
          <Animated.View style={[styles.cardScrollWrap, siftStyle]}>
            {/* Visual drag handle — no longer a gesture target itself,
                since the whole card receives drag. Purely decorative. */}
            <View style={styles.handleHit} pointerEvents="none">
              <View style={styles.handle} />
            </View>
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardContent}
              showsVerticalScrollIndicator={false}
            >

          {/* H1: Fit verdict — biggest element in the card. Uses the
              TAN Nightingale SVG for the score label; styled-text
              fallback kicks in if the asset is missing. */}
          <View style={styles.verdictRow}>
            <View style={styles.verdictMain}>
              <HeadingImage
                testID="fit-score-label"
                slot={
                  fitScore === 'great'
                    ? 'great-fit'
                    : fitScore === 'moderate'
                    ? 'some-concerns'
                    : 'may-not-fit'
                }
                fallback={scoreConfig.text}
                height={42}
                color={scoreConfig.color}
                textStyle={[styles.verdictText, { color: scoreConfig.color }]}
              />
              <Text style={styles.verdictSub}>
                {warnings.length === 0
                  ? 'No fit concerns'
                  : `${warnings.length} ${warnings.length === 1 ? 'concern' : 'concerns'}`}
              </Text>
            </View>
            {priceDisplay && (
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>{priceDisplay}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* H2: Stats row — three centred, evenly-spaced elements with
              SIZE / CONFIDENCE / FIT labels underneath. Per Claude Design
              handoff: the trio reads left-to-right, labels anchor meaning,
              no 4th in-stock icon (removed as visually confusing). */}
          <View testID="fit-score-display" style={styles.statsRow}>
            {sizeRec && (
              <View style={styles.statCol}>
                <StatBadge value={sizeRec.size} testID="recommended-size-value" />
                <Text style={styles.statLabel}>SIZE</Text>
              </View>
            )}
            <View style={styles.statCol}>
              <ConfidenceDonut level={sizeRec?.confidence ?? null} />
              <Text style={styles.statLabel}>CONFIDENCE</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.fitBadge}>
                <Text style={[styles.statIconText, { color: scoreConfig.color }]}>
                  {scoreConfig.icon}
                </Text>
              </View>
              <Text style={styles.statLabel}>FIT</Text>
            </View>
          </View>

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

          {/* Concerns — only render when the card is expanded. When the user
              drags the handle down to collapse, this section disappears and
              the card shrinks to show just the verdict + stats + material.
              Re-expanding brings it back. */}
          {isExpanded && warnings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FIT CONCERNS</Text>
              {warnings.map((warning, index) => {
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
              })}
            </View>
          )}

          {/* Tags — expanded only. */}
          {isExpanded && showTags && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TAGS</Text>
              <View style={styles.tagsContainer}>
                {visibleTags.slice(0, 6).map((tag: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.toLowerCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Meta rows — Material + Availability survive the dock's
              minimum-info treatment. Category and category-like fields
              only appear when expanded. Per the user spec: dock shows
              verdict + price + stats + material, plus availability so
              shoppers know if their size is actually obtainable
              without tapping View on Store. */}
          {(showMaterial || showAvailability || (isExpanded && showCategory)) && (
            <View style={styles.metaSection}>
              {showMaterial && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Material</Text>
                  <Text style={styles.metaValue}>{enrichedProduct!.material}</Text>
                </View>
              )}
              {showAvailability && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Availability</Text>
                  <View style={styles.availabilityValueWrap}>
                    <View
                      style={[
                        styles.availabilityDot,
                        {
                          backgroundColor:
                            displayAvailability.status === 'in_stock'
                              ? colors.successDeep
                              : displayAvailability.status === 'out_of_stock'
                              ? colors.errorDeep
                              : colors.textMuted,
                        },
                      ]}
                    />
                    <Text
                      testID="fit-availability-text"
                      style={[
                        styles.metaValue,
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
                      {describeAvailability(
                        displayAvailability.status,
                        displayAvailability.size
                      )}
                    </Text>
                  </View>
                </View>
              )}
              {isExpanded && showCategory && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Category</Text>
                  <Text style={styles.metaValue}>{enrichedProduct!.category}</Text>
                </View>
              )}
            </View>
          )}

          {/* Action buttons — expanded only. The dock should stay
              minimal; CTAs live behind a deliberate drag-up. */}
          {isExpanded && (
          <View style={styles.actionsSection}>
            {isHistoryMode ? (
              <>
                <TouchableOpacity
                  testID="reevaluate-button"
                  style={styles.primaryButton}
                  onPress={() => {
                    wentToAvatarSetup.current = true;
                    navigation.navigate('AvatarSetup');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Re-evaluate</Text>
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
        </GestureDetector>
      </Animated.View>
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

// Confidence as a 3-segment progress bar with increasing purple saturation.
// Low  → first segment filled at light purple (0.3 alpha)
// Med  → first + second at mid alpha
// High → all three at full brand purple
// Unfilled segments sit at a very light purple tint so the track is
// always visible. Replaces the circular "Me…"-truncating chip.
function ConfidenceDonut({ level }: { level: 'high' | 'medium' | 'low' | null }) {
  if (!level) return null;
  // Arc length grows with confidence (28% / 60% / 92% of circumference) and
  // the stroke colour saturates with it (light → mid → full brand purple).
  // Rotated -90° so the fill starts from 12 o'clock and sweeps clockwise.
  const size = 48;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Arc lengths per level. `high` stops just shy of 100% (0.98) — a
  // fully-closed ring reads as "complete" which is wrong for confidence;
  // the tiny gap signals "strong but not absolute".
  const percent = level === 'high' ? 0.98 : level === 'medium' ? 0.6 : 0.28;
  const colour =
    level === 'high'
      ? 'rgba(106, 95, 117, 1)'
      : level === 'medium'
      ? 'rgba(106, 95, 117, 0.72)'
      : 'rgba(106, 95, 117, 0.45)';
  const label = level === 'high' ? 'H' : level === 'medium' ? 'M' : 'L';
  return (
    <View style={styles.confidenceDonut}>
      <Svg width={size} height={size}>
        {/* Track ring — always a full circle at very low alpha */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(106, 95, 117, 0.14)"
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
          separate label — the H/M/L maps directly to the arc length. */}
      <Text style={styles.confidenceDonutLabel}>{label}</Text>
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

  // --- Internal-scrape error card (used in URL-paste flow when the
  //     scrape fails after FitResult-internal scrape kicked off) ---
  errorCardWrap: {
    width: '85%',
    maxWidth: 360,
    padding: spacing.xl,
    borderRadius: borderRadius.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    shadowColor: '#1a1118',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  errorCardTitle: {
    ...typography.headingM,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorCardBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
    backgroundColor: 'rgba(47, 41, 55, 0.55)',
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
    backgroundColor: 'rgba(47, 41, 55, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // --- Hero (brand + product name over image) ---
  hero: {
    position: 'absolute',
    top: 0,
    left: SIDE_PAD,
    right: SIDE_PAD,
    alignItems: 'center',
  },
  heroBrand: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroName: {
    ...typography.headingXL, // DM Serif Italic lowercase, 28px, from token
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
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
    // Bumped 0.28 → 0.62 so body text (sizing note, concerns, tag
    // labels, meta rows) passes WCAG AA contrast against the busy
    // product-image backdrop. The image-through-glass feel is still
    // there, just with a firmer frost tint so text reads clearly.
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
  },
  // Wrapper around the ScrollView that receives the horizontal sift pan.
  // `flex: 1` under the card (after the handle) so the scrollable area
  // fills the remaining height.
  cardScrollWrap: {
    flex: 1,
  },
  cardScroll: {
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  // Bigger hit target around the handle bar so the drag gesture is easy
  // to grab without hitting the thin visual bar exactly.
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
    backgroundColor: 'rgba(76, 67, 86, 0.22)',
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
    ...typography.headingL, // 24px DM Serif Italic lowercase
  },
  verdictSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: 'rgba(106, 95, 117, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    marginLeft: spacing.sm,
  },
  priceText: {
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // --- Divider ---
  divider: {
    height: 1,
    backgroundColor: 'rgba(76, 67, 86, 0.12)',
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
    fontFamily: 'serif',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // Size badge — circle with the size letter/number
  statBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(106, 95, 117, 0.1)',
    borderWidth: 1.25,
    borderColor: 'rgba(106, 95, 117, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Smaller circle for the fit + stock icons (purely visual)
  fitBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 95, 117, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  statIconText: {
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '900',
  },

  // --- Confidence donut — circular arc, purple saturation + arc length
  //     both grow with confidence. Centre letter (H/M/L) is the legible
  //     label without stealing space. ---
  confidenceDonut: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceDonutLabel: {
    fontFamily: 'serif',
    position: 'absolute',
    fontSize: 13,
    fontWeight: '800',
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
    backgroundColor: 'rgba(106, 95, 117, 0.08)',
    borderRadius: borderRadius.md,
  },
  bannerSuccess: {
    backgroundColor: 'rgba(46, 125, 91, 0.1)',
  },
  bannerText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },

  // --- Sizing note ---
  noteBlock: {
    backgroundColor: 'rgba(106, 95, 117, 0.08)',
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
  sectionLabel: {
    ...typography.overline,
    color: colors.textSecondary,
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
    fontFamily: 'serif',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  concernText: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 19,
  },

  // --- Tags ---
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(106, 95, 117, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  tagText: {
    fontFamily: 'serif',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.primary,
  },

  // --- Meta ---
  metaSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(76, 67, 86, 0.1)',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  metaValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
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
  actionsSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
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
  primaryButtonText: {
    fontFamily: 'serif',
    fontSize: 15,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: 'rgba(106, 95, 117, 0.1)',
    borderRadius: borderRadius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'serif',
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostButton: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  ghostButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
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
    borderTopColor: 'rgba(76, 67, 86, 0.08)',
  },
  attributionText: {
    fontFamily: 'serif',
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.8,
  },
});
