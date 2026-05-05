import React, { useEffect, useState, Component, ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Linking } from 'react-native';

// Privacy-policy repo hosted on GitHub Pages at the BoTessellate org
// (confirmed via `gh api repos/BoTessellate/app_privacy_policy/pages`).
// The repo publishes to `botessellate.github.io/<repo>/` — NOT any
// individual user's github.io namespace. If the Pages source ever
// moves (e.g. to a custom domain), update these constants.
const PRIVACY_POLICY_URL = 'https://botessellate.github.io/app_privacy_policy/alate/privacy-policy.html';
const DELETE_ACCOUNT_URL = 'https://botessellate.github.io/app_privacy_policy/alate/delete-account.html';
const BRAND_OPTOUT_URL = 'https://botessellate.github.io/app_privacy_policy/alate/brand-optout.html';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, fontFamily, whiteAlpha, primaryAlpha, secondaryAlpha, textAlpha } from '../constants/theme';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useAccountStore, GoogleUser } from '../store/accountStore';
import { usePriceRangeStore } from '../store/priceRangeStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { captureError } from '../utils/sentry';
import FitCalibrationCard from '../components/FitCalibrationCard';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import HeadingImage from '../components/HeadingImage';
import ConfirmDialog from '../components/ConfirmDialog';
import ToastNotice from '../components/ToastNotice';
import {
  getGoogleAuthConfig,
  hasAnyGoogleAuthConfig,
  logMissingGoogleAuthConfigOnce,
} from '../utils/googleAuthEnv';

// Required: completes the auth session on app resume
WebBrowser.maybeCompleteAuthSession();

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Account'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const MEASUREMENT_LABELS: Record<string, string> = {
  height_cm: 'Height',
  shoulders: 'Shoulders',
  bust: 'Bust',
  waist: 'Waist',
  hips: 'Hips',
  thighs: 'Thighs',
  torso_length: 'Torso',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

// GLASS_CARD removed — replaced by <GlassCard> component everywhere

/**
 * Error boundary around the Google sign-in card. A crash inside useAuthRequest
 * (e.g. missing redirect URI on Android) must NOT blank the whole Account page.
 */
class GoogleSignInErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    captureError(error, { feature: 'google-signin-card' });
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * Signed-in / signed-out card UI — pure view, no hooks that can throw.
 * Used as both the success path body and the fallback when auth isn't configured.
 */
