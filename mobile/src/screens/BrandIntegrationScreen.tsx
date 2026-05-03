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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { captureError } from '../utils/sentry';
import {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  whiteAlpha,
  fontFamily,
} from '../constants/theme';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

// "How it works" step list. Step numbers (1, 2, 3) were retired May 3
// 2026 PM per user feedback ("remove numberings 1,2,3 from 'how it
// works'") — the icon + ordered list reads as sequential without a
// loud digit. Title + description carry the meaning.
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

// Stat strip — three equal-width cards under the hero.
//
// "30-40%" was the source of a wrap-on-Pixel-2-XL bug (May 3 2026 PM
// user report: "% shows up on the second row. Only the % sign which
// looks odd"). Two-line layout per stat (split into `value` +
// optional `unit` rendered on its own line) sidesteps the wrap
// entirely and reads more deliberately as a stat. The unit string is
// optional — "7x" / "<1d" stay as a single value with `unit: undefined`.
type Stat = { value: string; unit?: string; label: string };
const STATS: Stat[] = [
  { value: '30–40', unit: '%', label: 'of online clothing returns are size-related' },
  { value: '7x', label: 'more likely to buy with fit confidence' },
  { value: '< 1', unit: 'day', label: 'to integrate via our API' },
];

// Email destination for partner inquiries. Wired to the user's own
// inbox for now (per CLAUDE.md userEmail context — `ramsaptami@gmail.com`)
// because the project doesn't yet have a partners@ inbox provisioned.
// Replace with the brand-facing alias when DNS / forwarding is set up.
const PARTNER_INQUIRY_EMAIL = 'ramsaptami@gmail.com';

export default function BrandIntegrationScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleGetInTouch = async () => {
    const subject = encodeURIComponent('Brand integration inquiry — alate');
    const body = encodeURIComponent(
      "Hi alate team,\n\nWe're interested in integrating our sizing data with alate. " +
        'Here are a few details about us:\n\n' +
        '• Brand:\n• Storefront URL:\n• Approx. catalogue size:\n• Best contact:\n\n' +
        'Looking forward to hearing back.\n',
    );
    const url = `mailto:${PARTNER_INQUIRY_EMAIL}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        // Some Android devices return false for mailto: even when an
        // email app is installed; try anyway and let the OS resolve.
        await Linking.openURL(url);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      // Most common cause: no mail client installed. Surface so we can
      // see how often this fires and consider an in-app form fallback.
      captureError(err, { feature: 'brand-integration', action: 'get-in-touch' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Custom back chevron — same pattern as FitResult / AvatarSetup
          since the native stack header is hidden. Sits at the top-left
          edge with a translucent dark fill so it reads above the
          backgroundless screen content. */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Feather name="chevron-left" size={22} color={colors.text} />
      </TouchableOpacity>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
      >
        {/* Header — page title only. The "For Brands" badge that
            sat above the title was retired May 3 2026 PM (user
            feedback: "remove redundant 'for brands' next to the
            back icon… the icon and pill design says it all"). */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Help your customers{'\n'}find their perfect fit
          </Text>
          <Text style={styles.subtitle}>
            Connect your product sizing data and let shoppers check fit before they buy — reducing
            returns and boosting conversion.
          </Text>
        </View>

        {/* Stats — three equal cards. Two-line value layout (number
            line + optional unit line) so "30–40 %" doesn't orphan
            the percent sign on small viewports. */}
        <View style={styles.statsRow}>
          {STATS.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <View style={styles.statValueWrap}>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {stat.value}
                </Text>
                {stat.unit && <Text style={styles.statUnit}>{stat.unit}</Text>}
              </View>
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
              <Feather name={step.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}

        {/* What you provide — section header gets the same top
            spacing as the previous one so the rhythm matches across
            sections (May 3 2026 PM user feedback: "what we need
            from you does not have enough spacing as the previous
            section does"). */}
        <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
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
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleGetInTouch}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Get in touch about brand integration"
          >
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
    // Top padding handled inline with insets so the page-title slot
    // begins below the back chevron.
    paddingBottom: spacing.xxl,
  },
  // Custom back chevron — same circular dark-fill style as the
  // FitResult back button, but tinted for the light page bg here.
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: whiteAlpha.surfaceSolid,
    borderWidth: 1,
    borderColor: whiteAlpha.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...shadows.sm,
  },
  header: {
    marginBottom: spacing.xl,
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
    backgroundColor: whiteAlpha.surfaceSolid,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: whiteAlpha.borderMid,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.glass,
  },
  // Wraps the value + optional unit so they share a baseline. Row
  // layout with a small gap reads as one composed stat (e.g. "30-40
  // %") on wide phones; on narrow ones the unit drops to its own
  // line via `flexWrap: 'wrap'` instead of orphaning a single
  // character mid-word.
  statValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    ...typography.headingM,
    color: colors.primary,
  },
  statUnit: {
    fontFamily: fontFamily.display,
    fontSize: 14,
    color: colors.primary,
    marginLeft: 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  // Top-margin variant for the SECOND and later section headers so
  // the gap above each section matches the gap below the previous
  // section's content. Without this the second header ("What we need
  // from you") sat too tight against the last step card.
  sectionHeaderSpaced: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.headingM,
    color: colors.text,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: whiteAlpha.surfaceSolid,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: whiteAlpha.borderMid,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.glass,
  },
  stepIconContainer: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    // Step numbers (1, 2, 3) used to live here above the icon. They
    // were dropped May 3 2026 PM — the icon alone reads as the step
    // marker and the descriptive title carries the meaning.
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
    backgroundColor: whiteAlpha.surfaceSolid,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: whiteAlpha.borderMid,
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
    fontWeight: '400',
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
