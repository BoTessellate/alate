/**
 * Library Screen - All moodboards and saved products
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useMoodboardStore } from '../store/moodboardStore';
import { RootStackParamList, Moodboard } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'moodboards' | 'products';

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { moodboards, isLoading, fetchMoodboards } = useMoodboardStore();
  const [activeTab, setActiveTab] = useState<TabType>('moodboards');

  useEffect(() => {
    fetchMoodboards();
  }, []);

  const renderMoodboard = ({ item }: { item: Moodboard }) => (
    <TouchableOpacity
      style={styles.moodboardCard}
      onPress={() => navigation.navigate('MoodboardDetail', { moodboardId: item.id })}
    >
      <View style={styles.moodboardPreview}>
        {item.products.length > 0 ? (
          <View style={styles.previewGrid}>
            {item.products.slice(0, 4).map((p, index) => (
              <View key={index} style={styles.previewCell}>
                <Feather name="image" size={24} color={colors.textMuted} />
              </View>
            ))}
          </View>
        ) : (
          <Feather name="layout" size={48} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.moodboardInfo}>
        <Text style={styles.moodboardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.moodboardMeta}>
          {item.products.length} items • Updated{' '}
          {new Date(item.updated_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'moodboards' && styles.tabActive]}
            onPress={() => setActiveTab('moodboards')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'moodboards' && styles.tabTextActive,
              ]}
            >
              Moodboards
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'products' && styles.tabActive]}
            onPress={() => setActiveTab('products')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'products' && styles.tabTextActive,
              ]}
            >
              Products
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'moodboards' ? (
        <FlatList
          data={moodboards}
          renderItem={renderMoodboard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchMoodboards}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="folder" size={48} color={colors.textMuted} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No moodboards yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first moodboard to see it here
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Feather name="package" size={48} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Product library coming soon</Text>
          <Text style={styles.emptySubtitle}>
            Your saved products will appear here
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  moodboardCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  moodboardPreview: {
    height: 160,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  previewCell: {
    width: '50%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  previewIcon: {},
  emptyPreview: {},
  moodboardInfo: {
    padding: spacing.md,
  },
  moodboardName: {
    ...typography.h3,
    color: colors.text,
  },
  moodboardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
  },
});
