import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, ms, fontFamily } from '../constants/theme';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import HistoryCoverFlow from '../components/HistoryCoverFlow';
import FitDetailBar from '../components/FitDetailBar';
import HeadingImage from '../components/HeadingImage';
import ConfirmDialog from '../components/ConfirmDialog';

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
  const { entries, addEntry, clearHistory, removeEntry } = useFitHistoryStore();
  // Count of entries scored 'great' — surfaced in the header meta so the
  // subtitle carries real signal ("3 good fits") instead of the redundant
  // "swipe through to revisit" instruction the coverflow already implies.
  const goodFits = entries.filter((e) => e.fitScore === 'great').length;

  // Delete confirmation — themed via ConfirmDialog instead of the
  // native Alert popup, which broke visual continuity with the rest
  // of the app's grey-purple glass aesthetic. State holds the entry
  // pending deletion so we can read its name in the dialog message.
  const [pendingDelete, setPendingDelete] = useState<FitHistoryEntry | null>(null);
  const [pendingClearAll, setPendingClearAll] = useState(false);

  const handleCardDelete = (item: FitHistoryEntry) => {
    setPendingDelete(item);
  };
  const confirmCardDelete = () => {
    if (pendingDelete) {
      removeEntry(pendingDelete.id);
      setPendingDelete(null);
    }
  };
  const cancelCardDelete = () => setPendingDelete(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const seedDemoData = () => {
    SEED_ENTRIES.forEach((e) => addEntry(e));
  };

  const activeEntry =
    entries.length > 0 ? entries[Math.min(activeIndex, entries.length - 1)] : null;

  const handleCardTap = (item: FitHistoryEntry) => {
    const startIndex = entries.findIndex((e) => e.id === item.id);
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
      // Pass the whole list + starting index so FitResult can let the user
      // horizontally swipe through siblings without going back to History.
      historyEntries: entries,
      currentIndex: startIndex >= 0 ? startIndex : 0,
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
        {/* Page title + slim stats pill under it. TAN Nightingale SVG
            via HeadingImage falls back to styled text if missing. */}
        <View style={styles.header}>
          <HeadingImage
            slot="history"
            fallback="your history"
            height={60}
            color={colors.text}
            textStyle={styles.pageTitle}
          />
          <Text style={styles.headerMeta}>
            {entries.length} {entries.length === 1 ? 'item' : 'items'} · {goodFits} good {goodFits === 1 ? 'fit' : 'fits'}
          </Text>
        </View>

        {/* Vision Pro song-shuffle-style deck — occupies the full area below
            the header. Detail bar + clear link FLOAT on top of it so they
            don't steal vertical space that the elongated cards need. */}
        <HistoryCoverFlow
          entries={entries}
          onCardTap={handleCardTap}
          onCardDelete={handleCardDelete}
          onActiveIndexChange={setActiveIndex}
        />

        {/* Floating footer: detail pill + clear link. Absolute-positioned so
            the cover flow underneath uses the full height, and card images
            don't get cropped to make room. `pointerEvents="box-none"` lets
            scroll gestures pass through the empty area around the pill. */}
        <View style={styles.floatingFooter} pointerEvents="box-none">
          <View style={styles.detailBarWrap}>
            <FitDetailBar entry={activeEntry} />
          </View>

          {entries.length > 0 && (
            <TouchableOpacity
              style={styles.clearLink}
              onPress={() => setPendingClearAll(true)}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.clearLinkText}>Clear history</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Themed delete-product confirmation — replaces the native
            Alert popup so the dialog visually matches the rest of the
            app's grey-purple glass aesthetic. */}
        <ConfirmDialog
          visible={!!pendingDelete}
          title="Remove from history?"
          confirmLabel="Remove"
          icon="trash-2"
          confirmTestID="confirm-delete-history-entry"
          onConfirm={confirmCardDelete}
          onCancel={cancelCardDelete}
        />

        {/* Themed clear-all confirmation — same visual language as the
            single-entry remove. */}
        <ConfirmDialog
          visible={pendingClearAll}
          title="Clear all fit history?"
          confirmLabel="Clear all"
          icon="alert-triangle"
          confirmTestID="confirm-clear-history"
          onConfirm={() => {
            clearHistory();
            setPendingClearAll(false);
          }}
          onCancel={() => setPendingClearAll(false)}
        />
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
  // Header — left-aligned per Claude Design mockup. Title is DM Serif
  // italic lowercase via displayMedium; subtitle sits tight under it
  // (marginTop 4) in plain body 13px, textMuted, no letter-spacing.
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  pageTitle: {
    ...typography.displayMedium,
    color: colors.text,
  },
  headerMeta: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: 4,
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

  // --- Floating footer overlay (pill + clear link above the floating
  //     tab bar). Dropped 100 → 72 so the detail pill isn't directly
  //     touching the bottom of the product card — there's a visible gap
  //     between the cover-flow card edge and the pill now, per user
  //     feedback. Still sits clearly above the tab pill (which starts
  //     at insets.bottom + 24 + 64 ≈ 88 from the bottom). ---
  floatingFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    alignItems: 'center',
  },
  detailBarWrap: {
    paddingBottom: spacing.xs,
  },

  // --- Clear link — muted underline tap target; destructive intent is
  //     reserved for the confirmation Alert, not the surface styling. ---
  clearLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  clearLinkText: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
    letterSpacing: 0.6,
  },
});
