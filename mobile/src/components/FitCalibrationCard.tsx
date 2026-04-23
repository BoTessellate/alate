/**
 * FitCalibrationCard
 *
 * Lives on the Account screen, below Body Profile. Lets the user record
 * garments they own that fit them well — each entry is sent to the backend's
 * `calibrate-garment` action which uses Claude to estimate the user's actual
 * cm body measurements based on the brand's typical sizing.
 *
 * The averaged measurements across all entries become the calibration data
 * sent on every fit check, dramatically improving size recommendations
 * (Zalando's "user's normal size is the strongest signal" principle).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
} from '../constants/theme';
import GlassCard from './GlassCard';
import {
  useCalibrationStore,
  CalibrationGarment,
  GarmentFit,
  GarmentCategory,
  averageCalibration,
  deriveTypicalSize,
} from '../store/calibrationStore';
import { calibrateGarment } from '../services/api';
import { useAvatarStore } from '../store/avatarStore';

const FIT_OPTIONS: { value: GarmentFit; label: string; icon: string }[] = [
  { value: 'slightly-tight', label: 'Slightly tight', icon: '↘' },
  { value: 'perfect', label: 'Perfect', icon: '✓' },
  { value: 'slightly-loose', label: 'Slightly loose', icon: '↗' },
];

const CATEGORY_OPTIONS: { value: GarmentCategory; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'dress', label: 'Dress' },
  { value: 'outerwear', label: 'Outerwear' },
];

export default function FitCalibrationCard() {
  const { avatar } = useAvatarStore();
  const { garments, addGarment, removeGarment } = useCalibrationStore();
  const [modalOpen, setModalOpen] = useState(false);

  const averaged = useMemo(() => averageCalibration(garments), [garments]);
  const typical = useMemo(() => deriveTypicalSize(averaged), [averaged]);

  const handleConfirmDelete = (g: CalibrationGarment) => {
    Alert.alert(
      'Remove garment',
      `Remove "${g.brand} ${g.size}" from your calibration?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeGarment(g.id),
        },
      ]
    );
  };

  const confidenceColor = (c: 'high' | 'medium' | 'low') =>
    c === 'high' ? colors.success : c === 'medium' ? colors.warning : colors.textMuted;

  return (
    <>
      {/* Section header — sits below Body Profile */}
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Fit Calibration</Text>
          <Text style={styles.sectionSubtitle}>
            Add pieces you own that fit well — accuracy improves with each entry
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (!avatar) {
              Alert.alert(
                'Body profile required',
                'Set up your body profile first so we can calibrate accurately.'
              );
              return;
            }
            setModalOpen(true);
          }}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={14} color={colors.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Typical size headline (derived) */}
      {typical && (
        <GlassCard style={styles.typicalCard}>
          <View>
            <Text style={styles.typicalLabel}>Your typical size</Text>
            <Text style={styles.typicalValue}>{typical.size}</Text>
          </View>
          <View style={styles.typicalMeta}>
            <View
              style={[
                styles.confidencePill,
                { backgroundColor: confidenceColor(typical.confidence) + '18' },
              ]}
            >
              <View
                style={[
                  styles.confidenceDot,
                  { backgroundColor: confidenceColor(typical.confidence) },
                ]}
              />
              <Text
                style={[
                  styles.confidenceText,
                  { color: confidenceColor(typical.confidence) },
                ]}
              >
                {typical.confidence === 'high'
                  ? 'High confidence'
                  : typical.confidence === 'medium'
                  ? 'Medium confidence'
                  : 'Low confidence'}
              </Text>
            </View>
            <Text style={styles.typicalSource}>
              Based on {garments.length} garment{garments.length === 1 ? '' : 's'}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Empty state */}
      {garments.length === 0 && (
        <GlassCard style={styles.emptyCard}>
          <Feather name="zap" size={22} color={colors.primary} />
          <Text style={styles.emptyTitle}>No calibration data yet</Text>
          <Text style={styles.emptyBody}>
            Tell us about a piece you own that fits well — we'll use the brand's typical sizing to anchor every future fit check.
          </Text>
        </GlassCard>
      )}

      {/* Garment list */}
      {garments.map((g) => (
        <GlassCard key={g.id} style={styles.garmentCard}>
          <View style={styles.garmentMain}>
            <View style={styles.garmentHeader}>
              <Text style={styles.garmentBrand}>{g.brand}</Text>
              <Text style={styles.garmentSize}>Size {g.size}</Text>
            </View>
            <View style={styles.garmentMetaRow}>
              <Text style={styles.garmentMeta}>
                {CATEGORY_OPTIONS.find((c) => c.value === g.category)?.label ?? g.category}
              </Text>
              <Text style={styles.garmentDot}>•</Text>
              <Text style={styles.garmentMeta}>
                {FIT_OPTIONS.find((f) => f.value === g.fit)?.label ?? g.fit}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleConfirmDelete(g)}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </GlassCard>
      ))}

      {/* Add modal */}
      <AddGarmentModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addGarment}
      />
    </>
  );
}

