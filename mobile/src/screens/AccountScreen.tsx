import React, { useEffect, Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
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
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { captureError } from '../utils/sentry';
import FitCalibrationCard from '../components/FitCalibrationCard';
import GlassCard from '../components/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import HeadingImage from '../components/HeadingImage';

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
          <Text style={styles.signInOptionalNote}>
            Optional — your body profile and fit history work without signing in.
          </Text>
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
function GoogleSignInCardConfigured() {
  const { googleUser, setGoogleUser, clearAccount } = useAccountStore();

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  const [, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
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
          .catch(() =>
            Alert.alert('Sign-in error', 'Could not fetch your Google profile. Please try again.')
          );
      }
    }
  }, [response]);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: clearAccount },
    ]);
  };

  return (
    <AccountCardView
      googleUser={googleUser}
      onSignIn={() => promptAsync()}
      onSignOut={handleSignOut}
    />
  );
}

/**
 * Account card entry point. Chooses between hook-bearing variant (when config
 * exists) and a plain "not configured" card that never calls the auth hook.
 * The hook-bearing variant is wrapped in an ErrorBoundary so a throw in
 * useAuthRequest or any child cannot blank the whole Account screen.
 */
function GoogleSignInCard() {
  const { googleUser, clearAccount } = useAccountStore();

  const hasGoogleConfig = !!(
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  );

  const notConfiguredCard = (
    <AccountCardView
      googleUser={googleUser}
      onSignIn={() =>
        Alert.alert('Not configured', 'Google Sign-In is not set up yet.', [{ text: 'OK' }])
      }
      onSignOut={() =>
        Alert.alert('Sign out', 'Are you sure you want to sign out?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: clearAccount },
        ])
      }
    />
  );

  if (!hasGoogleConfig) {
    return notConfiguredCard;
  }

  return (
    <GoogleSignInErrorBoundary fallback={notConfiguredCard}>
      <GoogleSignInCardConfigured />
    </GoogleSignInErrorBoundary>
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
  const { googleUser } = useAccountStore();

  const greatFits = entries.filter((e) => e.fitScore === 'great').length;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Full-bleed gradient backdrop — same treatment as Home, matches
          the fit-analysis hero screens. */}
      <LinearGradient
        colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
        locations={[0, 0.3, 0.6, 0.9]}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.85, y: 1 }}
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
        <GoogleSignInCard />

        {/* Body profile — section header with Edit pill on the right.
            Per Claude Design ScreenProfile mockup. */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>BODY PROFILE</Text>
          <TouchableOpacity
            style={styles.editPill}
            onPress={() => navigation.navigate('AvatarSetup')}
            activeOpacity={0.75}
          >
            <Feather name="edit-2" size={11} color={colors.primary} />
            <Text style={styles.editPillText}>{avatar ? 'Edit' : 'Set up'}</Text>
          </TouchableOpacity>
        </View>

        {avatar ? (
          <GlassCard style={styles.profileCard}>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Height</Text>
              <Text style={styles.profileValue}>
                {Math.floor(avatar.height_cm / 30.48)}′{Math.round((avatar.height_cm / 2.54) % 12)}″
              </Text>
            </View>
            {(
              ['shoulders', 'bust', 'waist', 'hips', 'thighs', 'torso_length'] as const
            ).map((key, i, arr) => (
              <View
                key={key}
                style={[styles.profileRow, i === arr.length - 1 && styles.profileRowLast]}
              >
                <Text style={styles.profileLabel}>{MEASUREMENT_LABELS[key]}</Text>
                <Text style={styles.profileValue}>{capitalize(avatar[key] ?? '')}</Text>
              </View>
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
            onPress={() => {
              Alert.alert(
                'Delete body profile?',
                'Your height, measurements and fit preferences will be erased from this device. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: clearAvatar },
                ]
              );
            }}
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

        {/* Are you a brand? — large bold heading + sub copy + tap
            target. Sits below the policy footer per user direction
            April 29 2026: "Add a 'are you a brand' in large bold
            heading below privacy pages, delete account... keep the
            current setting for fonts/headings". Routes brands to the
            opt-out page for now (which is also the contact path).
            Replaceable with a dedicated /for-brands page later. */}
        <TouchableOpacity
          testID="brand-cta"
          style={styles.brandCta}
          onPress={() => Linking.openURL(BRAND_OPTOUT_URL)}
          activeOpacity={0.85}
        >
          <Text style={styles.brandCtaTitle}>are you a brand?</Text>
          <Text style={styles.brandCtaSubtitle}>
            Run a Shopify store? Send us a note → we'll set up consented size-chart access for your catalogue.
          </Text>
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
  // Google account card
  accountCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontFamily: fontFamily.primary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    // Light on dark gradient bg.
    color: whiteAlpha.textBodyStrong,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    // White-tinted pill on the dark bg.
    backgroundColor: whiteAlpha.surfaceMid,
  },
  editPillText: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  prefValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Glass list card for body profile + preferences — inner rows are
  // divided by hairlines except the last row.
  profileCard: {
    borderRadius: borderRadius.xl,
    padding: 4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: textAlpha.divider,
  },
  profileRowLast: {
    borderBottomWidth: 0,
  },
  profileLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  profileValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
  brandCtaTitle: {
    ...typography.headingXL,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  brandCtaSubtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    lineHeight: 19,
    color: whiteAlpha.textMuted,
    textAlign: 'center',
    maxWidth: 320,
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
