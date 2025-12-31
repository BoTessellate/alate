/**
 * Home Screen - Dashboard with recent moodboards
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useMoodboardStore } from '../store/moodboardStore';
import { RootStackParamList, MainTabParamList } from '../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { moodboards, isLoading, fetchMoodboards } = useMoodboardStore();

  useEffect(() => {
    fetchMoodboards();
  }, []);

  const recentMoodboards = moodboards.slice(0, 6);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchMoodboards}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.title}>Your Moodboards</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, styles.primaryAction]}
            onPress={() => navigation.navigate('AddProduct', {})}
          >
            <Feather name="link" size={28} color={colors.text} style={styles.actionIcon} />
            <Text style={styles.actionTitle}>Paste URL</Text>
            <Text style={styles.actionSubtitle}>Add from any website</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.secondaryAction]}
            onPress={() => navigation.navigate('Create')}
          >
            <Feather name="plus-square" size={28} color={colors.text} style={styles.actionIcon} />
            <Text style={styles.actionTitle}>New Board</Text>
            <Text style={styles.actionSubtitle}>Start fresh</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Moodboards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Library')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentMoodboards.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="layout" size={48} color={colors.textMuted} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No moodboards yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first moodboard to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('Create')}
              >
                <Text style={styles.emptyButtonText}>Create Moodboard</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.moodboardGrid}>
              {recentMoodboards.map((board) => (
                <TouchableOpacity
                  key={board.id}
                  style={styles.moodboardCard}
                  onPress={() => navigation.navigate('MoodboardDetail', { moodboardId: board.id })}
                >
                  <View style={styles.moodboardPreview}>
                    <Feather
                      name={board.products.length > 0 ? 'grid' : 'layout'}
                      size={32}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text style={styles.moodboardName} numberOfLines={1}>
                    {board.name}
                  </Text>
                  <Text style={styles.moodboardMeta}>
                    {board.products.length} items
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  header: {
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  primaryAction: {
    backgroundColor: colors.primary,
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    marginBottom: spacing.sm,
  },
  actionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  seeAll: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  moodboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  moodboardCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  moodboardPreview: {
    height: 120,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholder: {},
  moodboardName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    padding: spacing.sm,
    paddingBottom: spacing.xs,
  },
  moodboardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
