/**
 * FitLoader — "Reading the size chart…" loading screen.
 *
 * Matches the Claude Design ScreenLoading mockup:
 *   - Glass URL pill at the top (link icon + truncated URL, if known)
 *   - Centered gradient hero circle (140 wide) with a spinning inner
 *     ring (110 wide, 2px white-top border rotating)
 *   - Italic serif headline "reading the size chart…"
 *   - Plain-body helper copy underneath
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';
import GlassCard from './GlassCard';

interface FitLoaderProps {
  title?: string;
  subtitle?: string;
  url?: string;
}

// Inner spinning ring — 110×110 circle with a full 2px border that's
// mostly semi-transparent white, with a hot-white top arc that spins.
// `transform: rotate` is cheap and GPU-accelerated.
function Spinner() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return <Animated.View style={[styles.spinner, ringStyle]} />;
}

// Truncate URL middle so it fits the glass pill without wrapping.
function shortUrl(url: string): string {
  const stripped = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (stripped.length <= 40) return stripped + '…';
  return stripped.slice(0, 40) + '…';
}

export default function FitLoader({
  title = 'reading the size chart…',
  subtitle = 'matching bust, waist and hip against your profile. usually under ten seconds.',
  url,
}: FitLoaderProps) {
  return (
    <View style={styles.container}>
      {/* URL pill at the top (only if a URL was passed in) */}
      {url ? (
        <View style={styles.pillWrap}>
          <GlassCard style={styles.urlPill}>
            <Feather name="link-2" size={14} color={colors.primary} />
            <Text style={styles.urlText} numberOfLines={1}>
              {shortUrl(url)}
            </Text>
          </GlassCard>
        </View>
      ) : null}

      {/* Centered hero spinner */}
      <View style={styles.hero}>
        <LinearGradient
          // Subtler 2-stop gradient (was 3-stop primaryLight→primary→
          // primaryDark). Reads closer to the design's solid dark orb
          // with a single top-to-bottom highlight.
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientCircle}
        >
          <Spinner />
        </LinearGradient>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 84,
    paddingHorizontal: spacing.lg,
  },
  pillWrap: {
    alignSelf: 'stretch',
  },
  urlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  urlText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
  },

  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 80,
  },
  gradientCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    // Purple-tinted glow — matches design's --shadow-glow.
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  spinner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    // Thinner (1.5px) than the previous 2px — reads more as a glow
    // halo than a mechanical ring. Upper arc lights up as it rotates.
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'transparent',
  },
  title: {
    // Italic serif display via the heading token (DM Serif Italic
    // lowercase) at a slightly reduced size for the loading context.
    ...typography.headingL,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
});
