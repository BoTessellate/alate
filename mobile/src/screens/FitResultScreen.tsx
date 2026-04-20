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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, shadows, borderRadius, glass } from '../constants/theme';
import { sanitize } from '../utils/sanitize';
import { checkFit, enrichProduct, extractBrandFromUrl, FitWarning } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useCalibrationStore, averageCalibration } from '../store/calibrationStore';
import FitLoader from '../components/FitLoader';
import GlassCard from '../components/GlassCard';
import { captureError } from '../utils/sentry';

type FitResultRouteProp = RouteProp<RootStackParamList, 'FitResult'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 360;

const FILTERED_CATEGORIES = new Set(['general', 'clothing', 'other', 'unknown', '']);

/** Glass card style constant */
const GLASS = {
  ...glass,
  ...shadows.glass,
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
          bgColor: colors.success + '20',
          border: colors.success + '50',
          icon: '✓',
          text: 'Great Fit!',
          description: 'This item should fit you well',
        };
      case 'moderate':
        return {
          color: colors.warning,
          bgColor: colors.warning + '20',
          border: colors.warning + '50',
          icon: '⚠',
          text: 'Some Concerns',
          description: 'Review the notes below',
        };
      case 'poor':
        return {
          color: colors.error,
          bgColor: colors.error + '20',
          border: colors.error + '50',
          icon: '✕',
          text: 'May Not Fit Well',
          description: 'Consider these carefully',
        };
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'major':
        return { color: colors.error, label: 'Major', bgColor: colors.error + '15' };
      case 'moderate':
        return { color: colors.warning, label: 'Moderate', bgColor: colors.warning + '15' };
      default:
        return { color: colors.info, label: 'Minor', bgColor: colors.info + '15' };
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

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

  const showCategory = !!(enrichedProduct?.category && !FILTERED_CATEGORIES.has(enrichedProduct.category.toLowerCase()));
  const showMaterial = !!enrichedProduct?.material;
  const showTags = !!(enrichedProduct?.tags?.length);

  // ----------------------------------------------------------------
  // Derived values
  // ----------------------------------------------------------------
  const confidenceLabel = sizeRec
    ? sizeRec.confidence === 'high'
      ? 'High'
      : sizeRec.confidence === 'medium'
      ? 'Medium'
      : 'Low'
    : null;

  const confidenceColor = sizeRec
    ? sizeRec.confidence === 'high'
      ? colors.success
      : sizeRec.confidence === 'medium'
      ? colors.primary
      : colors.warning
    : colors.text;

  const inStock =
    sizeRec && product.availableSizes && product.availableSizes.length > 0
      ? product.availableSizes.includes(sizeRec.size)
      : null;

  /** Stat chip — circular accent surrounding a value with a label below.
   *  Matches the reference image's round pill spec rows.
   */
  const StatChip = ({
    label,
    value,
    subValue,
    icon,
    accent,
    testID,
  }: {
    label: string;
    value?: string | null;
    subValue?: string | null;
    icon?: React.ReactNode;
    accent?: string;
    testID?: string;
  }) => (
    <View style={styles.statChip}>
      <View
        style={[
          styles.statCircle,
          accent ? { backgroundColor: accent + '20', borderColor: accent + '40' } : null,
        ]}
      >
        {icon ? (
          icon
        ) : (
          <Text
            testID={testID}
            style={[styles.statValue, accent ? { color: accent } : null]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      {subValue && <Text style={styles.statSubValue}>{subValue}</Text>}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-bleed hero image — fixed behind the scrollable card */}
      <View style={styles.heroWrap}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Feather name="shopping-bag" size={64} color="rgba(255,255,255,0.4)" />
          </View>
        )}
        {/* Soft gradient so text reads over any image */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.15)',
            'rgba(0,0,0,0.05)',
            'rgba(0,0,0,0.3)',
          ] as readonly [string, string, string]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Title overlay near top of hero */}
        <View style={[styles.heroTitleWrap, { paddingTop: insets.top + spacing.xl }]}>
          {safeBrand && <Text style={styles.heroBrand}>{safeBrand.toUpperCase()}</Text>}
          <Text style={styles.heroTitle} numberOfLines={2}>
            {safeName || 'Product'}
          </Text>
        </View>
      </View>

      {/* Floating rounded card — bottom half */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Spacer so card starts below the hero */}
        <View style={styles.heroSpacer} />

        <View style={styles.sheet}>
          {/* Drag handle (decorative) */}
          <View style={styles.sheetHandle} />

          {/* Row 1 — score label + price */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Text testID="fit-score-label" style={[styles.scoreHero, { color: scoreConfig.color }]}>
                {scoreConfig.text}
              </Text>
              <Text style={styles.scoreSub}>
                {warnings.length === 0
                  ? 'No fit concerns'
                  : `${warnings.length} ${warnings.length === 1 ? 'concern' : 'concerns'}`}
              </Text>
            </View>
            {product.price && (
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>
                  {product.price.currency} {product.price.amount}
                </Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Row 2 — circular stat chips */}
          <View
            testID="fit-score-display"
            style={styles.statsRow}
          >
            {sizeRec && (
              <StatChip
                label="Size"
                value={sizeRec.size}
                accent={colors.primary}
                testID="recommended-size-value"
              />
            )}
            {confidenceLabel && (
              <StatChip
                label="Confidence"
                value={confidenceLabel}
                accent={confidenceColor}
              />
            )}
            <StatChip
              label="Fit"
              icon={
                <Text style={[styles.statIconText, { color: scoreConfig.color }]}>
                  {scoreConfig.icon}
                </Text>
              }
              accent={scoreConfig.color}
            />
            {inStock !== null && (
              <StatChip
                label={inStock ? 'In stock' : 'Check stock'}
                icon={
                  <Feather
                    name={inStock ? 'check' : 'alert-circle'}
                    size={20}
                    color={inStock ? colors.success : colors.warning}
                  />
                }
                accent={inStock ? colors.success : colors.warning}
              />
            )}
          </View>

          {/* Re-eval banners inline */}
          {reevaluating && (
            <View style={styles.banner}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.bannerText}>Re-evaluating with updated profile…</Text>
            </View>
          )}
          {reevaluated && !reevaluating && (
            <View style={[styles.banner, styles.bannerSuccess]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>
                Re-evaluated with your updated profile
              </Text>
            </View>
          )}

          {/* Note from size rec */}
          {sizeRec?.note && (
            <View style={styles.noteBlock}>
              <Text style={styles.noteLabel}>SIZING NOTE</Text>
              <Text style={styles.noteText}>{sizeRec.note}</Text>
            </View>
          )}

          {/* Tags */}
          {showTags && (
            <View style={styles.tagsSection}>
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

          {/* Product meta */}
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

          {/* Concerns */}
          {warnings.length > 0 && (
            <View style={styles.concernsSection}>
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

          {/* Action Buttons — inside the sheet, at the bottom */}
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
                activeOpacity={0.8}
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
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Change your measurements</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="view-on-store-button"
                style={styles.ghostButton}
                onPress={openProductPage}
                activeOpacity={0.8}
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
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>View on Store</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="check-another-button"
                style={styles.secondaryButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Check Another Product</Text>
              </TouchableOpacity>
            </>
          )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const SERIF = Platform.OS === 'ios' ? 'Times New Roman' : 'serif';
const HERO_H = Math.round(Dimensions.get('window').height * 0.45);

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

  // --- Hero (full-bleed image) ---
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_H + 40, // extra so card's rounded top overlaps
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryDark,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitleWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  heroBrand: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroTitle: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // --- Scroll + sheet ---
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSpacer: {
    height: HERO_H,
  },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28, // card rises over bottom of hero
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    minHeight: 400,
    shadowColor: 'rgba(63, 43, 84, 0.2)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(63, 43, 84, 0.25)',
    marginBottom: spacing.md,
  },

  // --- Sheet header: score hero + price ---
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetHeaderLeft: {
    flex: 1,
  },
  scoreHero: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  scoreSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  priceTag: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
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
    backgroundColor: 'rgba(63, 43, 84, 0.1)',
    marginBottom: spacing.lg,
  },

  // --- Circular stat chips row ---
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  statChip: {
    alignItems: 'center',
    flex: 1,
  },
  statCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(90, 67, 119, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(90, 67, 119, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  statIconText: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statSubValue: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  // --- Banners ---
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(90, 67, 119, 0.06)',
    borderRadius: borderRadius.md,
  },
  bannerSuccess: {
    backgroundColor: colors.success + '12',
  },
  bannerText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },

  // --- Sizing note ---
  noteBlock: {
    backgroundColor: 'rgba(90, 67, 119, 0.06)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },

  // --- Section labels ---
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // --- Tags ---
  tagsSection: {
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(90, 67, 119, 0.1)',
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

  // --- Meta (category / material) ---
  metaSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(63, 43, 84, 0.08)',
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
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },

  // --- Concerns ---
  concernsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(63, 43, 84, 0.08)',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  concernRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  concernDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  concernBody: {
    flex: 1,
  },
  concernSeverity: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  concernText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },

  // --- Action buttons ---
  actionsSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.glow,
  },
  primaryButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'rgba(90, 67, 119, 0.08)',
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ghostButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
