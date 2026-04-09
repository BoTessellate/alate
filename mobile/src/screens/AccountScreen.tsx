import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useAccountStore, BrandSizeEntry } from '../store/accountStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';

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

// ─── Brand Size Add Modal ───────────────────────────────────────────────────

interface AddBrandSizeModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (brand: string, size: string, category?: string) => void;
}

function AddBrandSizeModal({ visible, onClose, onAdd }: AddBrandSizeModalProps) {
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');

  const handleAdd = () => {
    if (!brand.trim() || !size.trim()) {
      Alert.alert('Missing info', 'Please enter both brand name and size.');
      return;
    }
    onAdd(brand.trim(), size.trim(), category.trim() || undefined);
    setBrand('');
    setSize('');
    setCategory('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Add Brand Size</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={modalStyles.description}>
          Tell us what size you wear at a specific brand. This helps us improve fit predictions across brands.
        </Text>

        <View style={modalStyles.field}>
          <Text style={modalStyles.fieldLabel}>Brand Name</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Zara, ASOS, H&M"
            placeholderTextColor={colors.textMuted}
            value={brand}
            onChangeText={setBrand}
            autoCapitalize="words"
          />
        </View>

        <View style={modalStyles.field}>
          <Text style={modalStyles.fieldLabel}>Your Size</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. M, 12, US 8, EU 38"
            placeholderTextColor={colors.textMuted}
            value={size}
            onChangeText={setSize}
            autoCapitalize="characters"
          />
        </View>

        <View style={modalStyles.field}>
          <Text style={modalStyles.fieldLabel}>Category (optional)</Text>
          <TextInput
            style={modalStyles.input}
            placeholder="e.g. Tops, Dresses, Jeans"
            placeholderTextColor={colors.textMuted}
            value={category}
            onChangeText={setCategory}
            autoCapitalize="words"
          />
        </View>

        <TouchableOpacity style={modalStyles.addButton} onPress={handleAdd} activeOpacity={0.8}>
          <Text style={modalStyles.addButtonText}>Add Size</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { avatar, clearAvatar } = useAvatarStore();
  const { entries } = useFitHistoryStore();
  const { user, setUser, brandSizes, addBrandSize, removeBrandSize, clearAccount } = useAccountStore();

  const [addModalVisible, setAddModalVisible] = useState(false);

  // Google OAuth — fill in your client IDs from Google Cloud Console
  // See: https://docs.expo.dev/guides/authentication/#google
  const [request, response, promptAsync] = Google.useAuthRequest({
    // Replace these with your actual Google OAuth client IDs:
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetchGoogleUserInfo(authentication.accessToken);
      }
    }
  }, [response]);

  const fetchGoogleUserInfo = async (accessToken: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await res.json();
      setUser({
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        photoUrl: userInfo.picture,
      });
    } catch {
      Alert.alert('Sign-in failed', 'Unable to fetch your Google account details. Please try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Your local data (measurements, history) will be kept on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: clearAccount },
      ]
    );
  };

  const greatFits = entries.filter((e) => e.fitScore === 'great').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* ── Google Sign-In / Profile ─────────────────────────────── */}
        {user ? (
          <View style={styles.glassCard}>
            <View style={styles.profileRow}>
              {user.photoUrl ? (
                <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
                <View style={styles.syncBadge}>
                  <Feather name="cloud" size={11} color={colors.success} />
                  <Text style={styles.syncBadgeText}>Synced across devices</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.glassCard}>
            <View style={styles.signInHeader}>
              <Feather name="user" size={22} color={colors.primary} />
              <View style={styles.signInTextContainer}>
                <Text style={styles.signInTitle}>Sign in for cloud sync</Text>
                <Text style={styles.signInSubtitle}>
                  Your measurements and history stay on this device. Sign in to sync across all your devices.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.googleButton, !request && styles.buttonDisabled]}
              onPress={() => promptAsync()}
              disabled={!request}
              activeOpacity={0.8}
            >
              {/* Google G icon */}
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats Row ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{entries.length}</Text>
            <Text style={styles.statLabel}>Checked</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.success }]}>{greatFits}</Text>
            <Text style={styles.statLabel}>Great Fits</Text>
          </View>
        </View>

        {/* ── Body Profile ─────────────────────────────────────────── */}
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
          <View style={styles.profileCard}>
            <View style={styles.measureRow}>
              <Text style={styles.measureLabel}>Height</Text>
              <Text style={styles.measureValue}>
                {avatar.height_cm} cm ({Math.floor(avatar.height_cm / 30.48)}′
                {Math.round((avatar.height_cm / 2.54) % 12)}″)
              </Text>
            </View>
            {(
              ['shoulders', 'bust', 'waist', 'hips', 'thighs', 'torso_length'] as const
            ).map((key) => (
              <View key={key} style={styles.measureRow}>
                <Text style={styles.measureLabel}>{MEASUREMENT_LABELS[key]}</Text>
                <Text style={styles.measureValue}>{capitalize(avatar[key])}</Text>
              </View>
            ))}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.emptyProfileCard}
            onPress={() => navigation.navigate('AvatarSetup')}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyProfileIcon}>📏</Text>
            <Text style={styles.emptyProfileTitle}>Set up your body profile</Text>
            <Text style={styles.emptyProfileSubtitle}>
              Add your measurements to get accurate fit predictions and size recommendations
            </Text>
            <View style={styles.emptyProfileCta}>
              <Text style={styles.emptyProfileCtaText}>Get started →</Text>
            </View>
          </TouchableOpacity>
        )}

        {avatar && (
          <View style={styles.tipCard}>
            <Feather name="info" size={16} color={colors.accentDark} style={styles.tipIcon} />
            <Text style={styles.tipText}>
              Size accuracy improves the more you check products. Your fit history helps calibrate predictions over time.
            </Text>
          </View>
        )}

        {/* ── Brand Size Uploads ────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Brand Sizes</Text>
            <Text style={styles.sectionSubtitle}>Helps us improve fit predictions across brands</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={14} color={colors.accentDark} />
            <Text style={styles.editButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {brandSizes.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyBrandCard}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="tag" size={20} color={colors.accentDark} />
            <Text style={styles.emptyBrandTitle}>No brand sizes yet</Text>
            <Text style={styles.emptyBrandSubtitle}>
              Tell us what size you wear at specific brands — this trains our predictions
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.brandSizeList}>
            {brandSizes.map((entry: BrandSizeEntry) => (
              <View key={entry.id} style={styles.brandSizeRow}>
                <View style={styles.brandSizeInfo}>
                  <Text style={styles.brandSizeBrand}>{entry.brand}</Text>
                  {entry.category && (
                    <Text style={styles.brandSizeCategory}>{entry.category}</Text>
                  )}
                </View>
                <View style={styles.brandSizeBadge}>
                  <Text style={styles.brandSizeBadgeText}>{entry.size}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeBrandSize(entry.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.brandSizeDelete}
                >
                  <Feather name="x" size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => setAddModalVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={15} color={colors.cta} />
              <Text style={styles.addMoreText}>Add another brand</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reset Profile */}
        {avatar && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={clearAvatar}
            activeOpacity={0.7}
          >
            <Text style={styles.resetText}>Reset Body Profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AddBrandSizeModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={(brand, size, category) => addBrandSize({ brand, size, category })}
      />
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
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headingXL,
    color: colors.text,
  },

  // Glass card
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#402d65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },

  // Signed-in profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.backgroundSecondary,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...typography.labelLarge,
    color: colors.text,
    fontWeight: '700',
  },
  profileEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  syncBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '500',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.error + '10',
  },
  signOutText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },

  // Sign-in section
  signInHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  signInTextContainer: {
    flex: 1,
  },
  signInTitle: {
    ...typography.labelLarge,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  signInSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 16,
  },
  googleButtonText: {
    ...typography.labelLarge,
    color: colors.text,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
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

  // Section headers
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
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
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

  // Body profile card
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  measureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  measureLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  measureValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  emptyProfileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accentDark + '30',
    borderStyle: 'dashed',
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
    borderRadius: borderRadius.xl,
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
    backgroundColor: colors.accentDark + '12',
    borderRadius: borderRadius.xl,
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

  // Brand sizes
  emptyBrandCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyBrandTitle: {
    ...typography.labelLarge,
    color: colors.text,
  },
  emptyBrandSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  brandSizeList: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  brandSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  brandSizeInfo: {
    flex: 1,
  },
  brandSizeBrand: {
    ...typography.labelLarge,
    color: colors.text,
    fontWeight: '600',
  },
  brandSizeCategory: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  brandSizeBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  brandSizeBadgeText: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '700',
  },
  brandSizeDelete: {
    padding: 4,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  addMoreText: {
    ...typography.label,
    color: colors.cta,
    fontWeight: '600',
  },

  // Reset
  resetButton: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.error + '10',
    marginTop: spacing.sm,
  },
  resetText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingM,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
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
  addButton: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  addButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
});
