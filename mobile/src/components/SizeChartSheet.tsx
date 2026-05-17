/**
 * SizeChartSheet — bottom-sheet renderer for brand-pushed size charts.
 *
 * Source of data: Mood Layer's composed-product endpoint (see
 * Tessellate/mood-layer). The chart can carry body measurements
 * ("fits person with bust 86cm"), garment measurements ("garment chest
 * 92cm flat"), or both. We render whatever combination is present.
 *
 * The shape below mirrors `@tessellate/enrichment-types` (the shared
 * package). We inline a minimal subset here so this component compiles
 * before the alate repo wires the package as a dependency. When the
 * package is published and added to mobile/package.json, replace
 * `SizeChartForSheet` with `import type { SizeChart } from '@tessellate/enrichment-types'`.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  borderRadius,
  colors,
  fontFamily,
  primaryAlpha,
  spacing,
  typography,
} from '../constants/theme';
import GlassCard from './GlassCard';

// ---------------------------------------------------------------------------
// Types — TODO: replace with `import type { SizeChart, SizeRow, ... } from '@tessellate/enrichment-types'`
// ---------------------------------------------------------------------------

type MeasurementUnit = 'cm' | 'in';

type Measurements = Record<string, number | undefined>;

export interface SizeRowForSheet {
  label: string;
  body_measurements?: Measurements;
  garment_measurements?: Measurements;
}

export interface SizeChartForSheet {
  id: string;
  name: string;
  unit: MeasurementUnit;
  rows: SizeRowForSheet[];
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  bust: 'Bust',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  inseam: 'Inseam',
  height: 'Height',
  rise: 'Rise',
  sleeve: 'Sleeve',
  shoulder: 'Shoulder',
  length: 'Length',
  chest_flat: 'Chest (flat)',
  waist_flat: 'Waist (flat)',
  hip_flat: 'Hip (flat)',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

const CM_PER_INCH = 2.54;

function convert(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (from === to) return value;
  if (from === 'cm' && to === 'in') return value / CM_PER_INCH;
  return value * CM_PER_INCH;
}

function formatValue(value: number, unit: MeasurementUnit): string {
  // cm renders as integer (typical chart convention); in renders to 1 decimal
  return unit === 'cm'
    ? String(Math.round(value))
    : (Math.round(value * 10) / 10).toFixed(1);
}

/** Stable column order for a measurements map — uses field name lexical order
 *  but pulls common axes (bust/chest/waist/hips) to the front so the columns
 *  read naturally left-to-right. */
function columnOrder(rows: SizeRowForSheet[], pick: 'body' | 'garment'): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const m = pick === 'body' ? r.body_measurements : r.garment_measurements;
    if (!m) continue;
    for (const k of Object.keys(m)) if (m[k] !== undefined) seen.add(k);
  }
  const priority = ['bust', 'chest', 'waist', 'hips', 'shoulder', 'length', 'sleeve', 'inseam', 'rise',
                    'chest_flat', 'waist_flat', 'hip_flat'];
  const arr = Array.from(seen);
  arr.sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return arr;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface MeasurementTableProps {
  rows: SizeRowForSheet[];
  pick: 'body' | 'garment';
  unit: MeasurementUnit;
  nativeUnit: MeasurementUnit;
}

function MeasurementTable({ rows, pick, unit, nativeUnit }: MeasurementTableProps) {
  const cols = columnOrder(rows, pick);
  if (cols.length === 0) return null;

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.cell, styles.headerCell, styles.labelCell]}>Size</Text>
        {cols.map((c) => (
          <Text key={c} style={[styles.cell, styles.headerCell]}>
            {fieldLabel(c)}
          </Text>
        ))}
      </View>
      {rows.map((row) => {
        const m = pick === 'body' ? row.body_measurements : row.garment_measurements;
        if (!m) return null;
        return (
          <View key={row.label} style={styles.tableRow}>
            <Text style={[styles.cell, styles.labelCell, styles.labelCellText]}>{row.label}</Text>
            {cols.map((c) => {
              const v = m[c];
              if (v === undefined) {
                return <Text key={c} style={[styles.cell, styles.mutedCell]}>—</Text>;
              }
              const display = convert(v, nativeUnit, unit);
              return (
                <Text key={c} style={styles.cell}>
                  {formatValue(display, unit)}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface SizeChartSheetProps {
  visible: boolean;
  chart: SizeChartForSheet;
  onClose: () => void;
}

export default function SizeChartSheet({ visible, chart, onClose }: SizeChartSheetProps) {
  const [unit, setUnit] = useState<MeasurementUnit>(chart.unit);

  // Recompute when a different chart is opened (it may have a different native unit)
  // useMemo avoids resetting the user's toggle preference within a single chart open.
  const nativeUnit = useMemo(() => chart.unit, [chart.unit, chart.id]);

  const hasBody = chart.rows.some((r) => r.body_measurements && Object.keys(r.body_measurements).length > 0);
  const hasGarment = chart.rows.some((r) => r.garment_measurements && Object.keys(r.garment_measurements).length > 0);
  const both = hasBody && hasGarment;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <GlassCard style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>{chart.name}</Text>
                <Text style={styles.subtitle}>Size guide</Text>
              </View>
              <TouchableOpacity
                testID="size-chart-unit-toggle"
                onPress={() => setUnit(unit === 'cm' ? 'in' : 'cm')}
                style={styles.unitToggle}
                activeOpacity={0.75}
              >
                <Text style={styles.unitToggleText}>{unit === 'cm' ? 'cm · in' : 'in · cm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="size-chart-sheet-close"
                onPress={onClose}
                style={styles.closeButton}
                activeOpacity={0.75}
              >
                <Feather name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {hasBody ? (
                <View style={styles.section}>
                  {both ? <Text style={styles.sectionHeading}>Body measurements</Text> : null}
                  <MeasurementTable rows={chart.rows} pick="body" unit={unit} nativeUnit={nativeUnit} />
                </View>
              ) : null}

              {hasGarment ? (
                <View style={styles.section}>
                  <Text style={styles.sectionHeading}>
                    {both ? 'Garment measurements' : 'Garment measurements (laid flat)'}
                  </Text>
                  <MeasurementTable rows={chart.rows} pick="garment" unit={unit} nativeUnit={nativeUnit} />
                </View>
              ) : null}

              {chart.notes ? (
                <View style={styles.notesWrap}>
                  <Feather name="info" size={14} color={colors.textSecondary} />
                  <Text style={styles.notes}>{chart.notes}</Text>
                </View>
              ) : null}
            </ScrollView>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — uses theme tokens, no raw hex
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayLight,
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheet: {
    padding: spacing.lg,
    borderRadius: borderRadius.xxl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    ...typography.headingM,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  unitToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: primaryAlpha.tintSm,
    marginRight: spacing.sm,
  },
  unitToggleText: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: primaryAlpha.tintSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeading: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  table: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableHeaderRow: {
    backgroundColor: primaryAlpha.tintXs,
  },
  cell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  headerCell: {
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelCell: {
    flex: 0.7,
    fontWeight: '700',
  },
  labelCellText: {
    color: colors.text,
  },
  mutedCell: {
    color: colors.textMuted,
  },
  notesWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
  },
  notes: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
