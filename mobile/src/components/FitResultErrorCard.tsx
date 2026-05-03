/**
 * FitResultErrorCard — error state for the URL-paste flow.
 *
 * Renders when FitResult's internal scrape fails (unsupported brand,
 * blocked origin, network error). Mirrors the FitLoader vocabulary so
 * the transition from loading → error reads as "the same screen
 * resolved into a different state", not as a hard context switch.
 *
 *   - URL pill at the top (continuity with FitLoader)
 *   - Centered gradient orb hero with status icon
 *   - Italic serif headline (brand-aware)
 *   - Body copy gated on demand-count: shows the social-proof line
 *     only when count >= 20; below that, a generic "we're tracking
 *     demand" line
 *   - Inline notify-me email input (collapsed by default)
 *   - Three CTAs: Visit store directly (primary) / Notify me /
 *     Back (ghost)
 *
 * Demand capture: when `kind === 'unsupported'` we POST to
 * /api/brand-request on mount. Blocked origins are NOT logged
 * (defeats the opt-out). Unknown / transient errors are NOT logged
 * (not a demand signal).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import {
  colors,
  spacing,
  typography,
  fontFamily,
  borderRadius,
  shadows,
  whiteAlpha,
  primaryAlpha,
} from '../constants/theme';
import GlassCard from './GlassCard';
import {
  extractBrandFromUrl,
  logBrandRequest,
  getBrandRequestCount,
} from '../services/api';

// Below this threshold we suppress the "N others want this" copy —
// a low count reads as "no one else cares", which is worse than
// silence. Confirmed product decision (2026-05-02).
const SOCIAL_PROOF_MIN = 20;

export type ScrapeErrorKind = 'unsupported' | 'blocked' | 'unknown';

export interface ScrapeError {
  kind: ScrapeErrorKind;
  origin?: string;
  message: string;
}

interface Props {
  url: string;
  scrapeError: ScrapeError;
  onGoBack: () => void;
}

function shortUrl(raw: string): string {
  const stripped = raw.replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (stripped.length <= 40) return stripped;
  return stripped.slice(0, 40) + '…';
}

function isValidEmail(email: string): boolean {
  // Lightweight RFC-ish check — backend validates strictly.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function FitResultErrorCard({ url, scrapeError, onGoBack }: Props) {
  const brand = extractBrandFromUrl(url);
  const brandName = brand?.brandName;
  const brandDomain = brand?.brandDomain;

  const [count, setCount] = useState(0);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Log demand on mount (unsupported only) and read back the latest
  // count for social proof. Blocked origins are intentionally silent.
  useEffect(() => {
    if (scrapeError.kind !== 'unsupported' || !url) return;
    let cancelled = false;
    (async () => {
      const result = await logBrandRequest({
        sourceUrl: url,
        brandDisplay: brandName,
      });
      if (cancelled) return;
      if (typeof result.count === 'number') {
        setCount(result.count);
      } else if (brandDomain) {
        const fallback = await getBrandRequestCount(brandDomain);
        if (!cancelled) setCount(fallback);
      }
    })();
    return () => {
      cancelled = true;
    };
    // url + scrapeError.kind drive the effect; brand fields derive from url.
  }, [url, scrapeError.kind, brandName, brandDomain]);

  const handleNotifySubmit = async () => {
    if (!isValidEmail(email) || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    const result = await logBrandRequest({
      sourceUrl: url,
      brandDisplay: brandName,
      requesterEmail: email.trim(),
    });
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
      if (typeof result.count === 'number') setCount(result.count);
    }
  };

  // --- Copy ---------------------------------------------------------
  const isBlocked = scrapeError.kind === 'blocked';
  const isUnsupported = scrapeError.kind === 'unsupported';

  const headline = isBlocked
    ? `${scrapeError.origin || brandName || 'This brand'} has opted out`
    : isUnsupported
    ? brandName
      ? `${brandName} isn't on alate yet`
      : "We couldn't read this product"
    : 'Something went wrong';

  const showSocialProof = isUnsupported && count >= SOCIAL_PROOF_MIN;
  const body = isBlocked
    ? "This brand has asked us not to read their products. You can still visit their store."
    : isUnsupported
    ? showSocialProof
      ? `You're one of ${count} people who want this brand on alate. We'll get to it.`
      : "We're tracking demand for this brand. Visit the store directly in the meantime."
    : scrapeError.message;

  const showNotifyCta = isUnsupported && !submitted;
  const showVisitStore = !!url;

  // --- Render -------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* URL pill — continuity with FitLoader */}
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

      {/* Hero: gradient orb with status icon */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradientCircle}
        >
          <Feather
            name={isBlocked ? 'shield' : isUnsupported ? 'alert-circle' : 'cloud-off'}
            size={44}
            color={whiteAlpha.textOpaque}
          />
        </LinearGradient>

        <Text style={styles.title} testID="fit-result-error-headline">
          {headline}
        </Text>
        <Text style={styles.body} testID="fit-result-error-body">
          {body}
        </Text>

        {/* Notify-me input (collapsed → expand on CTA tap) */}
        {showNotifyCta && notifyOpen && !submitted ? (
          <View style={styles.notifyRow}>
            <TextInput
              testID="fit-result-error-notify-input"
              style={styles.notifyInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Your email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleNotifySubmit}
              editable={!submitting}
            />
            <TouchableOpacity
              testID="fit-result-error-notify-submit"
              onPress={handleNotifySubmit}
              disabled={!isValidEmail(email) || submitting}
              style={[
                styles.notifySend,
                (!isValidEmail(email) || submitting) && styles.notifySendDisabled,
              ]}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Feather name="arrow-right" size={18} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
        ) : null}
        {submitted ? (
          <Text style={styles.submittedNote} testID="fit-result-error-notify-confirm">
            We'll let you know when {brandName ?? 'this brand'} is added.
          </Text>
        ) : null}
      </View>

      {/* Actions — KeyboardAvoidingView lifts the whole stack when the
          notify input opens the soft keyboard, so the email field stays
          visible above the keyboard instead of being covered. The
          actions container sits above the floating nav pill (bottom
          margin clears the ~96px pill + safe-area). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.actions}>
          {showVisitStore ? (
            <TouchableOpacity
              testID="fit-result-error-open-store"
              style={styles.primaryButton}
              onPress={() => Linking.openURL(url)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Visit store directly</Text>
            </TouchableOpacity>
          ) : null}

          {showNotifyCta && !notifyOpen ? (
            <TouchableOpacity
              testID="fit-result-error-notify-toggle"
              style={styles.ghostButton}
              onPress={() => setNotifyOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostButtonText}>Notify me when added</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            testID="fit-result-error-go-back"
            style={styles.ghostButton}
            onPress={onGoBack}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    fontFamily: fontFamily.primary,
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
    paddingBottom: spacing.xl,
  },
  gradientCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    ...typography.headingL,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  body: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },

  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    maxWidth: 320,
    marginTop: spacing.sm,
  },
  notifyInput: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.text,
    backgroundColor: whiteAlpha.surfaceSolid,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: primaryAlpha.tintSm,
  },
  notifySend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  notifySendDisabled: {
    opacity: 0.5,
  },
  submittedNote: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },

  actions: {
    // The floating nav pill sits ~10px above the gesture-bar with
    // height 64. Need to clear it (74-100px) PLUS some breathing room
    // so "Back" doesn't visually crowd the pill. spacing.xl wasn't
    // enough — Back was ~touching the pill on Pixel-class screens.
    paddingBottom: 110,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  primaryButtonText: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 15,
    color: colors.white,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
