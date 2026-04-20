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
import GlassCard from '../components/GlassCard';
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
  const { avatar } = useAvatarStore();
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
    setNudgeSent(false);

    try {
      const result = await scrapeProduct(targetUrl);
      if (result.success && result.data) {
        navigation.navigate('FitResult', { product: result.data, url: targetUrl });
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

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
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
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Will it fit?</Text>
            <Text style={styles.subtitle}>
              Paste any product URL to instantly check{'\n'}if it'll fit your body perfectly
            </Text>
          </View>

          {/* Input Card */}
          <GlassCard style={styles.inputCard}>
            <Text style={styles.inputLabel}>Product URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                testID="url-input"
                style={styles.input}
                placeholder="Paste ASOS, Zara, or any product URL..."
                placeholderTextColor={colors.textMuted}
                value={url}
                onChangeText={handleUrlChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

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
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Check Fit</Text>
              )}
            </TouchableOpacity>
          </GlassCard>

          {/* Brand Nudge Card */}
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

          {/* Profile Setup Prompt */}
          {!avatar && (
            <TouchableOpacity
              onPress={() => navigation.navigate('AvatarSetup')}
              activeOpacity={0.8}
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

          {/* Feature Highlights */}
          <View style={styles.featuresSection}>
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.featureText}>Works with 100+ fashion sites</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: colors.secondary }]} />
              <Text style={styles.featureText}>Instant AI-powered fit analysis</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: colors.accentDark }]} />
              <Text style={styles.featureText}>Save to your fit history</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  title: {
    ...typography.displayMedium,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputCard: {
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.overline,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 0,
    ...typography.body,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(90, 67, 119, 0.15)',
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
    borderRadius: borderRadius.lg,
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
    borderRadius: borderRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  nudgeButtonText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '600',
  },
  featuresSection: {
    paddingTop: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
