import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, ms } from '../constants/theme';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import HistoryCoverFlow from '../components/HistoryCoverFlow';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'History'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// --- Dev-only seed data so we can preview the stack/receipt without the
// backend fit-check flow. Safe to leave behind __DEV__ guard.
const SEED_ENTRIES: Omit<FitHistoryEntry, 'id'>[] = [
  {
    url: 'https://www.asos.com/asos-design/asos-design-mini-t-shirt-dress-in-black/prd/206421568',
    productName: 'Mini t-shirt dress with scoop neck in black',
    productImage:
      'https://images.asos-media.com/products/asos-design-mini-t-shirt-dress-with-scoop-neck-in-black/206421568-1-black',
    brand: 'ASOS',
    fitScore: 'great',
    warnings: [],
    checkedAt: new Date().toISOString(),
    sizeRecommendation: { size: 'M', confidence: 'high', note: 'True to size' },
    category: 'dress',
    material: 'Cotton blend',
    tags: ['casual', 'summer', 'minimal'],
    price: { amount: 22, currency: 'GBP' },
  },
  {
    url: 'https://www.uniqlo.com/uk/en/products/E470303-000/00',
    productName: 'Broadcloth Striped Button-Down Shirt',
    productImage:
      'https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/470303/item/goods_64_470303_3x4.jpg',
    brand: 'UNIQLO',
    fitScore: 'moderate',
    warnings: [
      { severity: 'moderate', message: 'Shoulders may run slightly wide for your frame.' },
    ],
    checkedAt: new Date(Date.now() - 86400000).toISOString(),
    sizeRecommendation: { size: 'S', confidence: 'medium' },
    category: 'shirt',
    material: '100% Cotton',
    tags: ['workwear', 'classic', 'striped'],
    price: { amount: 29.9, currency: 'GBP' },
  },
  {
    url: 'https://www.zara.com/uk/en/linen-blend-trousers-p04387025.html',
    productName: 'Linen Blend Wide-Leg Trousers',
    productImage:
      'https://static.zara.net/assets/public/c4b1/f0e3/2ef848a4a93e/29dc5c89d5f0/04387025712-a1/04387025712-a1.jpg',
    brand: 'ZARA',
    fitScore: 'poor',
    warnings: [
      { severity: 'major', message: 'Waist is cut for a looser silhouette than your profile.' },
      { severity: 'minor', message: 'Linen fabric stretches over time — size down if between.' },
    ],
    checkedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    sizeRecommendation: { size: 'XS', confidence: 'low', note: 'Consider tailoring' },
    category: 'trousers',
    material: 'Linen blend',
    tags: ['summer', 'flowy', 'high-rise'],
    price: { amount: 45.99, currency: 'GBP' },
  },
];

export default function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { entries, addEntry, clearHistory } = useFitHistoryStore();

  const seedDemoData = () => {
    SEED_ENTRIES.forEach((e) => addEntry(e));
  };

  const handleCardTap = (item: FitHistoryEntry) => {
    navigation.navigate('FitResult', {
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
    });
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
          {__DEV__ && (
            <TouchableOpacity
              onPress={seedDemoData}
              style={styles.seedButton}
              activeOpacity={0.8}
            >
              <Text style={styles.seedButtonText}>Load demo data (dev)</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View testID="history-screen" style={styles.container}>
        {/* Page title + slim stats pill under it */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>History</Text>
          <Text style={styles.headerMeta}>
            {entries.length} checked
            {entries.filter((e) => e.fitScore === 'great').length > 0 &&
              ` · ${entries.filter((e) => e.fitScore === 'great').length} great fit${
                entries.filter((e) => e.fitScore === 'great').length > 1 ? 's' : ''
              }`}
          </Text>
        </View>

        {/* iPod Cover Flow-style horizontal carousel */}
        <HistoryCoverFlow
          entries={entries}
          onCardTap={handleCardTap}
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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  pageTitle: {
    ...typography.headingXL,
    color: colors.text,
    textAlign: 'center',
  },
  headerMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
  },

  // --- Apple Weather-style cards ---
  card: {
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    height: ms(220),
  },
  cardBg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cardBgImage: {
    borderRadius: borderRadius.xxl,
  },
  cardPlaceholderBg: {
    backgroundColor: colors.backgroundTertiary,
  },
  cardGradient: {
    flex: 1,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    flex: 1,
  },
  brandPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  brandText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pricePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  priceText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
  },
  deleteButton: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  cardSpacer: {
    flex: 1,
  },
  placeholderIcon: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },
  productName: {
    ...typography.headingS,
    color: '#fff',
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardFooter: {},
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(6),
    marginBottom: ms(6),
  },
  sizePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  sizePillLabel: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
  },
  confidenceDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  scoreDot: {
    width: ms(7),
    height: ms(7),
    borderRadius: ms(4),
  },
  scoreLabel: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
  },
  warningCount: {
    ...typography.caption,
    color: colors.warningLight,
    fontWeight: '500',
  },

  // --- Empty state ---
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
  seedButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary,
    opacity: 0.75,
  },
  seedButtonText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },

  // --- Clear button ---
  clearContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
