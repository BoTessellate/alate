import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, shadows, borderRadius, fontFamily } from '../constants/theme';
import { scrapeProduct, nudgeBrand, extractBrandFromUrl } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import HeadingImage from '../components/HeadingImage';
import FitLoader from '../components/FitLoader';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedBrand, setFailedBrand] = useState<{ brandName: string; brandDomain: string } | null>(null);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudging, setNudging] = useState(false);
  // When the backend returns `blocked:true` (brand opted out or robots
  // disallow), show a distinct card instead of the generic "unable to
  // fetch" error. Different copy + no nudge CTA — this brand has
  // explicitly asked to be left alone.
  const [blockedInfo, setBlockedInfo] = useState<{
    origin: string;
    reason: 'brand-optout' | 'robots-disallow' | undefined;
    message: string;
  } | null>(null);
  const { avatar } = useAvatarStore();
  const { entries: historyEntries } = useFitHistoryStore();
  // Most recent 3 for the "Recent" list per Claude Design mockup
  const recent = historyEntries.slice(0, 3);
  // Preserves URL across navigation to AvatarSetup so it auto-triggers on return
  const pendingUrlRef = useRef<string | null>(null);
  // Auto-trigger debounce on paste
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Normal focus — reset state
      setUrl('');
      setError(null);
      setFailedBrand(null);
      setNudgeSent(false);
    }, [avatar])
  );

  const runCheck = useCallback(async (targetUrl: string) => {
    if (!avatar) {
      // Save URL before leaving so we can restore it on return
      pendingUrlRef.current = targetUrl;
      navigation.navigate('AvatarSetup');
      return;
    }

    setLoading(true);
    setError(null);
    setFailedBrand(null);
    setBlockedInfo(null);
    setNudgeSent(false);

    try {
      const result = await scrapeProduct(targetUrl);
      if (result.success && result.data) {
        navigation.navigate('FitResult', { product: result.data, url: targetUrl });
      } else if (result.blocked) {
        // Brand opt-out / robots.txt disallow — show a distinct card,
        // no nudge option. We also clear the pasted URL so the user
        // isn't tempted to retry instantly.
        setBlockedInfo({
          origin: result.blockedOrigin || 'This brand',
          reason: result.blockedReason,
          message:
            result.blockedMessage ||
            'This brand has asked not to be scraped. Please visit their store directly.',
        });
        setUrl('');
      } else {
        const brand = extractBrandFromUrl(targetUrl);
        setFailedBrand(brand);
        setError('Unable to fetch product details.');
      }
    } catch (err) {
      const brand = extractBrandFromUrl(targetUrl);
      setFailedBrand(brand);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [avatar, navigation]);

  const handleCheckFit = () => {
    if (!url.trim()) {
      setError('Please enter a product URL');
      return;
    }
    runCheck(url.trim());
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    if (error) {
      setError(null);
      setFailedBrand(null);
      setNudgeSent(false);
    }
    // Auto-trigger on valid URL paste (debounced 700ms)
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = text.trim();
    if (trimmed && isValidUrl(trimmed)) {
      debounceTimer.current = setTimeout(() => runCheck(trimmed), 700);
    }
  };

  // As soon as a URL is detected (and we're loading the scrape), show
  // the full-screen FitLoader — not a tiny button spinner. User feedback:
  // the interstitial "check fit button spinner → reading size chart"
  // transition was two waits stacked; collapsing it into one makes the
  // flow feel instant. FitLoader renders a URL pill at the top so the
  // user retains context while the scrape + fit-check complete.
  if (loading) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <FitLoader url={url || undefined} />
      </View>
    );
  }

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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — per Claude Design mockup.
              Eyebrow wordmark + 3-line italic serif verse + plain tagline. */}
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>ALATE</Text>
            <HeadingImage
              slot="home-verse"
              fallback={"paste anything.\nwe'll tell you\nif it fits."}
              height={200}
              color="#fff"
              style={styles.heroVerseWrap}
              textStyle={styles.heroVerse}
            />
            <Text style={styles.heroTagline}>
              from any store. dresses, denim, knitwear — we read the brand's size chart against your body.
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

            {error && !failedBrand && (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              testID="check-fit-button"
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCheckFit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Check fit</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.shareHint}>or use the share extension from your browser</Text>
          </View>

          {/* Brand Nudge Card — unchanged functionally, just re-housed
              below the input so the hero composition stays clean. */}
          {failedBrand && (
            <GlassCard testID="brand-nudge-card" style={styles.nudgeCard}>
              <View style={styles.nudgeHeader}>
                <Feather name="send" size={18} color={colors.secondary} />
                <Text style={styles.nudgeTitle}>
                  {nudgeSent
                    ? `We've reached out to ${failedBrand.brandName}!`
                    : `${failedBrand.brandName} isn't on our platform yet`}
                </Text>
              </View>
              {nudgeSent ? (
                <Text style={styles.nudgeDescription}>
                  Thanks for nudging {failedBrand.brandName}. We've sent them an email
                  explaining how they can help their customers check fit before buying.
                </Text>
              ) : (
                <>
                  <Text style={styles.nudgeDescription}>
                    Nudge your favourite brand to get on our platform so you can check fit
                    before making the final purchase.
                  </Text>
                  <TouchableOpacity
                    testID="nudge-brand-button"
                    style={styles.nudgeButton}
                    onPress={async () => {
                      setNudging(true);
                      await nudgeBrand(failedBrand.brandDomain, failedBrand.brandName);
                      setNudging(false);
                      setNudgeSent(true);
                    }}
                    disabled={nudging}
                    activeOpacity={0.8}
                  >
                    {nudging ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Feather name="mail" size={16} color={colors.white} />
                        <Text style={styles.nudgeButtonText}>
                          Nudge {failedBrand.brandName}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </GlassCard>
          )}

          {/* Brand opt-out card — shown when the backend returns
              blocked:true. Distinct from the nudge card (no CTA, no
              pitch) because this brand has explicitly asked not to be
              scraped. We respect that. */}
          {blockedInfo && (
            <GlassCard testID="brand-blocked-card" style={styles.nudgeCard}>
              <View style={styles.nudgeHeader}>
                <Feather name="shield" size={18} color={colors.textSecondary} />
                <Text style={styles.nudgeTitle}>
                  {blockedInfo.origin} has opted out
                </Text>
              </View>
              <Text style={styles.nudgeDescription}>{blockedInfo.message}</Text>
            </GlassCard>
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
              <Text style={styles.recentLabel}>RECENT</Text>
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
          'rgba(76, 67, 86, 0)',
          'rgba(76, 67, 86, 0.7)',
          'rgba(76, 67, 86, 0.97)',
          '#4c4356',
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
  const { bg, fg, label } =
    entry.fitScore === 'great'
      ? { bg: 'rgba(90, 122, 104, 0.18)', fg: '#4a6a58', label: 'Fits' }
      : entry.fitScore === 'moderate'
      ? { bg: 'rgba(168, 114, 74, 0.18)', fg: '#8a5a3a', label: 'Check' }
      : { bg: 'rgba(154, 74, 74, 0.18)', fg: '#7a3a3a', label: 'Concerns' };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <GlassCard style={styles.recentCard}>
        {entry.productImage ? (
          <Image source={{ uri: entry.productImage }} style={styles.recentThumb} />
        ) : (
          <View style={[styles.recentThumb, styles.recentThumbPlaceholder]}>
            <Feather name="shopping-bag" size={18} color="rgba(255,255,255,0.7)" />
          </View>
        )}
        <View style={styles.recentMeta}>
          <Text style={styles.recentBrand} numberOfLines={1}>
            {(entry.brand || 'UNKNOWN').toUpperCase()}
          </Text>
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
  // --- Hero — Claude Design mockup layout, inverted for dark gradient
  //     backdrop. Text reads as light on the hero; glass cards below
  //     keep their white tint + dark text.
  hero: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2.2,
  },
  heroVerseWrap: {
    marginTop: 14,
  },
  heroVerse: {
    ...typography.displayLarge,
    fontSize: 40,
    lineHeight: 44,
    color: '#fff',
    marginTop: 14,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
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
    color: 'rgba(255,255,255,0.7)',
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
    fontFamily: 'serif',
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
  recentLabel: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: spacing.sm,
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
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
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
  recentBrand: {
    fontFamily: 'serif',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    // Dark text on the frosted card — WCAG AA passes on the 0.78
    // white-tint bg. Light text was failing contrast on the mid-
    // tone cards.
    color: colors.textMuted,
  },
  recentName: {
    fontFamily: 'serif',
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  recentSize: {
    fontFamily: 'serif',
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
    fontFamily: 'serif',
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
