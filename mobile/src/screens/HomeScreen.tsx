import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// utils/effectiveFitScore — see RecentCard below
import { computeEffectiveFitScore } from '../utils/effectiveFitScore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, shadows, borderRadius, fontFamily, whiteAlpha, secondaryAlpha, statusAlpha } from '../constants/theme';
import { isEnabled } from '../constants/featureFlags';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import HeadingImage from '../components/HeadingImage';
import BrandHeading from '../components/BrandHeading';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

/**
 * Quick heuristic for "this URL looks like a product page". Used to
 * decide whether to auto-fire the scrape from a clipboard URL on
 * focus — we don't want to scrape every random link the user has on
 * their clipboard, just shopping URLs.
 *
 * Catches the major patterns:
 *   - Shopify: /products/<handle>
 *   - Amazon / many SEAsian sites: /dp/<asin>, /gp/product/<id>
 *   - ASOS / Boohoo / etc.: /prd/<id>
 *   - Net-a-Porter / Mr Porter: /product/<id>
 *   - H&M / Zara: /productpage. or trailing -p<digits>
 *   - Generic fallback: path contains the literal word "product"
 */
function looksLikeProductUrl(text: string): boolean {
  try {
    const path = new URL(text).pathname.toLowerCase();
    return (
      /\/products?\//.test(path) ||
      /\/(dp|gp\/product|prd)\//.test(path) ||
      /productpage/.test(path) ||
      /-p\d{4,}\b/.test(path)
    );
  } catch {
    return false;
  }
}

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  // HomeScreen is now a pure URL-capture surface. Scrape, enrich,
  // fit-check, brand-nudge, and blocked-brand UX have all moved into
  // FitResult so the user only ever sees ONE loading screen between
  // "I pasted a URL" and "here's the verdict". The Check Fit button
  // has been removed too — the 700ms paste-debounce is the only
  // trigger now. No validation state is needed because invalid URLs
  // simply don't fire the auto-trigger.
  const { avatar } = useAvatarStore();
  const { entries: historyEntries } = useFitHistoryStore();
  // Most recent 3 for the "Recent" list per Claude Design mockup
  const recent = historyEntries.slice(0, 3);
  // Preserves URL across navigation to AvatarSetup so it auto-triggers on return
  const pendingUrlRef = useRef<string | null>(null);
  // Auto-trigger debounce on paste
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether we've already consumed a clipboard URL this session,
  // so a single product URL on the user's clipboard auto-fires once
  // (when they open the app) but doesn't keep re-triggering on every
  // tab focus. The "ref" not "state" pattern keeps the auto-fire path
  // out of the render cycle.
  const consumedClipboardUrlRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // If we just came back from AvatarSetup with a pending URL, auto-trigger
      if (pendingUrlRef.current && avatar) {
        const saved = pendingUrlRef.current;
        pendingUrlRef.current = null;
        setUrl(saved);
        runCheck(saved);
        return;
      }
      // Normal focus — reset URL so a stale paste doesn't auto-trigger
      // a fresh fit-check the moment the screen mounts.
      setUrl('');

      // Auto-clipboard-detection on focus was REMOVED April 29 2026.
      // Earlier behaviour read the clipboard whenever Home regained
      // focus and auto-fired the scraper if the URL "looked like a
      // product". Per user feedback: that triggered at odd times —
      // e.g. a male user setting up his profile while a women's
      // product URL sat in the clipboard from an earlier session.
      // The "I want to check this product" intent must be explicit:
      // the user pastes into the input themselves. Manual paste keeps
      // the 700ms debounce auto-fire (deliberate paste = deliberate
      // intent), so the convenience for the active path is preserved
      // — only the passive clipboard sniff is gone.
      // (consumedClipboardUrlRef + Clipboard import retained in case
      // we re-introduce the feature behind a "Check this link?" pill
      // — see backlog notes on opt-in clipboard prompt.)
    }, [avatar])
  );

  const runCheck = useCallback((targetUrl: string) => {
    if (!avatar) {
      // Save URL before leaving so we can restore it on return
      pendingUrlRef.current = targetUrl;
      navigation.navigate('AvatarSetup');
      return;
    }

    // Navigate to FitResult immediately. FitResult runs the full
    // scrape → enrich → fit-check pipeline under a single FitLoader.
    // Brand-nudge / blocked-brand cards have moved into FitResult's
    // error-card state. This collapses two sequential loading screens
    // (HomeScreen scrape spinner + FitResult fit-loader) into one.
    navigation.navigate('FitResult', { url: targetUrl });
  }, [avatar, navigation]);

  const handleUrlChange = (text: string) => {
    setUrl(text);
    // Auto-trigger on valid URL paste (debounced 700ms). Invalid /
    // empty inputs simply don't fire — there's no submit button to
    // gate against.
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = text.trim();
    if (trimmed && isValidUrl(trimmed)) {
      debounceTimer.current = setTimeout(() => runCheck(trimmed), 700);
    }
  };

  // NOTE — earlier iteration showed a full-screen FitLoader on
  // HomeScreen during the scrape. That created a duplicate-loader
  // regression: HomeScreen's FitLoader during scrape, then FitResult's
  // FitLoader during enrich+fit-check, back-to-back. Reverted to a
  // button-only spinner here. The single full-screen FitLoader now
  // only renders inside FitResult. If we want to collapse those two
  // loaders into one, the path is to navigate to FitResult immediately
  // and let it own the entire scrape→enrich→check pipeline (a bigger
  // architectural change tracked in BACKLOG.md).

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Full-bleed gradient backdrop — same visual as fit-analysis hero
          screens per user direction. Radial-style angle from the top-left
          light edge through brand purple to the deep purple base. */}
      <LinearGradient
        colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
        locations={[0, 0.3, 0.6, 0.9]}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          // Tight bottom padding when the RECENT list is empty —
          // otherwise the 280px clearance reserved for the fade-out
          // of recents reads as a dead zone. Per user feedback April
          // 29 2026: "reduce footer spacing on the home page on
          // empty history".
          contentContainerStyle={[
            styles.content,
            recent.length === 0 && styles.contentNoRecent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — per Claude Design mockup.
              Eyebrow wordmark + 3-line italic serif verse + plain tagline. */}
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>ALATE</Text>
            <HeadingImage
              slot="home-verse"
              fallback={"Paste anything.\nWe'll tell you\nif it fits."}
              height={200}
              color="#fff"
              style={styles.heroVerseWrap}
              textStyle={styles.heroVerse}
            />
            <Text style={styles.heroTagline}>
              From any store.{'\n'}Dresses, denim, knitwear — we read the brand's size chart against your body.
            </Text>
          </View>

          {/* Glass pill input + Check fit button — matches the design's
              single-line input (no wrapping card) + pill CTA + share hint. */}
          <View style={styles.inputSection}>
            <GlassCard style={styles.inputPill}>
              <Feather name="link-2" size={18} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                testID="url-input"
                style={styles.inputField}
                placeholder="paste a product url…"
                placeholderTextColor={colors.textMuted}
                value={url}
                onChangeText={handleUrlChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </GlassCard>

            {/* Check Fit button intentionally removed. The 700ms paste-
                debounce auto-triggers fit-check on any valid URL — a
                button to "submit" duplicates that interaction. The
                share-extension hint below stays as the alternative
                entry point. */}
            <Text style={styles.shareHint}>or use the share extension from your browser</Text>
          </View>

          {/* Brand-nudge + brand-opt-out cards have moved into FitResult's
              error-card state as part of the single-loader cleanup. They
              fire when FitResult's internal scrape fails (unsupported
              brand, blocked origin, network error). Backlog: re-add a
              fully-styled brand-nudge card with email send. */}

          {/* v2: Story share entry. Only rendered when the feature flag
              is on — production builds never see this tile. */}
          {isEnabled('V2') && (
            <TouchableOpacity
              testID="story-share-entry"
              onPress={() => navigation.navigate('PickImage')}
              activeOpacity={0.85}
              style={styles.setupWrap}
            >
              <GlassCard style={styles.setupCard}>
                <View style={styles.setupIconContainer}>
                  <Feather name="image" size={20} color={colors.primary} />
                </View>
                <View style={styles.setupTextContainer}>
                  <Text style={styles.setupTitle}>make a story</Text>
                  <Text style={styles.setupSubtitle}>
                    drop words + the track you're listening to onto a photo
                  </Text>
                </View>
                <Text style={styles.setupArrow}>→</Text>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* Profile Setup Prompt — shown only when the user hasn't built a
              body profile yet. Not in the design mockup (which assumes a
              completed onboarding), but functionally required for new
              users; kept here as a gentle glass nudge. */}
          {!avatar && (
            <TouchableOpacity
              onPress={() => navigation.navigate('AvatarSetup')}
              activeOpacity={0.85}
              style={styles.setupWrap}
            >
              <GlassCard style={styles.setupCard}>
                <View style={styles.setupIconContainer}>
                  <Feather name="sliders" size={20} color={colors.primary} />
                </View>
                <View style={styles.setupTextContainer}>
                  <Text style={styles.setupTitle}>Set up your body profile</Text>
                  <Text style={styles.setupSubtitle}>
                    Tell us your height and body type for accurate fit predictions
                  </Text>
                </View>
                <Text style={styles.setupArrow}>→</Text>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* Recent — glass-card list of the last 3 fit checks. Tapping a
              row opens the FitResult for that entry in history mode.
              Replaces the old "feature highlights" section entirely. */}
          {recent.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentLabel}>RECENT</Text>
                {/* Tap-target to the full History tab. Only render when
                    there's more history than what fits in the Recent
                    list (3 most recent), so users with a small history
                    don't see a CTA that just reloads the same view. */}
                {historyEntries.length > recent.length && (
                  <TouchableOpacity
                    testID="recent-see-all"
                    onPress={() => navigation.navigate('History')}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.recentSeeAll}>See all</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.recentList}>
                {recent.map((entry) => (
                  <RecentCard
                    key={entry.id}
                    entry={entry}
                    onPress={() => {
                      const idx = historyEntries.findIndex((e) => e.id === entry.id);
                      navigation.navigate('FitResult', {
                        historyEntries,
                        currentIndex: idx >= 0 ? idx : 0,
                        product: {
                          name: entry.productName,
                          image: entry.productImage,
                          price: entry.price,
                          brand: entry.brand,
                        },
                        url: entry.url,
                        historyEntryId: entry.id,
                        precomputed: {
                          fitScore: entry.fitScore,
                          warnings: entry.warnings,
                          sizeRecommendation: entry.sizeRecommendation,
                          enrichedProduct: {
                            category: entry.category,
                            material: entry.material,
                            tags: entry.tags,
                          },
                          checkedAt: entry.checkedAt,
                        },
                      });
                    }}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom-edge fade — content "disappears into the darkness" where
          it meets the floating tab bar. Makes the glass tab bar read as
          a true floating element instead of a translucent pane with the
          RECENT list bleeding through from behind. Gradient fades from
          transparent at the top to the page backdrop's deepest stop
          (matching #4c4356) over the height the tab pill occupies.
          pointerEvents="none" so the fade doesn't eat taps on cards
          above it. */}
      <LinearGradient
        // Heavier ramp — Recent cards need to wash OUT much earlier so
        // the floating nav pill reads as a true floating element, not a
        // glass pane with card artefacts bleeding behind/around it. User
        // direction: "a lot more faded than it is right now". Dark stop
        // reaches 90% opacity by the halfway mark, and the gradient is
        // ~60% taller than the previous 200px version.
        colors={[
          secondaryAlpha.zero,
          secondaryAlpha.strong,
          secondaryAlpha.deeper,
          colors.secondary,
        ]}
        locations={[0, 0.22, 0.5, 1]}
        style={styles.bottomFade}
        pointerEvents="none"
      />
    </View>
  );
}

// Recent-fit row. Thumbnail + brand eyebrow + name + size + verdict chip.
function RecentCard({ entry, onPress }: { entry: FitHistoryEntry; onPress: () => void }) {
  // Re-tier the verdict so a single MINOR-only warning reads as
  // "Fits·" (with note marker) instead of the heavy "Check" /
  // "Concerns" chip. Same rule as FitResultScreen + FitDetailBar —
  // see utils/effectiveFitScore.ts.
  const effective = computeEffectiveFitScore(entry.warnings, entry.fitScore);
  const { bg, fg, label } =
    effective === 'great'
      ? { bg: statusAlpha.successMed, fg: colors.successDeep, label: 'Fits' }
      : effective === 'minor'
      ? { bg: statusAlpha.successMed, fg: colors.successDeep, label: 'Fits · note' }
      : effective === 'moderate'
      ? { bg: statusAlpha.warningMed, fg: colors.warningDeep, label: 'Check' }
      : { bg: statusAlpha.errorMed, fg: colors.errorDeep, label: 'Concerns' };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <GlassCard style={styles.recentCard}>
        {entry.productImage ? (
          <Image source={{ uri: entry.productImage }} style={styles.recentThumb} />
        ) : (
          <View style={[styles.recentThumb, styles.recentThumbPlaceholder]}>
            <Feather name="shopping-bag" size={18} color={whiteAlpha.textSecondary} />
          </View>
        )}
        <View style={styles.recentMeta}>
          <BrandHeading
            brand={entry.brand || 'UNKNOWN'}
            height={14}
            color={colors.textMuted}
            uppercase
            textStyle={styles.recentBrand}
            testID={`recent-brand-${entry.id}`}
          />
          <Text style={styles.recentName} numberOfLines={1}>
            {entry.productName || 'Product'}
          </Text>
          {entry.sizeRecommendation?.size && (
            <Text style={styles.recentSize}>Size {entry.sizeRecommendation.size}</Text>
          )}
        </View>
        <View style={[styles.recentChip, { backgroundColor: bg }]}>
          <Text style={[styles.recentChipLabel, { color: fg }]}>{label}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
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
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    // Extra clearance so the RECENT list is visibly dying into the fade
    // before it reaches the floating pill. Paired with the heavier fade
    // gradient (height 320 below), the last RECENT row ends deep inside
    // the dark zone — cards never show up cleanly near the nav pill.
    paddingBottom: 280,
  },
  // Empty-history variant — only enough bottom padding to clear the
  // floating tab pill (~96px). The big 280px reservation in `content`
  // exists purely so the RECENT list can fade nicely into the dark
  // gradient; when there are no recents, it reads as wasted space.
  contentNoRecent: {
    paddingBottom: 96,
  },
  // --- Hero — Claude Design mockup layout, inverted for dark gradient
  //     backdrop. Text reads as light on the hero; glass cards below
  //     keep their white tint + dark text.
  hero: {
    marginTop: spacing.md,
    // Bumped lg → xxl so the verse reads more like a hero block
    // sitting clearly apart from the URL input below it. Pairs with
    // the tighter ALATE↔verse spacing below.
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    ...typography.overline,
    color: whiteAlpha.textBrand,
    letterSpacing: 2.2,
  },
  heroVerseWrap: {
    // Tightened 14 → 4 so ALATE and the verse read as a single
    // hero unit. Verse is the dominant element; the eyebrow is just
    // a tag above it.
    marginTop: 4,
  },
  heroVerse: {
    ...typography.displayLarge,
    fontSize: 40,
    lineHeight: 44,
    color: '#fff',
    // Same tightening for the styled-text fallback path (when the SVG
    // heading isn't loaded). Keeps the two render paths visually
    // identical.
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTagline: {
    ...typography.body,
    color: whiteAlpha.textHigh,
    marginTop: 14,
    maxWidth: 300,
    lineHeight: 21,
  },

  // --- Input section — glass pill + CTA + share hint ---
  inputSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 10,
    borderRadius: borderRadius.xl,
  },
  inputIcon: {
    flexShrink: 0,
  },
  inputField: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  shareHint: {
    ...typography.caption,
    color: whiteAlpha.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: spacing.xs,
  },
  errorContainer: {
    backgroundColor: colors.errorLight + '20',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    // Soft lift, not a halo — matches History's restrained shadow palette.
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
    fontSize: 17,
  },
  setupCard: {
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  setupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  setupTextContainer: {
    flex: 1,
  },
  setupTitle: {
    ...typography.labelLarge,
    color: colors.primary,
    marginBottom: 2,
  },
  setupSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  setupArrow: {
    fontFamily: fontFamily.primary,
    fontSize: 22,
    color: colors.primary,
    fontWeight: '300',
  },
  nudgeCard: {
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  nudgeTitle: {
    ...typography.labelLarge,
    color: colors.text,
    flex: 1,
  },
  nudgeDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  nudgeButtonText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '600',
  },
  // --- Recent — glass-card list of last N fit checks (Claude Design) ---
  recentSection: {
    marginTop: spacing.xl,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  recentLabel: {
    ...typography.overline,
    color: whiteAlpha.textBody,
  },
  recentSeeAll: {
    ...typography.labelSmall,
    color: whiteAlpha.textBody,
    textDecorationLine: 'underline',
  },
  recentList: {
    gap: spacing.sm,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderRadius: borderRadius.xl,
    // White frost opaque enough for dark text to pass WCAG AA against
    // the dark-gradient backdrop. At 0.38 the card was mid-tone, so
    // neither white nor dark text read well. 0.78 reads as frosted
    // glass (gradient still perceptible at the edges) but carries the
    // dark ink cleanly.
    backgroundColor: whiteAlpha.surfaceCard,
    borderWidth: 1,
    borderColor: whiteAlpha.borderStrong,
  },
  recentThumb: {
    width: 44,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
  },
  recentThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  recentMeta: {
    flex: 1,
    gap: 1,
  },
  // Recent-card brand label — DELIBERATELY no fontFamily / fontWeight
  // overrides: BrandHeading owns the typeface (Viaoda Libre via the
  // SVG path or styled-text fallback) and 400 weight. We only set the
  // visual treatment (size, letter-spacing, colour). Same lesson as
  // HistoryCoverFlow.folioBrand — see comment there.
  recentBrand: {
    fontSize: 10,
    letterSpacing: 0.5,
    // Dark text on the frosted card — WCAG AA passes on the 0.78
    // white-tint bg. Light text was failing contrast on the mid-
    // tone cards.
    color: colors.textMuted,
  },
  recentName: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  recentSize: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 13,
    marginTop: 1,
  },
  recentChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  recentChipLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Setup prompt wrapper (glass card for users without avatar)
  setupWrap: {
    marginBottom: spacing.md,
  },

  // Bottom-edge fade — sits over the ScrollView, under the floating
  // tab bar. Bumped to 320px so the dark zone reaches further up the
  // viewport and Recent cards wash into the darkness well before they
  // get anywhere near the floating nav pill.
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
    zIndex: 1,
  },
});
