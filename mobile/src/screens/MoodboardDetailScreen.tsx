/**
 * Moodboard Detail Screen - Canvas editor
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useMoodboardStore } from '../store/moodboardStore';
import { RootStackParamList } from '../types';
import MoodboardCanvas from '../components/MoodboardCanvas';
import api from '../services/api';

type RouteProps = RouteProp<RootStackParamList, 'MoodboardDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MoodboardDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { moodboardId } = route.params;

  const {
    currentMoodboard,
    fetchMoodboard,
    updateMoodboard,
    isLoading,
  } = useMoodboardStore();

  const [isGeneratingLabels, setIsGeneratingLabels] = useState(false);

  useEffect(() => {
    fetchMoodboard(moodboardId);
  }, [moodboardId]);

  useEffect(() => {
    if (currentMoodboard) {
      navigation.setOptions({ title: currentMoodboard.name });
    }
  }, [currentMoodboard?.name]);

  const handleAddProduct = () => {
    navigation.navigate('AddProduct', { moodboardId });
  };

  const handleGenerateLabels = async () => {
    if (!currentMoodboard || currentMoodboard.products.length === 0) {
      Alert.alert('No Products', 'Add products to your moodboard first');
      return;
    }

    setIsGeneratingLabels(true);

    try {
      const imagePositions = currentMoodboard.products.map((p) => ({
        product_name: p.product.name,
        x: p.position.x,
        y: p.position.y,
        width: p.size.width,
        height: p.size.height,
      }));

      const response = await api.getSmartLabels(
        imagePositions,
        { font_size: 14, color: '#ffffff', placement_preference: 'auto' },
        currentMoodboard.canvas_size
      );

      // Update products with label positions
      const updatedProducts = currentMoodboard.products.map((product) => {
        const labelData = response.label_placements.find(
          (l) => l.product_name === product.product.name
        );
        if (labelData) {
          return {
            ...product,
            label: {
              position: labelData.position,
              text: product.product.name,
              justification: labelData.justification,
            },
          };
        }
        return product;
      });

      await updateMoodboard(moodboardId, { products: updatedProducts } as any);
      Alert.alert('Success', `Labels generated using ${response.method} method`);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate smart labels');
    } finally {
      setIsGeneratingLabels(false);
    }
  };

  const handleSave = async () => {
    if (!currentMoodboard) return;

    try {
      await updateMoodboard(moodboardId, currentMoodboard);
      Alert.alert('Saved', 'Your moodboard has been saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save moodboard');
    }
  };

  if (isLoading || !currentMoodboard) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolButton} onPress={handleAddProduct}>
          <Feather name="plus" size={18} color={colors.text} />
          <Text style={styles.toolLabel}>Add</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolButton}
          onPress={handleGenerateLabels}
          disabled={isGeneratingLabels}
        >
          <Feather name="tag" size={18} color={isGeneratingLabels ? colors.textMuted : colors.text} />
          <Text style={[styles.toolLabel, isGeneratingLabels && styles.toolLabelDisabled]}>
            {isGeneratingLabels ? '...' : 'Labels'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolButton}>
          <Feather name="droplet" size={18} color={colors.text} />
          <Text style={styles.toolLabel}>Theme</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolButton}>
          <Feather name="grid" size={18} color={colors.text} />
          <Text style={styles.toolLabel}>Layout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.toolButton, styles.saveButton]} onPress={handleSave}>
          <Feather name="save" size={18} color={colors.textOnPrimary} />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <MoodboardCanvas
          moodboard={currentMoodboard}
          width={SCREEN_WIDTH}
          height={SCREEN_WIDTH * (currentMoodboard.canvas_size.height / currentMoodboard.canvas_size.width)}
        />
      </View>

      {/* Product Count */}
      <View style={styles.footer}>
        <Text style={styles.productCount}>
          {currentMoodboard.products.length} products
        </Text>
        <Text style={styles.canvasSize}>
          {currentMoodboard.canvas_size.width} × {currentMoodboard.canvas_size.height}
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 52,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  toolLabel: {
    ...typography.label,
    color: colors.text,
  },
  toolLabelDisabled: {
    color: colors.textMuted,
  },
  saveButton: {
    backgroundColor: colors.primary,
    marginLeft: 'auto',
  },
  saveButtonText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  canvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  productCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  canvasSize: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
