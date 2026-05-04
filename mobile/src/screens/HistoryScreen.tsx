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
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, ms, fontFamily, whiteAlpha, textAlpha } from '../constants/theme';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import { usePriceRange } from '../store/priceRangeStore';
import { computeAffordability } from '../utils/affordability';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import HistoryCoverFlow from '../components/HistoryCoverFlow';
import FitDetailBar from '../components/FitDetailBar';
import HeadingImage from '../components/HeadingImage';
import { computeEffectiveFitScore } from '../utils/effectiveFitScore';
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

// Fit-score priority for the history sort. Lower = surfaces first.
// Order is great → minor → moderate → poor so the cover flow opens
// on the user's wins (great + minor read as positive verdicts), then
// works through concerns. Keyed by EFFECTIVE score (see
// utils/effectiveFitScore.ts) so a minor-only entry doesn't end up
// in the moderate bucket just because the backend labelled it as
// such.
const EFFECTIVE_PRIORITY: Record<'great' | 'minor' | 'moderate' | 'poor', number> = {
  great: 0,
  minor: 1,
  moderate: 2,
  poor: 3,
};

export default function HistoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { entries: storeEntries, addEntry, clearHistory, removeEntry } = useFitHistoryStore();

  // Sort the store's entries for display. Primary key is the
  // EFFECTIVE fit-score (great→minor→moderate→poor) so the cover
  // flow groups verdicts the way the user actually reads them — a
  // "Great Fit, with a note" sits with great fits, not with concerns.
  // Secondary key is checkedAt desc so within each group the most-
  // recent check surfaces first.
  //
  // The store keeps insertion order (newest first) — we don't mutate
  // it, just produce a sorted view here. Per user feedback April 29
  // 2026: dummy data was inserted in good→concerns→poor order which
  // happened to look right; real data inserts in time order and
  // therefore appeared unsorted to the eye.
  const entries = React.useMemo(() => {
    const effective = (e: FitHistoryEntry) =>
      computeEffectiveFitScore(e.warnings, e.fitScore);
    return [...storeEntries].sort((a, b) => {
      const pri = EFFECTIVE_PRIORITY[effective(a)] - EFFECTIVE_PRIORITY[effective(b)];
      if (pri !== 0) return pri;
      // Same fit group → newer first (descending checkedAt).
      return b.checkedAt.localeCompare(a.checkedAt);
    });
  }, [storeEntries]);

  // Count of entries that read as a positive verdict — great PLUS
  // minor (which is "great with a note", not a concern). Surfaced in
  // the header meta so the subtitle carries real signal.
  const goodFits = entries.filter((e) => {
    const eff = computeEffectiveFitScore(e.warnings, e.fitScore);
    return eff === 'great' || eff === 'minor';
  }).length;

  // Within-budget tally — only meaningful once the user has set a price
  // range on the profile. Counts entries whose computed affordability
  // exists AND isn't flagged overBudget. Currency-mismatched entries are
  // excluded (they can't be compared to the range).
  const priceRange = usePriceRange();
  const rangeConfigured = priceRange.min !== null && priceRange.max !== null;
  const withinBudget = rangeConfigured
    ? entries.filter((e) => {
        const r = computeAffordability(e.price, priceRange);
        return r !== null && !r.overBudget;
      }).length
    : 0;

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
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {/* Brand grey-purple ombre — same gradient as Home / Account
            / FitResult hero. Per user direction April 29 2026: the
            History tab read flat against the rest of the app's
            atmospheric backdrop. May 3 2026 PM: angle flipped to
            top-RIGHT light → bottom-LEFT deep so the `headerMeta`
            line in the top-left passes WCAG contrast — see
            HomeScreen for the full rationale. */}
        <LinearGradient
          colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
          locations={[0, 0.3, 0.6, 0.9]}
          start={{ x: 1, y: 0.05 }}
          end={{ x: 0.1, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />
        <View testID="history-screen" style={styles.emptyContainer}>
          {/* TAN Nightingale heading SVG. Per user direction May 4 2026
              PM ("history does not have an svg title, still using
              font") — switched from styled Text to HeadingImage so
              the empty-state title renders in the same display face
              as the other page titles. Falls back to Marcellus text
              if the SVG asset is missing. */}
          <HeadingImage
            slot="history"
            fallback="History"
            height={56}
            color="#fff"
            style={styles.emptyPageTitle}
            textStyle={styles.pageTitle}
          />
          <View style={styles.emptyIconContainer}>
            <Feather name="clock" size={36} color="#fff" />
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Same brand ombre as the empty state above (top-right light →
          bottom-left deep, May 3 2026 PM). */}
      <LinearGradient
        colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
        locations={[0, 0.3, 0.6, 0.9]}
        start={{ x: 1, y: 0.05 }}
        end={{ x: 0.1, y: 0.95 }}
        style={StyleSheet.absoluteFill}
      />
      <View testID="history-screen" style={styles.container}>
        {/* Reordered May 4 2026 late-PM:
              meta line   — at TOP (was bottom of groupedFooter)
              deck        — flex:1 in the middle
              pill        — below deck
              Clear-history — bottom, closer to navbar
            Per user: "n items, n good fits...' needs to be on the top
            of this page. This stats comes first then cards then the
            pill. Move the clear history option even more lower than
            it's at right now... a tad more". */}
        <View style={styles.headerTop}>
          <Text style={styles.headerMeta} testID="history-meta">
            {entries.length} {entries.length === 1 ? 'item' : 'items'} · {goodFits} good {goodFits === 1 ? 'fit' : 'fits'}{rangeConfigured ? ` · ${withinBudget} within budget` : ''}
          </Text>
        </View>

        <HistoryCoverFlow
          entries={entries}
          onCardTap={handleCardTap}
          onCardDelete={handleCardDelete}
          onActiveIndexChange={setActiveIndex}
        />

        <View style={styles.bottomFooter}>
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
    // Transparent so the brand-purple ombre LinearGradient (rendered
    // beneath via absoluteFill) shows through. Was `colors.background`
    // (solid light) before April 29 2026 — flipped to match Home.
  },
  container: {
    flex: 1,
  },
  // Header — meta-only since the display title was retired (May 3
  // 2026). Tighter top + bottom padding so the cover-flow deck sits
  // higher on the screen.
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 0,
  },
  pageTitle: {
    ...typography.displayMedium,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Numbers in this header line ("3 items · 3 good fits") render in
  // Viaoda Libre per user direction April 29 2026 — the digits feel
  // editorial-deck instead of utilitarian when they're in the
  // display serif. Slightly larger size + tighter line height to
  // suit the heavier strokes.
  headerMeta: {
    // Bumped 15 → 18 (May 3 2026): now the only header line, needs
    // to carry the section on its own.
    fontFamily: fontFamily.display,
    fontSize: 18,
    lineHeight: 24,
    // Was 0.85 white — even after the gradient angle flip the top
    // half of the screen sits in the mid-tone region (~#71667c),
    // and 0.85 white only clears 4.39:1 there. WCAG AA needs 4.5:1
    // for 18px (≈ 13.5pt = normal text). Bumped to textOpaque (0.92)
    // which clears 4.78:1. May 3 2026 PM contrast pass.
    color: whiteAlpha.textOpaque,
    marginTop: 4,
    // Centred (May 4 2026) per user direction: the meta line carries
    // the entire screen header on its own, so left-aligning it left
    // a visible imbalance with the centred cover-flow deck below.
    textAlign: 'center',
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
    backgroundColor: whiteAlpha.surfaceSoft,
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  brandText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pricePill: {
    backgroundColor: whiteAlpha.surfaceSoft,
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  priceText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '400',
  },
  deleteButton: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: textAlpha.tintMd,
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
    backgroundColor: whiteAlpha.surfaceMid,
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: borderRadius.pill,
  },
  sizePillLabel: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '400',
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
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    ...typography.caption,
    color: whiteAlpha.textSubtle,
  },
  warningCount: {
    ...typography.caption,
    color: colors.warningLight,
    fontWeight: '400',
  },

  // --- Empty state ---
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  // Empty-state "History" heading. The shared pageTitle style sits
  // flush against the icon ring below it (centred container has no
  // intrinsic gap). Add breathing room so the heading reads as the
  // page title, not as a label glued to the icon.
  emptyPageTitle: {
    marginBottom: spacing.xl,
  },
  // Empty-state icon ring — light frosted disc, readable on the
  // brand-purple gradient (April 29 2026 backdrop change).
  emptyIconContainer: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(40),
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    // Bumped from headingM → headingXL to match the "are you a brand?"
    // CTA on the Account tab — the empty-state title was reading too
    // small against the gradient backdrop, especially on phones with
    // larger screens.
    ...typography.headingXL,
    color: '#fff',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
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
    fontWeight: '400',
    fontSize: 13,
  },

  // --- Top header (meta only) — May 4 2026 late-PM ---
  // Was `groupedFooter` containing [meta, pill, clear-history] under
  // the deck. User direction: "'n items, n good fits...' needs to be
  // on the top of this page. This stats comes first then cards then
  // the pill". Split into:
  //   headerTop  — meta line at the very top
  //   bottomFooter — pill + Clear-history at the bottom
  headerTop: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  bottomFooter: {
    alignItems: 'center',
    // Was 110 in the groupedFooter. Dropped to 80 so Clear-history
    // sits closer to the floating tab bar — user direction "Move
    // the clear history option even more lower than it's at right
    // now... a tad more". Floating tab bar is ~88 px from screen
    // bottom (insets.bottom + 10 + 64); 80 px paddingBottom plus
    // the link's own ~30 px height puts Clear-history ~30 px above
    // the navbar, slightly more visible than before.
    paddingBottom: 80,
    gap: spacing.sm,
  },
  detailBarWrap: {
    paddingBottom: spacing.xs,
  },

  // --- Clear link — muted underline tap target; destructive intent is
  //     reserved for the confirmation Alert, not the surface styling. ---
  clearLink: {
    alignSelf: 'center',
    // Bumped paddingVertical sm (8) → md (16) so the visible tap zone
    // is ≥ 44px tall on its own (16 + 19px line-height + 16 = 51px),
    // not just after the hitSlop. Cleaner for users with cognitive
    // accessibility needs who rely on the visible target. May 3 2026
    // PM accessibility-review #7.
    paddingVertical: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  clearLinkText: {
    ...typography.caption,
    // Was colors.textSecondary (dark grey) on the dark gradient
    // backdrop — invisible. Light text with moderate alpha so it
    // reads as a quiet but legible link, not loud as the primary
    // action.
    color: whiteAlpha.textBody,
    textDecorationLine: 'underline',
    letterSpacing: 0.6,
  },
});
