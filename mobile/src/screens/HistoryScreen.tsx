import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, ms } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import GradientBackground from '../components/GradientBackground';
import { sanitize } from '../utils/sanitize';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'History'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { entries, removeEntry, clearHistory } = useFitHistoryStore();

  const getScoreConfig = (score: 'great' | 'moderate' | 'poor') => {
    switch (score) {
      case 'great':
        return {
          color: colors.success,
          bgColor: colors.success + '15',
          label: 'Great Fit',
          icon: '✓',
        };
      case 'moderate':
        return {
          color: colors.warning,
          bgColor: colors.warning + '15',
          label: 'Some Concerns',
          icon: '⚠',
        };
      case 'poor':
        return {
          color: colors.error,
          bgColor: colors.error + '15',
          label: 'May Not Fit',
          icon: '✕',
        };
      default:
        return {
          color: colors.textSecondary,
          bgColor: colors.backgroundSecondary,
          label: 'Unknown',
          icon: '?',
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatPrice = (price?: { amount: number; currency: string }) => {
    if (!price) return null;
    const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
    const symbol = symbols[price.currency] || `${price.currency} `;
    return `${symbol}${price.amount}`;
  };

  // Confidence uses the brand palette: high = deep brand purple,
  // medium = mid purple, low = a lighter but still legible shade.
  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return colors.primary;
      case 'medium':
        return colors.primaryLight;
      case 'low':
        return colors.accentDark;
    }
  };

  const FILTERED_CATEGORIES = new Set(['general', 'clothing', 'other', 'unknown', '']);

  const renderItem = ({ item, index }: { item: FitHistoryEntry; index: number }) => {
    const scoreConfig = getScoreConfig(item.fitScore);
    const priceText = formatPrice(item.price);
    const safeBrand = sanitize(item.brand);
    const safeName = sanitize(item.productName) ?? 'Unknown Product';
    const safeCategory = sanitize(item.category);
    const showCategory = safeCategory && !FILTERED_CATEGORIES.has(safeCategory.toLowerCase());
    const hasBrandOrPrice = safeBrand || priceText;

    return (
      <TouchableOpacity
        testID={`history-entry-${index}`}
        onPress={() => navigation.navigate('FitResult', {
          product: {
            name: item.productName,
            image: item.productImage,
            price: item.price,
            brand: item.brand,
          },
          url: item.url,
          historyEntryId: item.id,
          precomputed: {
            fitScore: item.fitScore,
            warnings: item.warnings,
            sizeRecommendation: item.sizeRecommendation,
            enrichedProduct: {
              category: item.category,
              material: item.material,
              tags: item.tags,
            },
            checkedAt: item.checkedAt,
          },
        })}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.card}>
        <View style={styles.cardImageContainer}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Feather name="shopping-bag" size={28} color={colors.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          {hasBrandOrPrice && (
            <View style={styles.brandRow}>
              {safeBrand && <Text style={styles.brandText}>{safeBrand}</Text>}
              {safeBrand && priceText && <Text style={styles.dotSeparator}>•</Text>}
              {priceText && <Text style={styles.priceText}>{priceText}</Text>}
            </View>
          )}
          <Text style={styles.productName} numberOfLines={2}>
            {safeName}
          </Text>

          <View style={styles.pillRow}>
            {item.sizeRecommendation && (
              <View style={[styles.pill, styles.sizePill]}>
                <Text style={styles.sizePillLabel}>Size {item.sizeRecommendation.size}</Text>
                <View
                  style={[
                    styles.confidenceDot,
                    { backgroundColor: getConfidenceColor(item.sizeRecommendation.confidence) },
                  ]}
                />
              </View>
            )}
            {showCategory && (
              <View style={[styles.pill, styles.categoryPill]}>
                <Text style={styles.categoryPillLabel} numberOfLines={1}>
                  {safeCategory}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.scoreRow}>
              <View style={[styles.scoreDot, { backgroundColor: scoreConfig.color }]} />
              <Text style={[styles.scoreLabel, { color: scoreConfig.color }]}>
                {scoreConfig.label}
              </Text>
              <Text style={styles.dateSep}>·</Text>
              <Text style={styles.dateText}>{formatDate(item.checkedAt)}</Text>
            </View>
            {item.warnings.length > 0 && (
              <Text style={styles.warningCount}>
                {item.warnings.length} concern{item.warnings.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeEntry(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteText}>×</Text>
        </TouchableOpacity>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  if (entries.length === 0) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
          <View testID="history-screen" style={styles.emptyContainer}>
            <Text style={styles.pageTitle}>History</Text>
            <View style={styles.emptyIconContainer}>
              <Feather name="clock" size={36} color={colors.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>No fit checks yet</Text>
            <Text style={styles.emptySubtitle}>
              Check some products to build your{'\n'}personalized fit history
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View testID="history-screen" style={styles.container}>
        {/* Page Title */}
        <Text style={styles.pageTitle}>History</Text>

        {/* Header Stats */}
        <View style={styles.statsContainer}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statNumber}>{entries.length}</Text>
            <Text style={styles.statLabel}>Checked</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {entries.filter((e) => e.fitScore === 'great').length}
            </Text>
            <Text style={styles.statLabel}>Great Fits</Text>
          </GlassCard>
        </View>

        {/* List */}
        <FlatList
          testID="history-list"
          data={entries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        {/* Clear Button */}
        {entries.length > 0 && (
          <View style={styles.clearContainer}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                Alert.alert(
                  'Clear History',
                  'This will delete all your fit check history. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear All', style: 'destructive', onPress: clearHistory },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearText}>Clear All History</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pageTitle: {
    ...typography.headingXL,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.headingL,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardImageContainer: {
    marginRight: spacing.md,
  },
  thumbnail: {
    width: ms(70),
    height: ms(70),
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
  },
  thumbnailPlaceholder: {
    width: ms(70),
    height: ms(70),
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(2),
  },
  brandText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dotSeparator: {
    ...typography.labelSmall,
    color: colors.textMuted,
    marginHorizontal: ms(6),
  },
  priceText: {
    ...typography.labelSmall,
    color: colors.secondary,
    fontWeight: '700',
  },
  productName: {
    ...typography.labelLarge,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(6),
    marginBottom: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: ms(4),
    borderRadius: borderRadius.pill,
    gap: ms(4),
  },
  pillIcon: {
    fontSize: ms(11),
    fontWeight: '700',
  },
  pillLabel: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  sizePill: {
    backgroundColor: colors.primary + '15',
  },
  sizePillLabel: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  confidenceDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
  },
  categoryPill: {
    backgroundColor: colors.backgroundTertiary,
    maxWidth: ms(110),
  },
  categoryPillLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
  },
  scoreDot: {
    width: ms(7),
    height: ms(7),
    borderRadius: ms(4),
  },
  scoreLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  dateSep: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  warningCount: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '500',
  },
  deleteButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  deleteText: {
    fontSize: ms(20),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconContainer: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(40),
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.headingM,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  clearContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearButton: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.lg,
  },
  clearText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },
});
