/**
 * ConfirmDialog — themed replacement for `Alert.alert(...)`.
 *
 * Native Alert pops a system-styled dialog that ignores Alate's
 * grey-purple palette + serif voice and breaks the visual continuity
 * of the rest of the app. This component renders a Modal with the
 * same glass-card treatment as everything else: dimmed backdrop,
 * frosted card, italic-serif heading, brand-purple buttons.
 *
 * Used for destructive confirmations (delete from history, delete
 * body profile, etc.). Non-destructive flows can keep using Alert if
 * a confirmation prompt is even needed at all.
 *
 * Design notes (2026-04-26):
 * - The destructive button uses `colors.primary` (brand grey-purple),
 *   NOT a red. Earlier revision pulled `colors.errorDeep` (clay red
 *   #7a3a3a) for "destructive" affordance — but that hue appears
 *   nowhere else in the UI, so the modal looked like it belonged in
 *   a different app. The destructive intent is communicated by the
 *   title + button label; we don't need a competing colour signal.
 * - Backdrop dim, icon-ring fill, and cancel button fill all read
 *   from theme tokens (`colors.overlayLight`, `primaryAlpha.tintXs`,
 *   `primaryAlpha.tintSm`). No hardcoded rgba literals.
 * - Message is intentionally optional and rarely used — the title
 *   carries the question; users know what they're confirming.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  fontFamily,
  primaryAlpha,
} from '../constants/theme';
import GlassCard from './GlassCard';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** Optional. Most destructive flows don't need a body — the title
   *  carries the question and the user knows what they're acting on.
   *  Keep messages short when present (one short sentence). */
  message?: string;
  /** Label for the destructive action (e.g. "Delete", "Remove"). */
  confirmLabel: string;
  /** Optional Feather icon shown above the title — typically
   *  'alert-triangle' for destructive flows. */
  icon?: React.ComponentProps<typeof Feather>['name'];
  /** Treat the confirm button as destructive. Defaults to true since
   *  this dialog exists primarily for destructive flows. The visual
   *  treatment is identical for now (brand grey-purple) — this flag
   *  is preserved for future tonal differentiation if needed. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional testID for the confirm button — useful for E2E. */
  confirmTestID?: string;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  icon = 'alert-triangle',
  destructive = true,
  onConfirm,
  onCancel,
  confirmTestID,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* Pressable backdrop — tap outside the card to dismiss, same as
          iOS action sheets. Doesn't fire confirm because we never want
          a tap-out to count as approval of a destructive action. */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner Pressable swallows taps so a press inside the card
            doesn't bubble up to the backdrop dismiss handler. */}
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <GlassCard style={styles.card}>
            <View style={styles.iconCircle}>
              <Feather name={icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                testID="confirm-dialog-cancel"
                style={styles.cancelButton}
                onPress={onCancel}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={confirmTestID || 'confirm-dialog-confirm'}
                style={styles.confirmButton}
                onPress={onConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              </TouchableOpacity>
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
    // Theme token — the same dimmer used for "the world is dimmed"
    // overlay states elsewhere in the app. 50% deep grey-purple over
    // whatever screen is behind the modal.
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    padding: spacing.xl,
    borderRadius: borderRadius.xxl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: primaryAlpha.tintXs,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingM,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.pill,
    backgroundColor: primaryAlpha.tintSm,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.pill,
    // Brand grey-purple — destructive intent reads from the title +
    // button label, not from a competing red hue.
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmText: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
