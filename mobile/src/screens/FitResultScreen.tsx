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

type FitResultRouteProp = RouteProp<RootStackParamList, 'FitResult'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
      // Attempt enrichment but fall through to checkFit even if it fails
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
        // enrichment failed — continue with basic product data
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
    if (!avatar || !historyEntryId) return;
    setReevaluating(true);
    try {
      const fitResult = await checkFit(
        {
          id: historyEntryId,
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
          bgColor: colors.success + '15',
          icon: '✓',
          text: 'Great Fit!',
          description: 'This item should fit you well',
        };
      case 'moderate':
        return {
          color: colors.warning,
          bgColor: colors.warning + '15',
          icon: '⚠',
          text: 'Some Concerns',
          description: 'Review the warnings below',
        };
      case 'poor':
        return {
          color: colors.error,
          bgColor: colors.error + '15',
          icon: '✕',
          text: 'May Not Fit Well',
          description: 'Consider these issues carefully',
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Product Image */}
        {product.image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: product.image }} style={styles.productImage} />
          </View>
        )}

        {/* Product Info */}
        <View style={styles.productInfo}>
          {product.brand && <Text style={styles.brandText}>{product.brand}</Text>}
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
            <Text style={styles.checkedAt}>Re-evaluated today</Text>
          )}
        </View>

        {/* Re-evaluation banners (history mode only) */}
        {reevaluating && (
          <View style={styles.reevalBanner}>
            <ActivityIndicator size="small" color={colors.accentDark} />
            <Text style={styles.reevalBannerText}>Re-evaluating fit with updated profile…</Text>
          </View>
        )}
        {reevaluated && !reevaluating && (
          <View style={styles.reevalSuccessBanner}>
            <Text style={styles.reevalSuccessText}>✓ Fit re-evaluated with your updated profile</Text>
          </View>
        )}

        {/* Fit Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: scoreConfig.bgColor }]}>
          <View style={[styles.scoreIconContainer, { backgroundColor: scoreConfig.color }]}>
            <Text style={styles.scoreIcon}>{scoreConfig.icon}</Text>
          </View>
          <View style={styles.scoreTextContainer}>
            <Text style={[styles.scoreTitle, { color: scoreConfig.color }]}>
              {scoreConfig.text}
            </Text>
            <Text style={styles.scoreDescription}>
              {warnings.length === 0
                ? 'No fit concerns detected'
                : `${warnings.length} potential issue${warnings.length > 1 ? 's' : ''} found`}
            </Text>
          </View>
        </View>

        {/* Size Recommendation Card */}
        {sizeRec && (
          <View style={styles.sizeCard}>
            <View style={styles.sizeCardLeft}>
              <Text style={styles.sizeCardLabel}>Recommended Size</Text>
              <Text style={styles.sizeCardValue}>{sizeRec.size}</Text>
              {sizeRec.note && (
                <Text style={styles.sizeCardNote}>{sizeRec.note}</Text>
              )}
            </View>
            <View style={styles.sizeCardRight}>
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
                    <Text style={styles.availableText}>✓ In stock on site</Text>
                  ) : (
                    <Text style={styles.unavailableText}>⚠ Size may be unavailable</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Warnings Section */}
        {warnings.length > 0 && (
          <View style={styles.warningsSection}>
            <Text style={styles.sectionTitle}>Fit Warnings</Text>
            {warnings.map((warning, index) => {
              const config = getSeverityConfig(warning.severity);
              return (
                <View key={index} style={styles.warningCard}>
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
        {(enrichedProduct?.category || enrichedProduct?.material) && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <View style={styles.detailsCard}>
              {enrichedProduct?.category &&
                !['general', 'clothing', 'other', 'unknown'].includes(
                  enrichedProduct.category.toLowerCase()
                ) && (
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
                <View style={styles.tagsRow}>
                  <Text style={styles.detailLabel}>Tags</Text>
                  <View style={styles.tagsContainer}>
                    {enrichedProduct.tags.slice(0, 5).map((tag: string, i: number) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {isHistoryMode ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  wentToAvatarSetup.current = true;
                  navigation.navigate('AvatarSetup');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Adjust profile & re-evaluate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={openProductPage}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>View on Store</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={openProductPage}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>View on Store</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Check Another Product</Text>
              </TouchableOpacity>
            </>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  imageContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  productImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.surface,
  },
  productInfo: {
    marginBottom: spacing.lg,
  },
  brandText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  reevalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentDark + '12',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reevalBannerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  reevalSuccessBanner: {
    backgroundColor: colors.success + '12',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reevalSuccessText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '600',
  },
  scoreCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  scoreIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  scoreIcon: {
    fontSize: 24,
    color: colors.white,
    fontWeight: '700',
  },
  scoreTextContainer: {
    flex: 1,
  },
  scoreTitle: {
    ...typography.headingM,
    marginBottom: 2,
  },
  scoreDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sizeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accentDark + '40',
    ...shadows.sm,
  },
  sizeCardLeft: {
    flex: 1,
  },
  sizeCardLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sizeCardValue: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 48,
    marginBottom: 2,
  },
  sizeCardNote: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 160,
  },
  sizeCardRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
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
    width: 8,
    height: 8,
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
  warningsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.headingS,
    color: colors.text,
    marginBottom: spacing.md,
  },
  warningCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  severityText: {
    ...typography.labelSmall,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  warningText: {
    ...typography.body,
    color: colors.text,
  },
  detailsSection: {
    marginBottom: spacing.lg,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
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
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tagsRow: {
    paddingVertical: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  actionsSection: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.text,
    fontWeight: '600',
  },
});
