import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
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
// expo-blur — we tried @react-native-community/blur for higher-fidelity
// Android glass (Dimezis BlurView wrapper), but v4.4.1 pulls a newer
// eightbitlab:blurview AAR than it was built against, causing a runtime
// NoSuchMethodError (`setupWith(ViewGroup)` signature changed in v2.0)
// when the first BlurView mounts — plus its ViewManagerPropertyUpdater
// isn't Fabric-ready. Sticking with expo-blur: native RenderEffect on
// Android 12+, tinted fallback below. The heavier tint + hairline edge
// border carries the glass read where the blur degrades.
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import { sanitize } from '../utils/sanitize';
import { checkFit, enrichProduct, extractBrandFromUrl, FitWarning } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useCalibrationStore, averageCalibration } from '../store/calibrationStore';
import FitLoader from '../components/FitLoader';
import { captureError } from '../utils/sentry';

type FitResultRouteProp = RouteProp<RootStackParamList, 'FitResult'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Expanded card occupies 70% of screen with symmetric side + bottom
// padding. Collapsed card docks at the screen bottom (full width, no
// padding, rounded top corners only) and is short enough to show just
// the verdict + price + stats row; fit concerns are hidden at that
// point. The user drags the handle up/down to switch.
const EXPANDED_H = Math.round(SCREEN_H * 0.7);
const COLLAPSED_H = 290;
const SIDE_PAD = spacing.lg;
const SWIPE_THRESHOLD = 80; // px of horizontal drag before sift fires

