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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import { checkFit, enrichProduct, extractBrandFromUrl, FitWarning } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import FitLoader from '../components/FitLoader';
import { captureError } from '../utils/sentry';
import { inferCategory } from '../utils/inferCategory';
import { Feather } from '@expo/vector-icons';

type FitResultRouteProp = RouteProp<RootStackParamList, 'FitResult'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const FILTERED_CATEGORIES = ['general', 'clothing', 'other', 'unknown'];

export default function FitResultScreen() {
  const route = useRoute<FitResultRouteProp>();
  const navigation = useNavigation<NavProp>();
  const { product, url, historyEntryId, precomputed } = route.params;
  const { avatar } = useAvatarStore();
  const { addEntry, updateEntry } = useFitHistoryStore();

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
          // If API returned a generic category, infer a better one from the product name
          const resolvedCategory = inferCategory(
            enrichResult.product.category,
            product.name,
            product.description,
          );
          const resolved = { ...enrichResult.product, category: resolvedCategory };
          setEnrichedProduct(resolved);
          enrichedData = resolved;
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

      const fitResult = await checkFit(
        {
          id: enrichedData?.id || 'temp',
          product_name: enrichedData?.name || product.name || 'Unknown Product',
          category: enrichedData?.category || 'clothing',
          material: enrichedData?.material,
          tags: enrichedData?.tags,
          description: product.description,
        },
        avatar
      );

      if (fitResult.success) {
        setWarnings(fitResult.warnings || []);
        setFitScore(fitResult.fit_score || 'great');
        setSizeRec(fitResult.size_recommendation ?? null);

        const brandInfo = extractBrandFromUrl(url);
        addEntry({
          url,
          productName: product.name || 'Unknown',
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
          brand: product.brand || brandInfo?.brandName,
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
    if (!avatar) return;
    setReevaluating(true);
    try {
      const fitResult = await checkFit(
        {
          id: historyEntryId || 'recheck',
          product_name: product.name || 'Unknown',
          category: enrichedProduct?.category || precomputed?.enrichedProduct?.category || 'clothing',
          material: enrichedProduct?.material || precomputed?.enrichedProduct?.material,
          tags: enrichedProduct?.tags || precomputed?.enrichedProduct?.tags,
        },
        avatar
      );
      if (fitResult.success) {
        const newWarnings = fitResult.warnings || [];
        const newScore = fitResult.fit_score || 'great';
        const newSizeRec = fitResult.size_recommendation ?? null;
        setWarnings(newWarnings);
        setFitScore(newScore);
        setSizeRec(newSizeRec);
        setReevaluated(true);
        if (historyEntryId) {
          updateEntry(historyEntryId, {
            warnings: newWarnings,
            fitScore: newScore,
            sizeRecommendation: newSizeRec
              ? { size: newSizeRec.size, confidence: newSizeRec.confidence, note: newSizeRec.note }
              : undefined,
          });
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

  const getScoreConfig = () => {
    switch (fitScore) {
      case 'great':
        return {
          color: colors.success,
          bgColor: colors.success + '15',
          icon: '✓' as const,
          text: 'Great Fit',
        };
      case 'moderate':
        return {
          color: colors.warning,
          bgColor: colors.warning + '15',
          icon: '⚠' as const,
          text: 'Some Concerns',
        };
      case 'poor':
        return {
          color: colors.error,
          bgColor: colors.error + '15',
          icon: '✕' as const,
          text: 'May Not Fit',
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
      <SafeAreaView style={styles.loadingSafeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <FitLoader />
      </SafeAreaView>
    );
  }

  const scoreConfig = getScoreConfig();

  // Only show product details section if there's non-generic content
  const hasProductDetails = enrichedProduct && (
    (enrichedProduct.category && !FILTERED_CATEGORIES.includes(enrichedProduct.category.toLowerCase())) ||
    enrichedProduct.material ||
    (enrichedProduct.tags && enrichedProduct.tags.length > 0)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Product Hero Image */}
        <View style={styles.imageContainer}>
          {product.image ? (
            <Image source={{ uri: product.image }} style={styles.productImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="cloud-drizzle" size={48} color={colors.accentDark} />
              <Text style={styles.imagePlaceholderText}>No image available</Text>
            </View>
          )}

          {/* Score badge overlaid on image */}
          <View style={[styles.scoreBadge, { backgroundColor: scoreConfig.color }]}>
            <Text style={styles.scoreBadgeIcon}>{scoreConfig.icon}</Text>
            <Text style={styles.scoreBadgeText}>{scoreConfig.text}</Text>
            {warnings.length > 0 && (
              <Text style={styles.scoreBadgeCount}>
                · {warnings.length} concern{warnings.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          {product.brand && (
            <Text style={styles.brandText}>
              {product.brand !== 'undefined' ? product.brand.toUpperCase() : ''}
            </Text>
          )}
          <Text style={styles.productName}>{product.name || 'Product'}</Text>
          {product.price && (
            <Text style={styles.price}>
              {product.price.currency} {product.price.amount}
            </Text>
          )}
          {isHistoryMode && precomputed?.checkedAt && !reevaluated && (
            <Text style={styles.checkedAt}>Checked {formatDate(precomputed.checkedAt)}</Text>
          )}
          {reevaluated && (
            <View style={styles.reevalChip}>
              <Feather name="refresh-cw" size={11} color={colors.success} />
              <Text style={styles.reevalChipText}>Re-evaluated today</Text>
            </View>
          )}
        </View>

        {/* Re-evaluating banner */}
        {reevaluating && (
          <View style={styles.reevalBanner}>
            <ActivityIndicator size="small" color={colors.accentDark} />
            <Text style={styles.reevalBannerText}>Re-evaluating with updated measurements…</Text>
          </View>
        )}

        {/* Size & Concerns Card — combined */}
        {sizeRec && (
          <View style={styles.glassCard}>
            {/* Size row */}
            <View style={styles.sizeRow}>
              <View style={styles.sizeLeft}>
                <Text style={styles.sizeLabel}>Recommended Size</Text>
                <Text style={styles.sizeValue}>{sizeRec.size}</Text>
                {sizeRec.note && (
                  <Text style={styles.sizeNote}>{sizeRec.note}</Text>
                )}
              </View>
              <View style={styles.sizeRight}>
                <View style={[
                  styles.confidenceBadge,
                  {
                    backgroundColor:
                      sizeRec.confidence === 'high' ? colors.primary + '18'
                      : sizeRec.confidence === 'medium' ? colors.primaryLight + '20'
                      : colors.accentDark + '22',
                  },
                ]}>
                  <View style={[
                    styles.confidenceDot,
                    {
                      backgroundColor:
                        sizeRec.confidence === 'high' ? colors.primary
                        : sizeRec.confidence === 'medium' ? colors.primaryLight
                        : colors.accentDark,
                    },
                  ]} />
                  <Text style={[
                    styles.confidenceText,
                    {
                      color:
                        sizeRec.confidence === 'high' ? colors.primary
                        : sizeRec.confidence === 'medium' ? colors.primaryLight
                        : colors.accentDark,
                    },
                  ]}>
                    {sizeRec.confidence === 'high' ? 'High confidence'
                      : sizeRec.confidence === 'medium' ? 'Medium confidence'
                      : 'Low confidence'}
                  </Text>
                </View>
                {product.availableSizes && product.availableSizes.length > 0 && (
                  <View style={styles.availabilityRow}>
                    {product.availableSizes.includes(sizeRec.size) ? (
                      <Text style={styles.availableText}>✓ In stock</Text>
                    ) : (
                      <Text style={styles.unavailableText}>⚠ May be unavailable</Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Warnings within the same card */}
            {warnings.length > 0 && (
              <>
                <View style={styles.cardDivider} />
                <Text style={styles.cardSectionLabel}>Fit Concerns</Text>
                {warnings.map((warning, index) => {
                  const config = getSeverityConfig(warning.severity);
                  return (
                    <View key={index} style={styles.warningRow}>
                      <View style={[styles.severityBadge, { backgroundColor: config.bgColor }]}>
                        <Text style={[styles.severityText, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                      <Text style={styles.warningText}>{warning.message}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* Warnings only (no size rec) */}
        {warnings.length > 0 && !sizeRec && (
          <View style={styles.glassCard}>
            <Text style={styles.cardSectionLabel}>Fit Concerns</Text>
            {warnings.map((warning, index) => {
              const config = getSeverityConfig(warning.severity);
              return (
                <View key={index} style={styles.warningRow}>
                  <View style={[styles.severityBadge, { backgroundColor: config.bgColor }]}>
                    <Text style={[styles.severityText, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </View>
                  <Text style={styles.warningText}>{warning.message}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Product Details */}
        {hasProductDetails && (
          <View style={styles.glassCard}>
            <Text style={styles.cardSectionLabel}>Product Details</Text>
            {enrichedProduct?.category &&
              !FILTERED_CATEGORIES.includes(enrichedProduct.category.toLowerCase()) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{enrichedProduct.category}</Text>
              </View>
            )}
            {enrichedProduct?.material && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Material</Text>
                <Text style={styles.detailValue}>{enrichedProduct.material}</Text>
              </View>
            )}
            {enrichedProduct?.tags && enrichedProduct.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {enrichedProduct.tags.slice(0, 5).map((tag: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons — always persistent */}
        <View style={styles.actionsSection}>
          {/* Primary: Re-evaluate */}
          <TouchableOpacity
            style={[styles.primaryButton, reevaluating && styles.buttonDisabled]}
            onPress={runReevaluation}
            disabled={reevaluating}
            activeOpacity={0.8}
          >
            {reevaluating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Feather name="refresh-cw" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>Re-evaluate</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Secondary: Change your measurements */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              wentToAvatarSetup.current = true;
              navigation.navigate('AvatarSetup');
            }}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={15} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Change your measurements</Text>
          </TouchableOpacity>

          {/* Tertiary: View on Store */}
          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={openProductPage}
            activeOpacity={0.8}
          >
            <Feather name="external-link" size={14} color={colors.textMuted} />
            <Text style={styles.tertiaryButtonText}>View on Store</Text>
          </TouchableOpacity>

          {/* Check Another (only in fresh analysis mode) */}
          {!isHistoryMode && (
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.tertiaryButtonText}>Check Another Product</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },

  // Hero image
  imageContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  productImage: {
    width: '100%',
    height: 320,
    backgroundColor: colors.backgroundSecondary,
  },
  imagePlaceholder: {
    width: '100%',
    height: 240,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  imagePlaceholderText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  scoreBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.pill,
  },
  scoreBadgeIcon: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '700',
  },
  scoreBadgeText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '700',
  },
  scoreBadgeCount: {
    ...typography.label,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  // Product info
  productInfo: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  brandText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  productName: {
    ...typography.headingL,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  price: {
    ...typography.headingM,
    color: colors.secondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  checkedAt: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reevalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    marginTop: spacing.xs,
  },
  reevalChipText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },

  // Re-eval banner
  reevalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentDark + '12',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  reevalBannerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },

  // Glass card — used for size+concerns, product details
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#402d65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },

  // Size section
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sizeLeft: {
    flex: 1,
  },
  sizeLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sizeValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 54,
    marginBottom: 2,
  },
  sizeNote: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 160,
  },
  sizeRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  confidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  confidenceText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  availabilityRow: {
    marginTop: spacing.xs,
  },
  availableText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '500',
  },
  unavailableText: {
    ...typography.bodySmall,
    color: colors.warning,
    fontWeight: '500',
  },

  // Card internals
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  cardSectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },

  // Warnings
  warningRow: {
    marginBottom: spacing.sm,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginBottom: 5,
  },
  severityText: {
    ...typography.labelSmall,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  warningText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },

  // Product details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primaryLight + '25',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },

  // Action buttons
  actionsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cta,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    shadowColor: colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.primary,
    fontWeight: '600',
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  tertiaryButtonText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
