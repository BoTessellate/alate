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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useAccountStore, GoogleUser } from '../store/accountStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { captureError } from '../utils/sentry';
import FitCalibrationCard from '../components/FitCalibrationCard';
import GlassCard from '../components/GlassCard';

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
        <TouchableOpacity style={styles.googleButton} onPress={onSignIn} activeOpacity={0.8}>
          <Feather name="log-in" size={18} color={colors.white} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
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

  const greatFits = entries.filter((e) => e.fitScore === 'great').length;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Google account card — isolated so a hook crash here can't blank the page */}
        <GoogleSignInCard />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statNumber}>{entries.length}</Text>
            <Text style={styles.statLabel}>Checked</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statNumber}>{greatFits}</Text>
            <Text style={styles.statLabel}>Great Fits</Text>
          </GlassCard>
        </View>

        {/* Body Profile */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Body Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('AvatarSetup')}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={14} color={colors.accentDark} />
            <Text style={styles.editButtonText}>{avatar ? 'Edit' : 'Set up'}</Text>
          </TouchableOpacity>
        </View>

        {avatar ? (
          <GlassCard style={styles.profileCard}>
            {/* Height row */}
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Height</Text>
              <Text style={styles.profileValue}>
                {avatar.height_cm} cm ({Math.floor(avatar.height_cm / 30.48)}′
                {Math.round((avatar.height_cm / 2.54) % 12)}″)
              </Text>
            </View>
            {(
              ['shoulders', 'bust', 'waist', 'hips', 'thighs', 'torso_length'] as const
            ).map((key) => (
              <View key={key} style={styles.profileRow}>
                <Text style={styles.profileLabel}>{MEASUREMENT_LABELS[key]}</Text>
                <Text style={styles.profileValue}>{capitalize(avatar[key] ?? '')}</Text>
              </View>
            ))}
          </GlassCard>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.navigate('AvatarSetup')}
            activeOpacity={0.8}
          >
            <GlassCard style={styles.emptyProfileCard}>
              <Text style={styles.emptyProfileIcon}>📏</Text>
              <Text style={styles.emptyProfileTitle}>Set up your body profile</Text>
              <Text style={styles.emptyProfileSubtitle}>
                Add your measurements to get accurate fit predictions and size recommendations
              </Text>
              <View style={styles.emptyProfileCta}>
                <Text style={styles.emptyProfileCtaText}>Get started →</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}

        {/* Fit Calibration — Zalando "user's normal size" anchor */}
        {avatar && <FitCalibrationCard />}

        {/* Tip */}
        {avatar && (
          <GlassCard style={styles.tipCard}>
            <Feather name="info" size={16} color={colors.accentDark} style={styles.tipIcon} />
            <Text style={styles.tipText}>
              Size accuracy improves the more you check products. Your fit history helps calibrate predictions over time.
            </Text>
          </GlassCard>
        )}

        {/* Reset Profile */}
        {avatar && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={clearAvatar}
            activeOpacity={0.7}
          >
            <Text style={styles.resetText}>Reset Profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    ...typography.displayMedium,
    color: colors.text,
    textAlign: 'center',
  },
  // Google account card
  accountCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
    backgroundColor: 'rgba(106, 95, 117, 0.12)',
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
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headingS,
    color: colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.accentDark + '18',
  },
  editButtonText: {
    ...typography.label,
    color: colors.accentDark,
    fontWeight: '600',
  },
  // Profile card
  profileCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(106, 95, 117, 0.1)',
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
    backgroundColor: colors.error + '10',
  },
  resetText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },
});