function AccountCardView({
  googleUser,
  onSignIn,
  onSignOut,
}: {
  googleUser: GoogleUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <GlassCard style={styles.accountCard}>
      {googleUser ? (
        <View style={styles.signedInRow}>
          {googleUser.picture ? (
            <Image source={{ uri: googleUser.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Feather name="user" size={22} color={colors.primary} />
            </View>
          )}
          <View style={styles.signedInInfo}>
            {googleUser.name && <Text style={styles.userName}>{googleUser.name}</Text>}
            <Text style={styles.userEmail}>{googleUser.email}</Text>
          </View>
          <TouchableOpacity onPress={onSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.signedOutWrap}>
          <TouchableOpacity style={styles.googleButton} onPress={onSignIn} activeOpacity={0.8}>
            <Feather name="log-in" size={18} color={colors.white} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          {/* Sign-up promo — three brand benefits inline (May 5 2026
              PM, replacing the prior "Optional — body profile and
              history work without signing in" line). User direction
              "promote signing up for an account like the one in the
              screenshot. But keep it succinct. One lined like you
              have put down right now". Lives INSIDE the white
              GlassCard so the icon hue is brand-purple (`primary`)
              for legibility — pure white icons on the near-white
              card surface would be invisible. If a separate
              dark-bg variant is wanted later, this row can move
              outside the card. */}
          <View style={styles.signInPromoRow}>
            <Feather name="refresh-cw" size={12} color={colors.primary} />
            <Text style={styles.signInPromoText}>Sync</Text>
            <Text style={styles.signInPromoDot}>·</Text>
            <Feather name="clock" size={12} color={colors.primary} />
            <Text style={styles.signInPromoText}>History</Text>
            <Text style={styles.signInPromoDot}>·</Text>
            <Feather name="lock" size={12} color={colors.primary} />
            <Text style={styles.signInPromoText}>Private</Text>
          </View>
        </View>
      )}
    </GlassCard>
  );
}

/**
 * Hook-bearing variant — only mounted when Google IDs exist so useAuthRequest
 * always has valid inputs. Still wrapped in an ErrorBoundary at the call site
 * for defence in depth.
 */
function GoogleSignInCardConfigured({ onRequestSignOut }: { onRequestSignOut: () => void }) {
  const { googleUser, setGoogleUser } = useAccountStore();
  const [signInError, setSignInError] = useState(false);

  const cfg = getGoogleAuthConfig();
  const [, response, promptAsync] = Google.useAuthRequest({
    clientId: cfg.clientId,
    androidClientId: cfg.androidClientId,
    iosClientId: cfg.iosClientId,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${authentication.accessToken}` },
        })
          .then((r) => r.json())
          .then((user) =>
            setGoogleUser({ id: user.id, email: user.email, name: user.name, picture: user.picture })
          )
          .catch(() => setSignInError(true));
      }
    }
  }, [response]);

  return (
    <>
      <AccountCardView
        googleUser={googleUser}
        onSignIn={() => promptAsync()}
        onSignOut={onRequestSignOut}
      />
      <ToastNotice
        visible={signInError}
        variant="error"
        title="Sign-in error"
        message="Could not fetch your Google profile. Please try again."
        onDismiss={() => setSignInError(false)}
      />
    </>
  );
}

/**
 * Account card entry point. Chooses between hook-bearing variant (when config
 * exists) and a plain "not configured" card that never calls the auth hook.
 * The hook-bearing variant is wrapped in an ErrorBoundary so a throw in
 * useAuthRequest or any child cannot blank the whole Account screen.
 */
function GoogleSignInCard({ onRequestSignOut }: { onRequestSignOut: () => void }) {
  const { googleUser } = useAccountStore();
  const [notConfiguredToast, setNotConfiguredToast] = useState(false);

  const hasGoogleConfig = hasAnyGoogleAuthConfig();
  if (!hasGoogleConfig) {
    // Log once per app session so a missing EAS env entry surfaces in
    // Sentry instead of leaving the user to guess whether GCC was the
    // problem. The .env-on-disk vs EAS-stored split is the most common
    // confusion source.
    logMissingGoogleAuthConfigOnce();
  }

  const notConfiguredCard = (
    <>
      <AccountCardView
        googleUser={googleUser}
        onSignIn={() => setNotConfiguredToast(true)}
        onSignOut={onRequestSignOut}
      />
      <ToastNotice
        visible={notConfiguredToast}
        title="Not configured"
        message="Google Sign-In is not set up yet."
        onDismiss={() => setNotConfiguredToast(false)}
      />
    </>
  );

  if (!hasGoogleConfig) {
    return notConfiguredCard;
  }

  return (
    <GoogleSignInErrorBoundary fallback={notConfiguredCard}>
      <GoogleSignInCardConfigured onRequestSignOut={onRequestSignOut} />
    </GoogleSignInErrorBoundary>
  );
}

/**
 * Price Range section. Compact, two TextInput fields for min/max with a
 * tiny currency toggle. Saves to the priceRangeStore on submit (or
 * blur). Reads back from the store so the values persist across
 * app launches. The `Clear` link appears once a range is set.
 */
const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR', 'INR'] as const;

function PriceRangeSection() {
  const { min, max, currency, setRange, clearRange } = usePriceRangeStore();
  const [draftMin, setDraftMin] = useState(min !== null ? String(min) : '');
  const [draftMax, setDraftMax] = useState(max !== null ? String(max) : '');
  const [draftCurrency, setDraftCurrency] = useState(currency);

  // Re-sync drafts whenever the store changes (e.g. cleared from elsewhere).
  useEffect(() => {
    setDraftMin(min !== null ? String(min) : '');
    setDraftMax(max !== null ? String(max) : '');
    setDraftCurrency(currency);
  }, [min, max, currency]);

  const commit = () => {
    const minVal = parseFloat(draftMin);
    const maxVal = parseFloat(draftMax);
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) return;
    setRange(minVal, maxVal, draftCurrency);
  };

  const isSet = min !== null && max !== null;

  return (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>PRICE RANGE</Text>
        {isSet ? (
          <TouchableOpacity
            testID="clear-price-range"
            style={styles.editPill}
            onPress={clearRange}
            activeOpacity={0.75}
          >
            <Feather name="x" size={11} color={colors.primary} />
            <Text style={styles.editPillText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <GlassCard style={styles.profileCard}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Min</Text>
          <View style={styles.priceInputWrap}>
            <Text style={styles.priceCurrencyPrefix}>{draftCurrency}</Text>
            <TextInput
              testID="price-range-min"
              style={styles.priceInput}
              keyboardType="decimal-pad"
              value={draftMin}
              onChangeText={setDraftMin}
              onBlur={commit}
              // Was placeholder="0" — on Marcellus the lone "0" glyph
              // rendered as a near-perfect circle in the muted grey,
              // which read as a placeholder bullet rather than "no
              // value set yet" (May 4 2026 user feedback). The em-dash
              // matches the rest of the app's "field is empty"
              // convention (FitResult Material / Category rows use
              // the same character).
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
            />
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Max</Text>
          <View style={styles.priceInputWrap}>
            <Text style={styles.priceCurrencyPrefix}>{draftCurrency}</Text>
            <TextInput
              testID="price-range-max"
              style={styles.priceInput}
              keyboardType="decimal-pad"
              value={draftMax}
              onChangeText={setDraftMax}
              onBlur={commit}
              // Was placeholder="0" — on Marcellus the lone "0" glyph
              // rendered as a near-perfect circle in the muted grey,
              // which read as a placeholder bullet rather than "no
              // value set yet" (May 4 2026 user feedback). The em-dash
              // matches the rest of the app's "field is empty"
              // convention (FitResult Material / Category rows use
              // the same character).
              placeholder="—"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
            />
          </View>
        </View>
        <View style={[styles.priceRow, styles.priceRowLast]}>
          <Text style={styles.priceLabel}>Currency</Text>
          <View style={styles.currencyChips}>
            {SUPPORTED_CURRENCIES.map((c) => {
              const active = draftCurrency === c;
              return (
                <TouchableOpacity
                  key={c}
                  testID={`currency-chip-${c}`}
                  style={[styles.currencyChip, active && styles.currencyChipActive]}
                  onPress={() => {
                    setDraftCurrency(c);
                    // Commit immediately on currency change so the chip on
                    // other surfaces updates without an extra blur.
                    const a = parseFloat(draftMin);
                    const b = parseFloat(draftMax);
                    if (Number.isFinite(a) && Number.isFinite(b)) setRange(a, b, c);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.currencyChipText, active && styles.currencyChipTextActive]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </GlassCard>

      <Text style={styles.priceHint}>
        Set a budget bracket — products show $ / $$ / $$$ on cards based on where they sit in your range.
      </Text>
    </>
  );
}

export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { avatar, clearAvatar } = useAvatarStore();
  const { entries } = useFitHistoryStore();
  // Gate "Delete Account" on the legal footer — only meaningful when
  // there's actually a Google account linked. Per user feedback April
  // 29 2026: showing it without an account read as a misleading CTA
  // ("delete what?"). Privacy Policy + Brand opt-out always render.
  const { googleUser, clearAccount } = useAccountStore();
  // Themed delete + sign-out confirmations. Native Alert.alert pops
  // a system-styled dialog that ignores the grey-purple glass voice
  // — replaced with the ConfirmDialog used elsewhere (Clear history
  // / Remove from history). Per user direction April 29 2026: "make
  // sure other modals match the clear-history modal's aesthetics."
  const [pendingDeleteProfile, setPendingDeleteProfile] = useState(false);
  const [pendingSignOut, setPendingSignOut] = useState(false);

  const greatFits = entries.filter((e) => e.fitScore === 'great').length;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Full-bleed gradient backdrop — same treatment as Home, matches
          the fit-analysis hero screens. May 3 2026 PM: angle flipped
          to top-RIGHT light → bottom-LEFT deep so white text in the
          top-left passes WCAG contrast (see HomeScreen for full
          rationale). */}
      <LinearGradient
        colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
        locations={[0, 0.3, 0.6, 0.9]}
        start={{ x: 1, y: 0.05 }}
        end={{ x: 0.1, y: 0.95 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header — TAN Nightingale "profile" SVG with styled text
            fallback if the asset is missing. */}
        <View style={styles.header}>
          <HeadingImage
            slot="profile"
            fallback="Profile"
            height={60}
            color="#fff"
            textStyle={styles.title}
          />
        </View>

        {/* Google account card — isolated so a hook crash here can't blank the page */}
        <GoogleSignInCard onRequestSignOut={() => setPendingSignOut(true)} />

        {/* Body profile — section header with Edit pill on the right.
            Per Claude Design ScreenProfile mockup. */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>BODY PROFILE</Text>
          <TouchableOpacity
            style={styles.editPill}
            onPress={() => navigation.navigate('AvatarSetup')}
            activeOpacity={0.75}
            // a11y #6: extend the tap zone to ≥44×44 without enlarging
            // the visual pill. paddingVertical 5 + 11pt text ≈ 24px
            // tall; +20 of slop on top/bottom + ~8 on sides clears
            // WCAG 2.5.5 with margin to spare.
            hitSlop={{ top: 20, bottom: 20, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={avatar ? 'Edit body profile' : 'Set up body profile'}
          >
            <Feather name="edit-2" size={11} color={colors.primary} importantForAccessibility="no" />
            <Text style={styles.editPillText}>{avatar ? 'Edit' : 'Set up'}</Text>
          </TouchableOpacity>
        </View>

        {avatar ? (
          <GlassCard style={styles.profileCard}>
            {/* Each row taps through to AvatarSetup with a focusKey
                so the user lands on that exact chip group instead of
                the top of the form. The AvatarSetup screen scrolls
                the matching section into view on mount. */}
            <TouchableOpacity
              testID="profile-row-height"
              activeOpacity={0.6}
              onPress={() => navigation.navigate('AvatarSetup', { focusKey: 'height' })}
              style={styles.profileRow}
              accessibilityRole="button"
              accessibilityLabel={`Edit height, currently ${Math.floor(avatar.height_cm / 30.48)} feet ${Math.round((avatar.height_cm / 2.54) % 12)} inches`}
            >
              <Text style={styles.profileLabel}>Height</Text>
              <View style={styles.profileValueRow}>
                <Text style={styles.profileValue}>
                  {Math.floor(avatar.height_cm / 30.48)}′{Math.round((avatar.height_cm / 2.54) % 12)}″
                </Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} importantForAccessibility="no" />
              </View>
            </TouchableOpacity>
            {(
              [
                ['shoulders', 'shoulders'],
                ['bust', 'bust'],
                ['waist', 'waist'],
                ['hips', 'hips'],
                ['thighs', 'thighs'],
                ['torso_length', 'torso'],
              ] as const
            ).map(([key, focusKey], i, arr) => (
              <TouchableOpacity
                key={key}
                testID={`profile-row-${key}`}
                activeOpacity={0.6}
                onPress={() => navigation.navigate('AvatarSetup', { focusKey })}
                style={[styles.profileRow, i === arr.length - 1 && styles.profileRowLast]}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${MEASUREMENT_LABELS[key].toLowerCase()}, currently ${capitalize(avatar[key] ?? '') || 'not set'}`}
              >
                <Text style={styles.profileLabel}>{MEASUREMENT_LABELS[key]}</Text>
                <View style={styles.profileValueRow}>
                  <Text style={styles.profileValue}>{capitalize(avatar[key] ?? '')}</Text>
                  <Feather name="chevron-right" size={14} color={colors.textMuted} importantForAccessibility="no" />
                </View>
              </TouchableOpacity>
            ))}
          </GlassCard>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.navigate('AvatarSetup')}
            activeOpacity={0.85}
          >
            <GlassCard style={styles.emptyProfileCard}>
              <Text style={styles.emptyProfileTitle}>Set up your body profile</Text>
              <Text style={styles.emptyProfileSubtitle}>
                Add measurements for accurate fit predictions
              </Text>
              <View style={styles.emptyProfileCta}>
                <Text style={styles.emptyProfileCtaText}>Get started →</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}

        {/* Price Range — user-defined budget bracket. Drives the $/$$/$$$
            affordability chip on Recent cards, fit-result hero, and the
            History detail bar. See [src/utils/affordability.ts]. */}
        <PriceRangeSection />

        {/* Preferences section removed — the Fit preference / Notifications
            rows were mockup placeholders that weren't wired to any store.
            When real preferences land (toggle component, persisted in
            zustand), reintroduce this section backed by real state. */}

        {/* Delete body profile — quiet link at the bottom. Explicit
            "Delete my body profile" wording per GDPR/DPDPA guidance:
            users should know exactly what the button does BEFORE the
            confirmation dialog. Measurements are sensitive data; the
            deletion action should be discoverable and unambiguous. */}
        {avatar && (
          <TouchableOpacity
            testID="delete-body-profile-button"
            style={styles.resetButton}
            onPress={() => setPendingDeleteProfile(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.resetText}>Delete my body profile</Text>
          </TouchableOpacity>
        )}

        {/* Legal / policy links — small footer row at the very bottom
            of the screen. Required for App Store + Play Store listings
            and GDPR/DPDPA transparency. Light-on-dark tap targets,
            generous spacing; each opens the hosted page in the device
            browser via Linking.openURL. */}
        <View style={styles.legalFooter}>
          <TouchableOpacity
            testID="privacy-policy-link"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          {googleUser && (
            <>
              <Text style={styles.legalDivider}>·</Text>
              <TouchableOpacity
                testID="delete-account-link"
                onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}
                activeOpacity={0.7}
              >
                <Text style={styles.legalLinkText}>Delete Account</Text>
              </TouchableOpacity>
            </>
          )}
          <Text style={styles.legalDivider}>·</Text>
          <TouchableOpacity
            testID="brand-optout-link"
            onPress={() => Linking.openURL(BRAND_OPTOUT_URL)}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Brand opt-out</Text>
          </TouchableOpacity>
        </View>

        {/* Are you a brand? — pitch CTA for store owners. Routes to
            the in-app BrandIntegration screen (May 3 2026: previously
            opened the privacy-policy brand-opt-out URL externally,
            which was both the wrong destination and a dead end for
            interested brands). */}
        <TouchableOpacity
          testID="brand-cta"
          style={styles.brandCta}
          onPress={() => navigation.navigate('BrandIntegration')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Are you a brand? Learn how to integrate alate with your store"
        >
          <HeadingImage
            slot="are-you-brand"
            fallback="are you a brand?"
            height={36}
            color="#fff"
            style={styles.brandCtaTitleSvgWrap}
            textStyle={styles.brandCtaTitle}
          />
          <Text style={styles.brandCtaSubtitle}>
            Run an online store? Want to give your customers a better way to check size, and reduce return headaches? Plug your sizing into alate — your shoppers see fit confidence before they buy, and you see fewer "doesn't fit" returns.
          </Text>
          {/* Explicit visible button affordance (May 3 2026 PM
              accessibility-review #9). Long-form CTA copy was
              ambiguous about whether the whole block was tappable —
              the pill makes the interaction obvious for cognitive
              accessibility AND gives screen-reader users a clear
              "this is the action" anchor. Sits below the body so
              the title still leads visually. */}
          <View style={styles.brandCtaButton}>
            <Text style={styles.brandCtaButtonText}>Learn more →</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom-edge fade — same pattern as Home. Content melts into
          the backdrop gradient's dark stop so the floating tab bar
          reads as a true floating element, not a glass pane over
          scrollable list rows. */}
      <LinearGradient
        colors={[
          secondaryAlpha.zero,
          secondaryAlpha.mid,
          secondaryAlpha.deep,
          colors.secondary,
        ]}
        locations={[0, 0.22, 0.55, 1]}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      {/* Themed delete-body-profile confirmation. Replaces the system
          Alert.alert which broke visual continuity with the rest of
          the grey-purple glass aesthetic. Uses the same ConfirmDialog
          shell as Clear history / Remove from history. */}
      <ConfirmDialog
        visible={pendingDeleteProfile}
        title="Delete body profile?"
        confirmLabel="Delete"
        icon="trash-2"
        confirmTestID="confirm-delete-body-profile"
        onConfirm={() => {
          clearAvatar();
          setPendingDeleteProfile(false);
        }}
        onCancel={() => setPendingDeleteProfile(false)}
      />

      {/* Themed sign-out confirmation. Triggered from GoogleSignInCard
          via the onSignOut callback above. */}
      <ConfirmDialog
        visible={pendingSignOut}
        title="Sign out?"
        confirmLabel="Sign out"
        icon="log-out"
        confirmTestID="confirm-sign-out"
        onConfirm={() => {
          clearAccount();
          setPendingSignOut(false);
        }}
        onCancel={() => setPendingSignOut(false)}
      />
    </View>
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
    padding: spacing.lg,
    // Clears the fade ramp + tab-bar footprint so Reset stays above
    // the dense fade region.
    paddingBottom: 260,
  },
  // Header — left-aligned italic serif title, white on the dark
  // gradient backdrop per Claude Design ScreenProfile + user direction.
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displayMedium,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Google account card. marginTop +2 px May 5 2026 ("lower position
  // of the signin 'continue with..' container by 2px") — pushes the
  // card slightly further from the page header.
  accountCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  signedOutWrap: {
    gap: spacing.sm,
  },
  signInOptionalNote: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.85,
    paddingHorizontal: spacing.sm,
  },
  // Sign-up promo row: icon · text · dot · icon · text · dot · …
  // Single-line, succinct (per May 5 2026 PM user direction).
  // Lives inside the white sign-in card; icons in brand-purple
  // (`primary`) for legibility on the near-white surface.
  signInPromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  signInPromoText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 1,
  },
  signInPromoDot: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  googleButtonText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '400',
    fontSize: 15,
  },
  signedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signedInInfo: {
    flex: 1,
  },
  userName: {
    ...typography.labelLarge,
    color: colors.text,
    fontWeight: '400',
    marginBottom: 2,
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  signOutButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    // Muted purple chip instead of the red-tinted destructive pill.
    // The action is still destructive, but the confirm dialog gates the
    // actual sign-out — the chip doesn't need to shout.
    backgroundColor: primaryAlpha.tintSm,
  },
  signOutText: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '400',
    fontSize: 12,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  // Section label + pill — per Claude Design ScreenProfile: small
  // uppercase label on the left, compact Edit pill on the right.
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
    marginTop: spacing.lg,
  },
  sectionRowSpaced: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fontFamily.primarySemiBold,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    // Light on dark gradient bg.
    color: whiteAlpha.textBodyStrong,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // Visual size unchanged so the pill still reads as a small chip;
    // the touch target is widened via `hitSlop` on the TouchableOpacity
    // (44×44 minimum per WCAG 2.5.5). See accessibility-review #6
    // (May 3 2026 PM).
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    // White-tinted pill on the dark bg.
    backgroundColor: whiteAlpha.surfaceMid,
  },
  editPillText: {
    fontFamily: fontFamily.primarySemiBold,
    fontSize: 10,
    fontWeight: '400',
    color: '#fff',
  },
  prefValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Glass list card for body profile + preferences — inner rows are
  // Compact body-profile card (April 29 2026): 7 measurement rows
  // were previously 12px vertical padding × body-sized type, which
  // made the card feel like its own page. Tightened to 6px padding +
  // labelSmall / bodySmall so the whole profile fits in a glance
  // alongside everything else on the Account screen.
  profileCard: {
    borderRadius: borderRadius.xl,
    padding: 4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Bumped 6 → 12 (May 3 2026 PM) to bring the row's tap target to
    // ~44px (12 + 12 + 18px label line-height). Below that floor,
    // WCAG 2.5.5 fails — see accessibility-review #5. The label /
    // value type sizes are unchanged so the visual density barely
    // shifts; just the tap zone grows.
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: textAlpha.divider,
  },
  profileRowLast: {
    borderBottomWidth: 0,
  },
  profileLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  profileValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '400',
  },
  // Holds the value + a chevron — visually announces the row is
  // tappable. Each row navigates to AvatarSetup with a focusKey
  // so the user lands on the matching chip group.
  profileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyProfileCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyProfileIcon: {
    fontSize: 36,
    marginBottom: spacing.md,
  },
  emptyProfileTitle: {
    ...typography.headingS,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyProfileSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyProfileCta: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyProfileCtaText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '400',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  resetButton: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.pill,
    // Subdued on dark gradient — quieter text link feel, not a bright red button.
    backgroundColor: whiteAlpha.surfaceFaint,
    marginTop: spacing.lg,
  },
  resetText: {
    ...typography.label,
    color: whiteAlpha.textBody,
    fontWeight: '400',
  },
  // Price range section — same glass list-card visual as Body Profile,
  // with text-input rows + a currency chip strip.
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: textAlpha.divider,
  },
  priceRowLast: {
    borderBottomWidth: 0,
  },
  priceLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceCurrencyPrefix: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '600',
  },
  priceInput: {
    ...typography.body,
    color: colors.text,
    minWidth: 80,
    textAlign: 'right',
    padding: 0,
  },
  currencyChips: {
    flexDirection: 'row',
    gap: 6,
  },
  currencyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: primaryAlpha.tintSm,
  },
  currencyChipActive: {
    backgroundColor: colors.primary,
  },
  currencyChipText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  currencyChipTextActive: {
    color: colors.white,
  },
  priceHint: {
    ...typography.caption,
    color: whiteAlpha.textBody,
    marginTop: spacing.sm,
    paddingHorizontal: 4,
    lineHeight: 18,
  },

  // Legal/policy links — small row at the bottom of the Account page.
  // Centred, dot-separated, low-contrast (these are reference links,
  // not primary actions).
  legalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.lg,
  },
  legalLinkText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: whiteAlpha.textMuted,
    textDecorationLine: 'underline',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  legalDivider: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: whiteAlpha.textFaint,
  },

  // "are you a brand?" CTA — sits below the legal footer. Heading
  // matches the rest of the heading typography (Viaoda Libre italic
  // display serif at heading-XL weight) so the brand voice carries.
  // Sub copy is body-small over the same dark gradient backdrop as
  // the policy links above.
  brandCta: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  // Wrapper for the are-you-brand SVG (renders via HeadingImage).
  // marginBottom replaces the brandCtaTitle's previous marginBottom
  // since the SVG needs a non-text wrapper for spacing.
  // `alignSelf: 'center'` overrides HeadingImage.styles.wrap's
  // default `alignSelf: 'flex-start'` (which left-aligned the SVG
  // inside the centred parent — user feedback May 5 2026 PM:
  // "'are you a brand' needed to be centered like it's body text").
  brandCtaTitleSvgWrap: {
    marginBottom: spacing.sm,
    alignSelf: 'center',
  },
  brandCtaTitle: {
    // Used as the styled-text fallback inside HeadingImage when the
    // are-you-brand SVG asset isn't available (build pre-May 5 2026
    // or asset bundling failed).
    ...typography.headingXL,
    color: '#fff',
    textAlign: 'center',
  },
  brandCtaSubtitle: {
    fontFamily: fontFamily.primary,
    // 13pt at textMuted (0.65 white) on the mid-stop of the gradient
    // failed WCAG AA (3.31:1 vs 4.5:1 required for normal text). Bumped
    // alpha to textBody (0.75) which clears 4.5:1 across the whole
    // gradient. See accessibility-review #2 (May 3 2026 PM).
    fontSize: 13,
    lineHeight: 19,
    color: whiteAlpha.textBody,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.md,
  },

  // Explicit "Learn more →" button under the brand CTA copy. Pill
  // matches the rest of the app's primary actions (rounded, primary
  // brand fill, white text) so the affordance reads as "tap me" at a
  // glance. Visual size also clears the 44px touch-target floor on
  // its own — the wrapping TouchableOpacity covers the whole CTA
  // already, but a sub-region that LOOKS like a button matters for
  // cognitive a11y (May 3 2026 PM accessibility-review #9).
  brandCtaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.pill,
    alignSelf: 'center',
  },
  brandCtaButtonText: {
    fontFamily: fontFamily.primarySemiBold,
    fontSize: 14,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.4,
  },

  // Bottom-edge fade — 280px tall for a heavier horizon effect.
  // Content padding bumped in parallel so the Reset button still
  // lives above the dense part of the fade.
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    zIndex: 1,
  },
});
