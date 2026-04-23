import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const INTEGRATION_STEPS: { icon: FeatherIconName; title: string; description: string }[] = [
  {
    icon: 'upload',
    title: 'Connect your product catalogue',
    description: 'Share your sizing data, size charts, and product database via API or CSV upload.',
  },
  {
    icon: 'cpu',
    title: 'We map your sizing to real bodies',
    description:
      'Our engine matches your sizing specs against detailed body profiles — shoulders, bust, waist, hips, and more.',
  },
  {
    icon: 'trending-down',
    title: 'Reduce returns, increase confidence',
    description:
      'Shoppers get accurate fit predictions before they buy. Fewer returns, happier customers.',
  },
];

const STATS: { value: string; label: string }[] = [
  { value: '30-40%', label: 'of online clothing returns are size-related' },
  { value: '7x', label: 'more likely to buy with fit confidence' },
  { value: '< 1 day', label: 'to integrate via our API' },
];

export default function BrandIntegrationScreen() {
  const handleGetInTouch = () => {
    Linking.openURL('mailto:partners@fitcheck.app?subject=Brand%20Integration%20Inquiry');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Feather name="briefcase" size={14} color={colors.secondary} />
            <Text style={styles.badgeText}>For Brands</Text>
          </View>
          <Text style={styles.title}>
            Help your customers{'\n'}find their perfect fit
          </Text>
          <Text style={styles.subtitle}>
            Connect your product sizing data and let shoppers check fit before they buy — reducing
            returns and boosting conversion.
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>How it works</Text>
        </View>

        {INTEGRATION_STEPS.map((step, i) => (
          <View key={i} style={styles.stepCard}>
            <View style={styles.stepIconContainer}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Feather name={step.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}

        {/* What you provide */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What we need from you</Text>
        </View>

        <View style={styles.listCard}>
          {[
            'Product catalogue with sizing info (S/M/L or numeric)',
            'Size charts with measurements per size',
            'Optional: model height and size worn for each product',
            'Optional: fit type tags (slim, regular, oversized)',
          ].map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Feather
                name={i < 2 ? 'check-circle' : 'plus-circle'}
                size={16}
                color={i < 2 ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.listText, i >= 2 && styles.listTextOptional]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Ready to reduce size-related returns?</Text>
          <Text style={styles.ctaSubtitle}>
            Get in touch and we'll set up your integration in under a day.
          </Text>
          <TouchableOpacity style={styles.ctaButton} onPress={handleGetInTouch} activeOpacity={0.8}>
            <Feather name="mail" size={18} color={colors.white} />
            <Text style={styles.ctaButtonText}>Get in touch</Text>
          </TouchableOpacity>
        </View>

          <Text style={styles.footerNote}>
            Currently onboarding select brand partners for our early access programme.
          </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    marginBottom: spacing.md,
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.secondary,
    fontWeight: '600',
  },
  title: {
    ...typography.headingXL,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    // Frosted glass surface — matches GlassCard look without the BlurView
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.glass,
  },
  statValue: {
    ...typography.headingM,
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headingM,
    color: colors.text,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.glass,
  },
  stepIconContainer: {
    width: 44,
    alignItems: 'center',
    gap: 6,
  },
  stepNumber: {
    ...typography.labelSmall,
    color: colors.textMuted,
  },
  stepContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  stepTitle: {
    ...typography.headingS,
    color: colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
    ...shadows.glass,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  listText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  listTextOptional: {
    color: colors.textSecondary,
  },
  ctaCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  ctaTitle: {
    ...typography.headingS,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  ctaSubtitle: {
    ...typography.bodySmall,
    color: colors.white + 'CC',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    ...shadows.sm,
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
