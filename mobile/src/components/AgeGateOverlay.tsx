/**
 * Age gate overlay — shown on first launch (and after body-profile
 * deletion). Blocks the UI until the user confirms they're 16 or older.
 *
 * Why 16: GDPR Article 8 default age of digital consent + India's
 * DPDPA pending rules which treat everyone under 18 as requiring
 * guardian consent. 16 is the stricter of what's practically
 * achievable without a guardian-consent flow; it covers us for most
 * jurisdictions we're likely to ship into.
 *
 * The overlay is ephemeral — body measurements are sensitive data and
 * we don't want underage users submitting them. Tapping "I'm 16+"
 * persists a timestamp via useAgeGateStore; tapping "I'm under 16"
 * shows a soft deflection instead of proceeding.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, fontFamily } from '../constants/theme';
import { useAgeGateStore } from '../store/ageGateStore';
import GlassCard from './GlassCard';
import HeadingImage from './HeadingImage';

export default function AgeGateOverlay() {
  const insets = useSafeAreaInsets();
  const confirm = useAgeGateStore((s) => s.confirm);
  const declineAsUnder16 = useAgeGateStore((s) => s.declineAsUnder16);
  const declaredUnder16 = useAgeGateStore((s) => s.declaredUnder16);

  // Show the deflection screen when the user has actively declined
  // as under-16 — either right now this session OR on a previous
  // launch (declaredUnder16 persists). Persistence matters because
  // ShareIntent gating depends on the same flag, and a fresh launch
  // by an under-16 user shouldn't see the entry screen again as if
  // they could change their answer.
  const [pressedUnder16, setPressedUnder16] = useState(false);
  const showDeflection = declaredUnder16 || pressedUnder16;

  if (showDeflection) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
          locations={[0, 0.3, 0.6, 0.9]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <GlassCard style={styles.card}>
            <Feather name="heart" size={28} color={colors.primary} />
            <Text style={styles.deflectTitle}>Thank you for being honest</Text>
            <Text style={styles.deflectBody}>
              Alate collects body measurements to predict garment fit, so we ask users to
              be 16 or older. Please come back when you meet the age requirement — we'll
              be here.
            </Text>
          </GlassCard>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="age-gate-overlay">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#b4afbb', '#8a7e94', '#6a5f75', '#4c4356']}
        locations={[0, 0.3, 0.6, 0.9]}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <GlassCard style={styles.card}>
          <HeadingImage
            slot="home-verse"
            fallback="Before we begin"
            height={72}
            color={colors.text}
            textStyle={styles.title}
          />
          <Text style={styles.body}>
            Alate predicts garment fit using your height and measurements. To keep
            things safe, we ask all users to confirm they're 16 or older.
          </Text>
          <Text style={styles.subtle}>
            Your body profile stays on this device. We never send it anywhere you haven't
            approved.
          </Text>
          <TouchableOpacity
            testID="age-gate-confirm"
            style={styles.primaryBtn}
            onPress={confirm}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>I'm 16 or older</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="age-gate-decline"
            style={styles.secondaryBtn}
            onPress={() => {
              setPressedUnder16(true);
              declineAsUnder16();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>I'm under 16</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.displayMedium,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  subtle: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 15,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  deflectTitle: {
    // Bumped to headingXL to match the "are you a brand?" CTA voice;
    // headingM read too small as a deflect-screen title.
    ...typography.headingXL,
    color: colors.text,
    textAlign: 'center',
  },
  deflectBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
