/**
 * Explore Screen - Semantic search and discovery
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import api from '../services/api';
import { SearchResult, Product } from '../types';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await api.searchProducts(query);
      setResults(response.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity style={styles.resultCard}>
      {item.product.image_url ? (
        <Image
          source={{ uri: item.product.image_url }}
          style={styles.resultImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.resultImage, styles.placeholderImage]}>
          <Feather name="package" size={32} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={2}>
          {item.product.name}
        </Text>
        {item.product.brand && (
          <Text style={styles.resultBrand}>{item.product.brand}</Text>
        )}
        {item.product.tags && item.product.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {item.product.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.scoreText}>
          Match: {Math.round(item.score * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );

  const suggestedSearches = [
    'minimalist home decor',
    'bohemian textiles',
    'scandinavian furniture',
    'warm earthy tones',
    'modern ceramic vases',
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>
          Search products with natural language powered by AI
        </Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Describe what you're looking for..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Feather name="search" size={20} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {!hasSearched ? (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Try searching for:</Text>
          <View style={styles.suggestionsList}>
            {suggestedSearches.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => {
                  setQuery(suggestion);
                  handleSearch();
                }}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : results.length === 0 && !isSearching ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={48} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search or add more products to your library
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.product_id}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
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
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonIcon: {},
  suggestionsContainer: {
    padding: spacing.md,
  },
  suggestionsTitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  resultsList: {
    padding: spacing.md,
    gap: spacing.md,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  resultImage: {
    width: 100,
    height: 100,
  },
  placeholderImage: {
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {},
  resultInfo: {
    flex: 1,
    padding: spacing.sm,
  },
  resultName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  resultBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    ...typography.caption,
    color: colors.primaryLight,
  },
  scoreText: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.sm,
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
