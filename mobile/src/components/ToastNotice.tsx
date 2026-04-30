/**
 * ToastNotice — themed replacement for info / error flavour
 * `Alert.alert(...)` calls. Native Alert pops a system-styled dialog
 * that ignores Alate's grey-purple palette + serif voice; ConfirmDialog
 * is the right choice for destructive confirmations, but for "FYI"
 * surfaces (sharing unavailable, sign-in error, permission denied,
 * calibration failed) we want a smaller, auto-dismissing affordance.
 *
 * Renders as a top-anchored glass card with a single icon, italic-serif
 * title, and short message. Auto-hides after `durationMs` (default 3.5s)
 * or on tap. No buttons — if a notice needs a button, it's actually
 * a dialog and should use ConfirmDialog instead.
 */

import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  primaryAlpha,
} from '../constants/theme';
import GlassCard from './GlassCard';

export type ToastVariant = 'info' | 'error';

export interface ToastNoticeProps {
  visible: boolean;
  title: string;
  message?: string;
  /** 'info' uses the brand purple icon ring; 'error' uses the same ring
   *  but with an alert-circle icon. We deliberately don't introduce a
   *  red hue — keeps the palette coherent. */
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms. Defaults to 3500. */
  durationMs?: number;
  onDismiss: () => void;
}

export default function ToastNotice({
  visible,
  title,
  message,
  variant = 'info',
  durationMs = 3500,
  onDismiss,
}: ToastNoticeProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.cardWrap} onPress={onDismiss}>
          <GlassCard style={styles.card}>
            <View style={styles.iconCircle}>
              <Feather
                name={variant === 'error' ? 'alert-circle' : 'info'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Lightly dim only — the toast doesn't block interaction the way
    // a confirm dialog does, so we use a softer dimmer than ConfirmDialog.
    backgroundColor: primaryAlpha.tintXs,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: primaryAlpha.tintXs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.headingM,
    color: colors.text,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
});