// =============================================================================
// AddGarmentModal — collects brand, size, category, fit; calls backend AI
// =============================================================================

function AddGarmentModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (g: Omit<CalibrationGarment, 'id' | 'addedAt'>) => void;
}) {
  const { avatar } = useAvatarStore();
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('top');
  const [fit, setFit] = useState<GarmentFit>('perfect');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setBrand('');
    setSize('');
    setCategory('top');
    setFit('perfect');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const canSubmit = brand.trim().length > 0 && size.trim().length > 0 && !!avatar && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !avatar) return;
    setSubmitting(true);

    const result = await calibrateGarment({
      brand: brand.trim(),
      size: size.trim(),
      fit,
      avatar,
    });

    if (!result.success || !result.estimated_cm) {
      setSubmitting(false);
      Alert.alert(
        'Calibration failed',
        result.message || result.error || 'Could not estimate measurements. Please try again.'
      );
      return;
    }

    onAdd({
      brand: brand.trim(),
      size: size.trim(),
      category,
      fit,
      estimated: result.estimated_cm,
    });

    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalRoot}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Add a garment</Text>
              <Text style={styles.modalSubtitle}>
                Tell us about a piece you own that fits well. We'll use the brand's sizing to anchor your future fit checks.
              </Text>

              {/* Brand */}
              <Text style={styles.fieldLabel}>Brand</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g. Zara, Levi's, ASOS"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!submitting}
              />

              {/* Size */}
              <Text style={styles.fieldLabel}>Size</Text>
              <TextInput
                style={styles.input}
                value={size}
                onChangeText={setSize}
                placeholder="e.g. M, 10, 32, 8UK"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!submitting}
              />

              {/* Category */}
              <Text style={styles.fieldLabel}>Garment type</Text>
              <View style={styles.chipRow}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      category === opt.value && styles.chipSelected,
                    ]}
                    onPress={() => setCategory(opt.value)}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        category === opt.value && styles.chipTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fit */}
              <Text style={styles.fieldLabel}>How does it fit?</Text>
              <View style={styles.chipRow}>
                {FIT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      styles.chipFit,
                      fit === opt.value && styles.chipSelected,
                    ]}
                    onPress={() => setFit(opt.value)}
                    disabled={submitting}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        fit === opt.value && styles.chipTextSelected,
                      ]}
                    >
                      {opt.icon} {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleClose}
                  disabled={submitting}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.headingS,
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cta,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    ...shadows.sm,
  },
  addButtonText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '700',
  },
  // Typical size headline
  typicalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  typicalLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typicalValue: {
    fontFamily: 'serif',
    fontSize: 38,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 42,
    marginTop: 2,
  },
  typicalMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
  },
  confidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  confidenceText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  typicalSource: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Empty state
  emptyCard: {
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.labelLarge,
    color: colors.text,
    marginTop: spacing.xs,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Garment cards
  garmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  garmentMain: {
    flex: 1,
  },
  garmentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 2,
  },
  garmentBrand: {
    ...typography.labelLarge,
    color: colors.text,
    fontWeight: '700',
  },
  garmentSize: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  garmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  garmentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  garmentDot: {
    ...typography.caption,
    color: colors.textMuted,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(47, 41, 55, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 48,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.headingL,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipFit: {
    minWidth: 110,
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.label,
    color: colors.text,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    backgroundColor: colors.cta,
    ...shadows.sm,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    ...typography.label,
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
