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
import { colors, spacing, typography, shadows, borderRadius, ms } from '../constants/theme';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'History'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const FILTERED_CATEGORIES = ['general', 'clothing', 'other', 'unknown'];

export default function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { entries, removeEntry, clearHistory } = useFitHistoryStore();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatPrice = (price?: { amount: number; currency: string }) => {
    if (!price) return null;
    const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
    const symbol = symbols[price.currency] || `${price.currency} `;
    return `${symbol}${price.amount}`;
  };

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return colors.primary;
      case 'medium': return colors.primaryLight;
      case 'low': return colors.accentDark;
    }
  };

  const renderItem = ({ item }: { item: FitHistoryEntry }) => {
    const priceText = formatPrice(item.price);
    const hasBrandOrPrice = item.brand && item.brand !== 'undefined' && item.brand !== 'null';

    // Filter out generic/useless categories
    const displayCategory =
      item.category && !FILTERED_CATEGORIES.includes(item.category.toLowerCase())
        ? item.category
        : null;

    const concernCount = item.warnings?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
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
        <View style={styles.cardImageContainer}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Feather name="cloud-drizzle" size={24} color={colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          {(hasBrandOrPrice || priceText) && (
            <View style={styles.brandRow}>
              {hasBrandOrPrice && (
                <Text style={styles.brandText}>{item.brand!.toUpperCase()}</Text>
              )}
              {hasBrandOrPrice && priceText && (
                <Text style={styles.dotSeparator}>•</Text>
              )}
              {priceText && <Text style={styles.priceText}>{priceText}</Text>}
            </View>
          )}

          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>

          {/* Tags: [Size] [Category] — in that order */}
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
            {displayCategory && (
              <View style={[styles.pill, styles.categoryPill]}>
                <Text style={styles.categoryPillLabel} numberOfLines={1}>
                  {displayCategory}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.dateText}>{formatDate(item.checkedAt)}</Text>
            {concernCount > 0 && (
              <Text style={styles.concernCount}>
                {concernCount} concern{concernCount > 1 ? 's' : ''}
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
      </TouchableOpacity>
    );
  };

  if (entries.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
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
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View testID="history-screen" style={styles.container}>
        <Text style={styles.pageTitle}>History</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{entries.length}</Text>
            <Text style={styles.statLabel}>Checked</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {entries.filter((e) => e.fitScore === 'great').length}
            </Text>
            <Text style={styles.statLabel}>Great Fits</Text>
          </View>
        </View>

        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  cardImageContainer: {
    marginRight: spacing.md,
  },
  thumbnail: {
    width: ms(70),
    height: ms(70),
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
  },
  thumbnailPlaceholder: {
    width: ms(70),
    height: ms(70),
    borderRadius: borderRadius.lg,
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
  dateText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  concernCount: {
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
    backgroundColor: colors.white,
  },
  clearButton: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.xl,
  },
  clearText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },
});
