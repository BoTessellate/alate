/**
 * FitLoader - Animated loading component for fit analysis
 * Uses react-native-reanimated for smooth, brand-aligned animation
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';

interface FitLoaderProps {
  title?: string;
  subtitle?: string;
}

function PulseRing() {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(0.8, { duration: 900, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(0.6, { duration: 900, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseRing, ringStyle]} />;
}

export default function FitLoader({
  title = 'Analysing fit…',
  subtitle = 'Checking measurements and material',
}: FitLoaderProps) {
  return (
    <View style={styles.container}>
      {/* Icon with pulse ring */}
      <View style={styles.iconWrapper}>
        <PulseRing />
        <View style={styles.iconContainer}>
          <Feather name="shopping-bag" size={32} color={colors.cta} />
        </View>
      </View>

      {/* Circular spinner */}
      <ActivityIndicator
        size="large"
        color={colors.cta}
        style={styles.spinner}
      />

      {/* Text */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.cta,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cta + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headingM,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
