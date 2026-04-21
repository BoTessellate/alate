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
  interpolate,
} from 'react-native-reanimated';
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
// Card occupies 70% of the screen (test spec per user). Symmetric side
// padding maintains visual symmetry; the product image fills the rest
// above + behind the card.
const CARD_HEIGHT = Math.round(SCREEN_H * 0.7);
const SIDE_PAD = spacing.lg;

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
  const { product, url, historyEntryId, precomputed } = route.params;
  const { avatar } = useAvatarStore();
  const { addEntry, updateEntry } = useFitHistoryStore();
  const { garments: calibrationGarments } = useCalibrationStore();

  const isHistoryMode = !!historyEntryId && !!precomputed;

  const [loading, setLoading] = useState(!isHistoryMode);
  const [warnings, setWarnings] = useState<FitWarning[]>(precomputed?.warnings ?? []);
  const [fitScore, setFitScore] = useState<'great' | 'moderate' | 'poor'>(precomputed?.fitScore ?? 'great');
  const [enrichedProduct, setEnrichedProduct] = useState<{
    category?: string;
    material?: string;
    tags?: string[];
  } | null>(precomputed?.enrichedProduct ?? null);
  const [sizeRec, setSizeRec] = useState<{
    size: string;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  } | null>(precomputed?.sizeRecommendation ?? null);
  const [reevaluating, setReevaluating] = useState(false);
  const [reevaluated, setReevaluated] = useState(false);

  const wentToAvatarSetup = useRef(false);
  const prevAvatarRef = useRef(avatar);

  // Enter animation — the card rises from below and scales up, approximating
  // the history "fit pill" morphing into the full analysis box. No shared-
  // element lib needed; opacity + translateY + scale carries the feel.
  const enterProgress = useSharedValue(0);
  useEffect(() => {
    enterProgress.value = withTiming(1, { duration: 420 });
  }, []);
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [
      { translateY: interpolate(enterProgress.value, [0, 1], [80, 0]) },
      { scale: interpolate(enterProgress.value, [0, 1], [0.94, 1]) },
    ],
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

      {/* Glass info card — 70% screen, symmetric side + bottom padding, enters
          from below with opacity + scale + slide. Scroll happens inside. */}
      <Animated.View
        style={[
          styles.cardWrap,
          { bottom: insets.bottom + spacing.lg },
          cardAnimStyle,
        ]}
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

        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.handle} />

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

          {/* H2: Stats row — size / confidence / fit / stock */}
          <View testID="fit-score-display" style={styles.statsRow}>
            {sizeRec && (
              <StatChip
                label="Size"
                value={sizeRec.size}
                testID="recommended-size-value"
              />
            )}
            {confidenceLabel && (
              <StatChip label="Confidence" value={confidenceLabel} />
            )}
            <StatChip
              label="Fit"
              icon={
                <Text style={[styles.statIconText, { color: scoreConfig.color }]}>
                  {scoreConfig.icon}
                </Text>
              }
            />
            {inStock !== null && (
              <StatChip
                label={inStock ? 'In stock' : 'Check stock'}
                icon={
                  <Feather
                    name={inStock ? 'check' : 'alert-circle'}
                    size={18}
                    color={inStock ? colors.success : colors.warning}
                  />
                }
              />
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

          {/* Concerns */}
          {warnings.length > 0 && (
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

          {/* Meta rows */}
          {(showCategory || showMaterial) && (
            <View style={styles.metaSection}>
              {showCategory && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Category</Text>
                  <Text style={styles.metaValue}>{enrichedProduct!.category}</Text>
                </View>
              )}
              {showMaterial && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Material</Text>
                  <Text style={styles.metaValue}>{enrichedProduct!.material}</Text>
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
                <TouchableOpacity
                  testID="change-measurements-button"
                  style={styles.secondaryButton}
                  onPress={() => {
                    wentToAvatarSetup.current = true;
                    navigation.navigate('AvatarSetup');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Change your measurements</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="view-on-store-button"
                  style={styles.ghostButton}
                  onPress={openProductPage}
                  activeOpacity={0.75}
                >
                  <Text style={styles.ghostButtonText}>View on Store</Text>
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
    </View>
  );
}

// Circular stat chip — each stat sits in a purple-tinted ring. Uses purple
// for all accents (colour consistency). Fit score icon keeps its semantic
// colour because users need instant good/bad readability.
function StatChip({
  label,
  value,
  icon,
  testID,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.statChip}>
      <View style={styles.statCircle}>
        {icon ? (
          icon
        ) : (
          <Text testID={testID} style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
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
  cardWrap: {
    position: 'absolute',
    left: SIDE_PAD,
    right: SIDE_PAD,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xxxl,
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
    borderRadius: borderRadius.xxxl,
  },
  cardScroll: {
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(63, 43, 84, 0.22)',
    marginBottom: spacing.md,
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

  // --- Stats row (H2) ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statChip: {
    alignItems: 'center',
    flex: 1,
  },
  statCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(90, 67, 119, 0.1)',
    borderWidth: 1.25,
    borderColor: 'rgba(90, 67, 119, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  statIconText: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'center',
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
    borderRadius: borderRadius.lg,
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
    borderRadius: borderRadius.lg,
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
