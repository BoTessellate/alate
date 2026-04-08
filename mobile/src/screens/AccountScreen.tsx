import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';

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

export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { avatar, clearAvatar } = useAvatarStore();
  const { entries } = useFitHistoryStore();

  const greatFits = entries.filter((e) => e.fitScore === 'great').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Stats Row */}
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
          <View style={styles.profileCard}>
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
                <Text style={styles.profileValue}>{capitalize(avatar[key])}</Text>
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

        {/* Size Accuracy Tip */}
        {avatar && (
          <View style={styles.tipCard}>
            <Feather name="info" size={16} color={colors.accentDark} style={styles.tipIcon} />
            <Text style={styles.tipText}>
              Size accuracy improves the more you check products. Your fit history helps calibrate predictions over time.
            </Text>
          </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
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
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.accentDark + '40',
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
    borderRadius: borderRadius.lg,
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
    borderRadius: borderRadius.lg,
    backgroundColor: colors.error + '10',
  },
  resetText: {
    ...typography.label,
    color: colors.error,
    fontWeight: '600',
  },
});