const FILTERED_CATEGORIES = new Set(['general', 'clothing', 'other', 'unknown', '']);

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
const formatPrice = (price?: { amount: number; currency: string }) => {
  if (!price) return null;
  if (typeof price.amount !== 'number' || !Number.isFinite(price.amount)) return null;
  const sym = CURRENCY_SYMBOLS[price.currency] || `${price.currency} `;
  return `${sym}${price.amount}`;
};

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
  const { addEntry, updateEntry } = useFitHistoryStore();
  const { garments: calibrationGarments } = useCalibrationStore();

  // When we navigated in from History with a siblings list, the user can
  // swipe horizontally to sift through products without going back.
  const canSift = !!historyEntries && historyEntries.length > 1;
  const [localIndex, setLocalIndex] = useState(currentIndex);
  const activeEntry = canSift ? historyEntries![localIndex] : null;

  // Effective route-derived values. Either come from the swiped-to entry
  // (history+sift mode) or direct route params (live mode).
  const product = activeEntry
    ? {
        name: activeEntry.productName,
        image: activeEntry.productImage,
        price: activeEntry.price,
        brand: activeEntry.brand,
      }
    : routeProduct;
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

  // Vertical drag on the handle toggles collapse. 300px of drag = full
  // transition; snap to 0 or 1 on release based on the midpoint.
  const dragGesture = Gesture.Pan()
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

  // Horizontal drag on the content sifts to the next/prev entry. Uses
  // activeOffsetX so vertical motion still goes to the ScrollView inside
  // (otherwise pan would swallow scroll gestures).
  const swipeX = useSharedValue(0);
  const siftGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      // Dampened follow so the user feels the drag but doesn't overshoot.
      swipeX.value = e.translationX * 0.4;
    })
    .onEnd((e) => {
      const entriesLen = historyEntries?.length ?? 0;
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
      let enrichedData: { id?: string; name?: string; category?: string; material?: string; tags?: string[] } | null = null;
      try {
        const enrichResult = await enrichProduct({
          name: product.name || 'Unknown Product',
          image_url: product.image,
          description: product.description,
          price: product.price?.amount,
          currency: product.price?.currency,
        });
        if (enrichResult.success && enrichResult.product) {
          setEnrichedProduct(enrichResult.product);
          enrichedData = enrichResult.product;
        } else {
          captureError(new Error('Enrichment returned success:false'), {
            feature: 'product-enrichment',
            productName: product.name,
            url,
          });
        }
      } catch (enrichError) {
        captureError(enrichError, {
          feature: 'product-enrichment',
          productName: product.name,
          url,
        });
      }

      const calibration = averageCalibration(calibrationGarments);
      const fitResult = await checkFit(
        {
          id: enrichedData?.id || 'temp',
          product_name: enrichedData?.name || product.name || 'Unknown Product',
          category: enrichedData?.category || 'clothing',
          material: enrichedData?.material,
          tags: enrichedData?.tags,
          description: product.description,
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
        const safeBrand = sanitize(product.brand) || brandInfo?.brandName;
        const safeName = sanitize(product.name) || 'Unknown';

        addEntry({
          url,
          productName: safeName,
          productImage: product.image,
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
          price: product.price
            ? { amount: product.price.amount, currency: product.price.currency }
            : undefined,
          brand: safeBrand,
        });
      }
    } catch (error) {
      console.error('Fit analysis failed:', error);
      captureError(error, { feature: 'fit-analysis', productName: product.name, url });
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
          product_name: product.name || 'Unknown',
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
    switch (fitScore) {
      case 'great':
        return {
          color: colors.success,
          icon: '✓',
          text: 'Great Fit!',
        };
      case 'moderate':
        return {
          color: colors.warning,
          icon: '⚠',
          text: 'Some Concerns',
        };
      case 'poor':
        return {
          color: colors.error,
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
        <FitLoader />
      </View>
    );
  }

  const scoreConfig = getScoreConfig();
  const safeBrand = sanitize(product.brand);
  const safeName = sanitize(product.name);
  const priceDisplay = formatPrice(product.price);

  const showCategory = !!(enrichedProduct?.category && !FILTERED_CATEGORIES.has(enrichedProduct.category.toLowerCase()));
  const showMaterial = !!enrichedProduct?.material;
  const showTags = !!(enrichedProduct?.tags?.length);

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
          intensity={90}
          tint="light"
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod="dimezisBlurView"
        />
        {/* Layered tint does the glass heavy-lifting on Android where blur
            may degrade to a passthrough view. Inner border catches "light"
            on the edge; outer tint keeps text legible over busy images. */}
        <View style={styles.cardTint} pointerEvents="none" />

        {/* Drag handle — vertical pan toggles collapse. Bigger hit target
            than the thin bar so it's easy to grab. */}
        <GestureDetector gesture={dragGesture}>
          <View style={styles.handleHit}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <GestureDetector gesture={siftGesture}>
          <Animated.View style={[styles.cardScrollWrap, siftStyle]}>
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardContent}
              showsVerticalScrollIndicator={false}
            >

          {/* H1: Fit verdict — biggest element in the card. Sets the answer
              the user came here for before anything else. */}
          <View style={styles.verdictRow}>
            <View style={styles.verdictMain}>
              <Text testID="fit-score-label" style={[styles.verdictText, { color: scoreConfig.color }]}>
                {scoreConfig.text}
              </Text>
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

          {/* H2: Stats row — size badge + confidence bar + fit icon. Labels
              dropped because they overflowed the circular chips ("Me…")
              and stacked labels underneath; each element is now self-
              descriptive (letter / progress segments / semantic icon). */}
          <View testID="fit-score-display" style={styles.statsRow}>
            {sizeRec && (
              <StatBadge value={sizeRec.size} testID="recommended-size-value" />
            )}
            <ConfidenceBar level={sizeRec?.confidence ?? null} />
            <View style={styles.fitBadge}>
              <Text style={[styles.statIconText, { color: scoreConfig.color }]}>
                {scoreConfig.icon}
              </Text>
            </View>
            {inStock !== null && (
              <View style={styles.fitBadge}>
                <Feather
                  name={inStock ? 'check' : 'alert-circle'}
                  size={18}
                  color={inStock ? colors.success : colors.warning}
                />
              </View>
            )}
          </View>

          {/* Re-eval banners */}
          {reevaluating && (
            <View style={styles.banner}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.bannerText}>Re-evaluating with updated profile…</Text>
            </View>
          )}
          {reevaluated && !reevaluating && (
            <View style={[styles.banner, styles.bannerSuccess]}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>
                Re-evaluated with your updated profile
              </Text>
            </View>
          )}

          {/* Sizing note */}
          {sizeRec?.note && (
            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>SIZING NOTE</Text>
              <Text style={styles.noteText}>{sizeRec.note}</Text>
            </View>
          )}

          {/* Concerns — only render when the card is expanded. When the user
              drags the handle down to collapse, this section disappears and
              the card shrinks to show just the verdict + stats + meta/tags.
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

          {/* Tags */}
          {showTags && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TAGS</Text>
              <View style={styles.tagsContainer}>
                {enrichedProduct!.tags!.slice(0, 6).map((tag: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.toLowerCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Meta rows — Material first, then Category (swapped per UX ask) */}
          {(showCategory || showMaterial) && (
            <View style={styles.metaSection}>
              {showMaterial && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Material</Text>
                  <Text style={styles.metaValue}>{enrichedProduct!.material}</Text>
                </View>
              )}
              {showCategory && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Category</Text>
                  <Text style={styles.metaValue}>{enrichedProduct!.category}</Text>
                </View>
              )}
            </View>
          )}

          {/* Action buttons */}
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
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
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
function ConfidenceBar({ level }: { level: 'high' | 'medium' | 'low' | null }) {
  if (!level) return null;
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  const fillColours = [
    'rgba(90, 67, 119, 0.35)',
    'rgba(90, 67, 119, 0.65)',
    'rgba(90, 67, 119, 1.0)',
  ];
  return (
    <View style={styles.confidenceBar}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.confidenceSegment,
            {
              backgroundColor:
                i < filled ? fillColours[i] : 'rgba(90, 67, 119, 0.08)',
            },
          ]}
        />
      ))}
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
  backBtn: {
    position: 'absolute',
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.32)',
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
    shadowColor: '#1a0f28',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.48,
    shadowRadius: 28,
    elevation: 18,
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
    // Heavier than with a real-blur lib because expo-blur's Android fall-
    // back can be a passthrough view on older/edge-case devices. 0.45 keeps
    // the image tint readable through the tint. Hairline inner border
    // simulates the light-catching edge of real frosted glass.
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
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
    backgroundColor: 'rgba(63, 43, 84, 0.22)',
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
    backgroundColor: 'rgba(90, 67, 119, 0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    marginLeft: spacing.sm,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // --- Divider ---
  divider: {
    height: 1,
    backgroundColor: 'rgba(63, 43, 84, 0.12)',
    marginBottom: spacing.md,
  },

  // --- Stats row (H2) — labels removed; each element is self-descriptive ---
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  // Size badge — circle with the size letter/number
  statBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(90, 67, 119, 0.1)',
    borderWidth: 1.25,
    borderColor: 'rgba(90, 67, 119, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Smaller circle for the fit + stock icons (purely visual)
  fitBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(90, 67, 119, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  statIconText: {
    fontSize: 18,
    fontWeight: '900',
  },

  // --- Confidence bar — 3 segments, purple saturation increases with level ---
  confidenceBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 8,
    alignItems: 'center',
  },
  confidenceSegment: {
    flex: 1,
    height: 8,
    borderRadius: borderRadius.pill,
  },

  // --- Banners ---
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(90, 67, 119, 0.08)',
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
    backgroundColor: 'rgba(90, 67, 119, 0.08)',
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
    backgroundColor: 'rgba(90, 67, 119, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.primary,
  },

  // --- Meta ---
  metaSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(63, 43, 84, 0.1)',
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
    fontSize: 15,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: 'rgba(90, 67, 119, 0.1)',
    borderRadius: borderRadius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
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
});
