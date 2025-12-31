/**
 * Add Product Screen - URL scraping and product addition
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useMoodboardStore } from '../store/moodboardStore';
import { RootStackParamList, Product, ScrapedProduct } from '../types';
import api from '../services/api';

type RouteProps = RouteProp<RootStackParamList, 'AddProduct'>;

export default function AddProductScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { moodboardId } = route.params || {};

  const { addProduct } = useMoodboardStore();

  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedProduct | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichedProduct, setEnrichedProduct] = useState<Product | null>(null);

  const handlePasteFromClipboard = async () => {
    const clipboardContent = await Clipboard.getStringAsync();
    if (clipboardContent) {
      setUrl(clipboardContent);
    }
  };

  const handleScrape = async () => {
    if (!url.trim()) {
      Alert.alert('URL Required', 'Please enter a product URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      Alert.alert('Invalid URL', 'Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    setScrapedData(null);
    setEnrichedProduct(null);

    try {
      const data = await api.scrapeUrl(url);
      setScrapedData(data);

      // Auto-enrich the product
      setIsEnriching(true);
      const enrichResponse = await api.enrichProduct({
        name: data.title || 'Unknown Product',
        brand: data.brandName,
        price: data.price ? parseFloat(data.price) : undefined,
        currency: data.currency,
        image_url: data.imageUrl,
        source_url: url,
      });

      setEnrichedProduct(enrichResponse.product);
    } catch (error) {
      console.error('Scrape failed:', error);
      Alert.alert('Scraping Failed', 'Could not extract product data from this URL');
    } finally {
      setIsLoading(false);
      setIsEnriching(false);
    }
  };

  const handleAddToMoodboard = () => {
    if (!enrichedProduct) return;

    addProduct(enrichedProduct);
    Alert.alert('Added!', 'Product added to your moodboard', [
      { text: 'Add Another', onPress: () => resetForm() },
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  const resetForm = () => {
    setUrl('');
    setScrapedData(null);
    setEnrichedProduct(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* URL Input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Product URL</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/product"
                placeholderTextColor={colors.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={styles.pasteButton}
                onPress={handlePasteFromClipboard}
              >
                <Feather name="clipboard" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.scrapeButton, isLoading && styles.scrapeButtonDisabled]}
              onPress={handleScrape}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.scrapeButtonText}>Extract Product</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Scraped Result */}
          {scrapedData && (
            <View style={styles.resultSection}>
              <Text style={styles.sectionTitle}>Extracted Data</Text>

              <View style={styles.resultCard}>
                {scrapedData.imageUrl && (
                  <Image
                    source={{ uri: scrapedData.imageUrl }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                )}

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {scrapedData.title || 'Unknown Product'}
                  </Text>

                  {scrapedData.brandName && (
                    <Text style={styles.productBrand}>{scrapedData.brandName}</Text>
                  )}

                  {scrapedData.price && (
                    <Text style={styles.productPrice}>
                      {scrapedData.currency} {scrapedData.price}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Enrichment Status */}
          {isEnriching && (
            <View style={styles.enrichingStatus}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.enrichingText}>
                AI is analyzing product details...
              </Text>
            </View>
          )}

          {/* Enriched Product */}
          {enrichedProduct && (
            <View style={styles.resultSection}>
              <Text style={styles.sectionTitle}>AI Enrichment</Text>

              <View style={styles.enrichmentCard}>
                {enrichedProduct.tags && enrichedProduct.tags.length > 0 && (
                  <View style={styles.enrichmentRow}>
                    <Text style={styles.enrichmentLabel}>Tags</Text>
                    <View style={styles.tagContainer}>
                      {enrichedProduct.tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {enrichedProduct.color_palette && enrichedProduct.color_palette.length > 0 && (
                  <View style={styles.enrichmentRow}>
                    <Text style={styles.enrichmentLabel}>Colors</Text>
                    <View style={styles.colorContainer}>
                      {enrichedProduct.color_palette.map((color, index) => (
                        <View key={index} style={styles.colorChip}>
                          <Text style={styles.colorText}>{color}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {enrichedProduct.material && (
                  <View style={styles.enrichmentRow}>
                    <Text style={styles.enrichmentLabel}>Material</Text>
                    <Text style={styles.enrichmentValue}>{enrichedProduct.material}</Text>
                  </View>
                )}

                {enrichedProduct.tone && (
                  <View style={styles.enrichmentRow}>
                    <Text style={styles.enrichmentLabel}>Tone</Text>
                    <Text style={styles.enrichmentValue}>{enrichedProduct.tone}</Text>
                  </View>
                )}

                {enrichedProduct.category && (
                  <View style={styles.enrichmentRow}>
                    <Text style={styles.enrichmentLabel}>Category</Text>
                    <Text style={styles.enrichmentValue}>{enrichedProduct.category}</Text>
                  </View>
                )}
              </View>

              {/* Add Button */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddToMoodboard}
              >
                <Text style={styles.addButtonText}>
                  {moodboardId ? 'Add to Moodboard' : 'Save Product'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
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
  pasteButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pasteButtonIcon: {},
  scrapeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.md,
  },
  scrapeButtonDisabled: {
    backgroundColor: colors.primaryDark,
    opacity: 0.7,
  },
  scrapeButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  resultSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  productImage: {
    width: '100%',
    height: 200,
  },
  productInfo: {
    padding: spacing.md,
  },
  productName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  productBrand: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  productPrice: {
    ...typography.h3,
    color: colors.success,
    marginTop: spacing.sm,
  },
  enrichingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  enrichingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  enrichmentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  enrichmentRow: {
    marginBottom: spacing.md,
  },
  enrichmentLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  enrichmentValue: {
    ...typography.body,
    color: colors.text,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    ...typography.caption,
    color: colors.primaryLight,
  },
  colorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  colorChip: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  colorText: {
    ...typography.caption,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.md,
  },
  addButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
});
