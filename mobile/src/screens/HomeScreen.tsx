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
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import { scrapeProduct, nudgeBrand, extractBrandFromUrl } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedBrand, setFailedBrand] = useState<{ brandName: string; brandDomain: string } | null>(null);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudging, setNudging] = useState(false);
  const { avatar } = useAvatarStore();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      setUrl('');
      setError(null);
      setFailedBrand(null);
      setNudgeSent(false);
    }, [])
  );

  const handleCheckFit = useCallback(async (urlToCheck?: string) => {
    const targetUrl = (urlToCheck ?? url).trim();
    if (!targetUrl) {
      setError('Please enter a product URL');
      return;
    }

    if (!avatar) {
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
    } catch {
      const brand = extractBrandFromUrl(targetUrl);
      setFailedBrand(brand);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [url, avatar, navigation]);

  const handleUrlChange = (text: string) => {
    setUrl(text);
    if (error) {
      setError(null);
      setFailedBrand(null);
      setNudgeSent(false);
    }

    // Auto-trigger on valid URL paste (debounced)
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = text.trim();
    if (trimmed && isValidUrl(trimmed)) {
      debounceTimer.current = setTimeout(() => {
        handleCheckFit(trimmed);
      }, 700);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
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
          <View style={styles.inputCard}>
            <TextInput
              testID="url-input"
              style={styles.input}
              placeholder="Product URL"
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={handleUrlChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {error && !failedBrand && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.cta} />
                <Text style={styles.loadingText}>Checking fit…</Text>
              </View>
            )}
          </View>

          {/* Brand Nudge Card */}
          {failedBrand && (
            <View style={styles.nudgeCard}>
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
            </View>
          )}

          {/* Profile Setup Prompt */}
          {!avatar && (
            <TouchableOpacity
              style={styles.setupCard}
              onPress={() => navigation.navigate('AvatarSetup')}
              activeOpacity={0.8}
            >
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
              <View style={[styles.featureDot, { backgroundColor: colors.success }]} />
              <Text style={styles.featureText}>Save to your fit history</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  setupCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryLight + '40',
    ...shadows.sm,
  },
  setupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight + '20',
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
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  nudgeCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
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
    borderRadius: borderRadius.xl,
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
