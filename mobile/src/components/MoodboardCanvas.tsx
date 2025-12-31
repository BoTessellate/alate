/**
 * Moodboard Canvas Component
 * Interactive canvas for arranging products with gesture support
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { Moodboard, MoodboardProduct } from '../types';
import { useMoodboardStore } from '../store/moodboardStore';

interface MoodboardCanvasProps {
  moodboard: Moodboard;
  width: number;
  height: number;
}

interface DraggableProductProps {
  item: MoodboardProduct;
  canvasScale: number;
}

function DraggableProduct({ item, canvasScale }: DraggableProductProps) {
  const { updateProductPosition, selectProduct, selectedProductId } = useMoodboardStore();

  const translateX = useSharedValue(item.position.x * canvasScale);
  const translateY = useSharedValue(item.position.y * canvasScale);
  const scale = useSharedValue(1);
  const isSelected = selectedProductId === item.id;

  const onPositionUpdate = (x: number, y: number) => {
    updateProductPosition(item.id, {
      x: x / canvasScale,
      y: y / canvasScale,
    });
  };

  const onSelect = () => {
    selectProduct(item.id);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(1.05);
      runOnJS(onSelect)();
    })
    .onUpdate((event) => {
      translateX.value = item.position.x * canvasScale + event.translationX;
      translateY.value = item.position.y * canvasScale + event.translationY;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      runOnJS(onPositionUpdate)(translateX.value, translateY.value);
    });

  const tapGesture = Gesture.Tap().onStart(() => {
    runOnJS(onSelect)();
  });

  const composed = Gesture.Simultaneous(tapGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const scaledWidth = item.size.width * canvasScale;
  const scaledHeight = item.size.height * canvasScale;

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.productContainer,
          animatedStyle,
          {
            width: scaledWidth,
            height: scaledHeight,
          },
          isSelected && styles.productSelected,
        ]}
      >
        {item.product.image_url ? (
          <Image
            source={{ uri: item.product.image_url }}
            style={styles.productImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Feather name="package" size={32} color={colors.textMuted} />
          </View>
        )}

        {/* Label */}
        {item.label && (
          <View
            style={[
              styles.label,
              {
                left: (item.label.position.x - item.position.x) * canvasScale,
                top: (item.label.position.y - item.position.y) * canvasScale,
              },
            ]}
          >
            <Text style={styles.labelText} numberOfLines={1}>
              {item.label.text}
            </Text>
          </View>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <>
            <View style={[styles.handle, styles.handleTopLeft]} />
            <View style={[styles.handle, styles.handleTopRight]} />
            <View style={[styles.handle, styles.handleBottomLeft]} />
            <View style={[styles.handle, styles.handleBottomRight]} />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export default function MoodboardCanvas({ moodboard, width, height }: MoodboardCanvasProps) {
  const { selectProduct } = useMoodboardStore();

  // Calculate scale to fit canvas in view
  const canvasScale = Math.min(
    width / moodboard.canvas_size.width,
    height / moodboard.canvas_size.height
  );

  const scaledWidth = moodboard.canvas_size.width * canvasScale;
  const scaledHeight = moodboard.canvas_size.height * canvasScale;

  const handleCanvasTap = () => {
    selectProduct(null);
  };

  const bgTapGesture = Gesture.Tap().onStart(() => {
    runOnJS(handleCanvasTap)();
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={bgTapGesture}>
        <View
          style={[
            styles.canvas,
            {
              width: scaledWidth,
              height: scaledHeight,
              backgroundColor: moodboard.theme?.colors.background || colors.surface,
            },
          ]}
        >
          {/* Empty state */}
          {moodboard.products.length === 0 && (
            <View style={styles.emptyCanvas}>
              <Text style={styles.emptyText}>Add products to your moodboard</Text>
              <Text style={styles.emptyHint}>
                Tap "+ Add" in the toolbar to get started
              </Text>
            </View>
          )}

          {/* Products */}
          {moodboard.products.map((product) => (
            <DraggableProduct
              key={product.id}
              item={product}
              canvasScale={canvasScale}
            />
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.headingS,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
  productContainer: {
    position: 'absolute',
    borderRadius: borderRadius.sm,
    overflow: 'visible',
  },
  productSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {},
  label: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    maxWidth: 150,
  },
  labelText: {
    ...typography.caption,
    color: colors.text,
  },
  handle: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: colors.primary,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.text,
  },
  handleTopLeft: {
    top: -6,
    left: -6,
  },
  handleTopRight: {
    top: -6,
    right: -6,
  },
  handleBottomLeft: {
    bottom: -6,
    left: -6,
  },
  handleBottomRight: {
    bottom: -6,
    right: -6,
  },
});
