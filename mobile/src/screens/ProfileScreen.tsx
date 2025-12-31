/**
 * Profile Screen - User profile and settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();

  type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
  const menuItems: { icon: FeatherIconName; title: string; action: () => void }[] = [
    { icon: 'settings', title: 'Settings', action: () => navigation.navigate('Settings') },
    { icon: 'bell', title: 'Notifications', action: () => {} },
    { icon: 'sliders', title: 'Appearance', action: () => {} },
    { icon: 'upload', title: 'Export Options', action: () => {} },
    { icon: 'link', title: 'Connected Accounts', action: () => {} },
    { icon: 'help-circle', title: 'Help & Support', action: () => {} },
    { icon: 'file-text', title: 'Terms & Privacy', action: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Feather name="user" size={36} color={colors.textSecondary} />
          </View>
          <Text style={styles.userName}>Guest User</Text>
          <Text style={styles.userEmail}>Sign in to sync your moodboards</Text>
          <TouchableOpacity style={styles.signInButton}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Moodboards</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.action}
            >
              <Feather name={item.icon} size={20} color={colors.textSecondary} style={styles.menuIcon} />
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>TML Moodboard</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.aiPowered}>Powered by Claude Opus 4.5</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarIcon: {},
  userName: {
    ...typography.h2,
    color: colors.text,
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  signInButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  menuContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    marginRight: spacing.md,
  },
  menuTitle: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  menuArrow: {},
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  appName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  appVersion: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  aiPowered: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});
