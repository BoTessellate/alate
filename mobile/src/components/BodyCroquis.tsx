/**
 * BodyCroquis — fashion-illustration line art for the avatar setup page.
 *
 * Version 2 of the parametric body figurine. Drop-in replacement for
 * `BodyFigurine.tsx` (same prop API) that trades the filled-gradient
 * anatomy-chart look for a clean line-only croquis.
 *
 * Design rules (see project_body_croquis_plan.md memory file):
 *   - Stroke-only silhouette. No gradient fills, no inner sheen, no
 *     backdrop rectangle, no always-on guidelines.
 *   - Elongated fashion-croquis proportions (viewBox taller than v1).
 *   - Minimal head (small oval), no face features.
 *   - Active region highlight = thin brand-purple ribbon band at the
 *     region's Y, plus a subtle outline recolour — NOT a filled overlay.
 *   - Same prop API as BodyFigurine; AvatarSetupScreen swaps one import.
 *
 * Metrics come from `bodyFigurineModel.ts` unchanged — the parametric
 * engine is solid, only the rendering changes.
 */

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import type {
  BustType,
  HipType,
  ShoulderType,
  ThighType,
  TorsoType,
  WaistType,
} from '../store/avatarStore';
import {
  BodyFocusArea,
  getBodyFigurineMetrics,
  getFocusFill,
} from './bodyFigurineModel';

interface BodyCroquisProps {
  heightCm?: number | null;
  shoulders?: ShoulderType | null;
  bust?: BustType | null;
  waist?: WaistType | null;
  hips?: HipType | null;
  thighs?: ThighType | null;
  torsoLength?: TorsoType | null;
  activePart?: BodyFocusArea | null;
  style?: StyleProp<ViewStyle>;
}

// Brand palette hooks — line art stays monochrome except when a region is
// active, in which case it recolours to the brand purple.
const LINE = '#2a1c3a';           // deep purple-black, matches colors.text
const LINE_SOFT = 'rgba(42, 28, 58, 0.45)';
const HIGHLIGHT = '#5a4377';      // colors.primary
const HIGHLIGHT_BAND = 'rgba(90, 67, 119, 0.85)';

export default function BodyCroquis({
  heightCm,
  shoulders,
  bust,
  waist,
  hips,
  thighs,
  torsoLength,
  activePart,
  style,
}: BodyCroquisProps) {
  const metrics = getBodyFigurineMetrics({
    heightCm,
    shoulders,
    bust,
    waist,
    hips,
    thighs,
    torsoLength,
  });
  const focus = getFocusFill(activePart);

  const cx = metrics.centerX;

  // --- Head / neck geometry ---
  // Croquis head: small relative to body (~1/9 of figure height). The
  // model's neckBottomY sits at 62 with a naturalistic ~40px head; we
  // shrink it for a more elongated croquis feel.
  const headCy = 28;
  const headRx = 13;
  const headRy = 17;
  const neckHalf = 5.4;
  const neckTopY = 46;

  // --- Shoulder cap Y (where the shoulder line starts dropping into arm) ---
  const shoulderCapY = metrics.shoulderY + 6;

  // --- Arm anchor points ---
  // Arms hang at a slight outward angle — wrists finish just past the hip.
  const armShoulderOffsetX = metrics.shoulderHalf - 1;
  const armWristOffsetX = metrics.hipHalf + 2;
  const armTopY = shoulderCapY - 2;
  const armWristY = metrics.hipY + 78;
  const armElbowOffsetX = metrics.shoulderHalf + 2;
  const armElbowY = metrics.waistY + 14;

  // --- Leg / foot anchor points ---
  // Elongate the legs in renderer space — pull the foot Y down past the
  // model's 392 so the figure reads as fashion-croquis-tall. ViewBox is
  // extended to 520 to accommodate.
  const legBaseY = 518;
  const kneeOffsetY = (legBaseY - metrics.crotchY) * 0.5;
  const kneeY = metrics.crotchY + kneeOffsetY;
  const ankleOffsetY = (legBaseY - metrics.crotchY) * 0.94;
  const ankleY = metrics.crotchY + ankleOffsetY;
  const thighHalf = metrics.thighWidth * 0.62;
  const kneeHalf = metrics.thighWidth * 0.42;
  const ankleHalf = Math.max(3, metrics.thighWidth * 0.3);
  const legGap = metrics.legGap / 2;
  const leftLegCenterX = cx - legGap - thighHalf;
  const rightLegCenterX = cx + legGap + thighHalf;

  // ----------------------------------------------------------------
  // Path builders — pure outline, no fill. Each path is a continuous
  // cubic Bezier chain so the line reads as a single confident stroke.
  // ----------------------------------------------------------------

  // Torso silhouette: neck → shoulder cap → bust → waist → hip → crotch,
  // mirrored back up. Same topology as v1 but tighter control points
  // for a more fluid figure.
  const torsoPath = [
    // Left neck edge
    `M ${cx - neckHalf} ${neckTopY}`,
    `L ${cx - neckHalf} ${metrics.neckBottomY}`,
    // Shoulder cap (figure's left)
    `C ${cx - 10} ${metrics.neckBottomY + 4}, ${cx - metrics.shoulderHalf * 0.72} ${metrics.shoulderY - 2}, ${cx - metrics.shoulderHalf} ${shoulderCapY}`,
    // Shoulder → bust side
    `C ${cx - metrics.bustHalf * 1.06} ${metrics.bustY - 20}, ${cx - metrics.bustHalf * 0.98} ${metrics.bustY - 4}, ${cx - metrics.bustHalf} ${metrics.bustY + 4}`,
    // Bust → waist
    `C ${cx - metrics.bustHalf * 0.96} ${metrics.waistY - 14}, ${cx - metrics.waistHalf * 1.04} ${metrics.waistY - 6}, ${cx - metrics.waistHalf} ${metrics.waistY}`,
    // Waist → hips
    `C ${cx - metrics.waistHalf * 0.98} ${metrics.hipY - 14}, ${cx - metrics.hipHalf} ${metrics.hipY - 6}, ${cx - metrics.hipHalf} ${metrics.hipY + 6}`,
    // Hip → crotch (figure's left thigh upper)
    `C ${cx - metrics.hipHalf * 0.82} ${metrics.crotchY - 6}, ${cx - legGap - 6} ${metrics.crotchY - 2}, ${cx - legGap - 2} ${metrics.crotchY + 4}`,
    // Crotch base
    `L ${cx + legGap + 2} ${metrics.crotchY + 4}`,
    // Right thigh upper → hip
    `C ${cx + legGap + 6} ${metrics.crotchY - 2}, ${cx + metrics.hipHalf * 0.82} ${metrics.crotchY - 6}, ${cx + metrics.hipHalf} ${metrics.hipY + 6}`,
    // Hip → waist
    `C ${cx + metrics.hipHalf} ${metrics.hipY - 6}, ${cx + metrics.waistHalf * 1.04} ${metrics.waistY - 6}, ${cx + metrics.waistHalf} ${metrics.waistY}`,
    // Waist → bust
    `C ${cx + metrics.waistHalf * 1.04} ${metrics.waistY - 14}, ${cx + metrics.bustHalf * 0.98} ${metrics.bustY - 4}, ${cx + metrics.bustHalf} ${metrics.bustY + 4}`,
    // Bust → shoulder
    `C ${cx + metrics.bustHalf * 0.98} ${metrics.bustY - 4}, ${cx + metrics.bustHalf * 1.06} ${metrics.bustY - 20}, ${cx + metrics.shoulderHalf} ${shoulderCapY}`,
    // Shoulder → neck
    `C ${cx + metrics.shoulderHalf * 0.72} ${metrics.shoulderY - 2}, ${cx + 10} ${metrics.neckBottomY + 4}, ${cx + neckHalf} ${metrics.neckBottomY}`,
    // Neck right edge
    `L ${cx + neckHalf} ${neckTopY}`,
  ].join(' ');

  // Single-stroke arm: shoulder → elbow (bowed slightly outward) → wrist.
  // No fill, no inner edge — just a confident outline via two curves.
  const armPath = (side: 'left' | 'right') => {
    const s = side === 'left' ? -1 : 1;
    const shoulderX = cx + s * armShoulderOffsetX;
    const elbowX = cx + s * armElbowOffsetX;
    const wristX = cx + s * armWristOffsetX;
    return [
      `M ${shoulderX} ${armTopY}`,
      `C ${shoulderX + s * 1} ${armElbowY - 18}, ${elbowX + s * 0.5} ${armElbowY - 4}, ${elbowX} ${armElbowY}`,
      `C ${elbowX - s * 0.5} ${armElbowY + 4}, ${wristX + s * 0.5} ${armWristY - 14}, ${wristX} ${armWristY}`,
    ].join(' ');
  };

  // Hand: a very short tapered stroke continuing the forearm past the wrist.
  const handPath = (side: 'left' | 'right') => {
    const s = side === 'left' ? -1 : 1;
    const wristX = cx + s * armWristOffsetX;
    return `M ${wristX} ${armWristY} C ${wristX + s * 1.5} ${armWristY + 5}, ${wristX + s * 2} ${armWristY + 10}, ${wristX - s * 0.5} ${armWristY + 14}`;
  };

  // Single-stroke leg: hip edge → knee → ankle, outer + inner as separate
  // paths so the leg reads as a tapered column.
  const legOuterPath = (side: 'left' | 'right') => {
    const s = side === 'left' ? -1 : 1;
    const centerX = side === 'left' ? leftLegCenterX : rightLegCenterX;
    return [
      `M ${centerX + s * thighHalf} ${metrics.crotchY + 4}`,
      `C ${centerX + s * thighHalf - s * 0.5} ${(metrics.crotchY + kneeY) / 2}, ${centerX + s * kneeHalf} ${kneeY - 4}, ${centerX + s * kneeHalf} ${kneeY}`,
      `C ${centerX + s * kneeHalf} ${kneeY + 4}, ${centerX + s * ankleHalf + s * 0.3} ${(kneeY + ankleY) / 2}, ${centerX + s * ankleHalf} ${ankleY}`,
    ].join(' ');
  };
  const legInnerPath = (side: 'left' | 'right') => {
    const s = side === 'left' ? -1 : 1;
    const centerX = side === 'left' ? leftLegCenterX : rightLegCenterX;
    return [
      `M ${centerX - s * thighHalf * 0.85} ${metrics.crotchY + 4}`,
      `C ${centerX - s * thighHalf * 0.6} ${(metrics.crotchY + kneeY) / 2}, ${centerX - s * kneeHalf * 0.5} ${kneeY - 4}, ${centerX - s * kneeHalf * 0.4} ${kneeY}`,
      `C ${centerX - s * kneeHalf * 0.4} ${kneeY + 4}, ${centerX - s * ankleHalf * 0.4 + s * 0.2} ${(kneeY + ankleY) / 2}, ${centerX - s * ankleHalf * 0.4} ${ankleY}`,
    ].join(' ');
  };

  // Foot: thin V stroke suggesting a heeled pose, not a blob.
  const footPath = (side: 'left' | 'right') => {
    const s = side === 'left' ? -1 : 1;
    const centerX = side === 'left' ? leftLegCenterX : rightLegCenterX;
    const ankleOuter = centerX + s * ankleHalf;
    const ankleInner = centerX - s * ankleHalf * 0.4;
    const toeY = ankleY + 10;
    const heelY = ankleY + 2;
    return [
      `M ${ankleOuter} ${ankleY}`,
      `L ${centerX + s * 1} ${heelY}`,
      `L ${centerX + s * (ankleHalf * 1.8)} ${toeY}`,
      `L ${ankleInner} ${toeY - 2}`,
    ].join(' ');
  };

  // Head + neck back lines (neck sides only — not closed, keeps airy).
  const neckLeftX = cx - neckHalf;
  const neckRightX = cx + neckHalf;

  // ----------------------------------------------------------------
  // Active region highlight — a thin brand-purple band/ribbon across
  // the figure at the active region's Y. Far more elegant than a
  // filled region overlay. Height is handled differently below.
  // ----------------------------------------------------------------
  const bandY = focus.bust
    ? metrics.bustY
    : focus.waist
    ? metrics.waistY
    : focus.hips
    ? metrics.hipY + 4
    : focus.torso
    ? (metrics.bustY + metrics.hipY) / 2
    : null;
  const bandHalf = focus.bust
    ? metrics.bustHalf + 4
    : focus.waist
    ? metrics.waistHalf + 5
    : focus.hips
    ? metrics.hipHalf + 4
    : focus.torso
    ? Math.max(metrics.bustHalf, metrics.hipHalf) + 6
    : 0;

  // Stroke overrides when the shoulders or thighs region is active —
  // those parts don't have a single Y to band across, so we recolour
  // their silhouette stroke instead.
  const armStroke = focus.shoulders ? HIGHLIGHT : LINE;
  const legStroke = focus.thighs ? HIGHLIGHT : LINE;
  const armStrokeWidth = focus.shoulders ? 2 : 1.2;
  const legStrokeWidth = focus.thighs ? 2 : 1.2;
  const headStroke = focus.height ? HIGHLIGHT : LINE;
  const headStrokeWidth = focus.height ? 2 : 1.2;

  // Optional very-subtle "paper" fill inside the silhouette — an almost-
  // invisible warm tint that gives the body a hint of mass without
  // competing with the line art.
  const paperFill = 'rgba(255, 253, 250, 0.12)';

  return (
    <View style={[styles.container, style]} testID="body-croquis">
      <Svg width="100%" height="100%" viewBox="0 0 200 540">
        <G>
          {/* Height indicator — ONLY when height is active. Subtle dotted
              column behind the figure, no "H" letter. */}
          {focus.height && (
            <>
              <Line
                x1={180}
                y1={headCy - headRy}
                x2={180}
                y2={legBaseY}
                stroke={HIGHLIGHT}
                strokeWidth={1.2}
                strokeDasharray="2 5"
              />
              <Line
                x1={175}
                y1={headCy - headRy}
                x2={185}
                y2={headCy - headRy}
                stroke={HIGHLIGHT}
                strokeWidth={1.6}
              />
              <Line
                x1={175}
                y1={legBaseY}
                x2={185}
                y2={legBaseY}
                stroke={HIGHLIGHT}
                strokeWidth={1.6}
              />
            </>
          )}

          {/* Active region band — a single tasteful purple ribbon across
              the figure at the measurement's Y. Drawn BEHIND the silhouette
              so the line still reads cleanly on top. */}
          {bandY != null && (
            <Rect
              x={cx - bandHalf}
              y={bandY - 6}
              width={bandHalf * 2}
              height={12}
              rx={6}
              fill={HIGHLIGHT_BAND}
              opacity={0.55}
            />
          )}

          {/* --- Head (small oval, no features) --- */}
          <Circle
            cx={cx}
            cy={headCy}
            r={headRx}
            stroke={headStroke}
            strokeWidth={headStrokeWidth}
            fill={paperFill}
          />
          {/* Jawline hint — single curve at bottom of head for a less perfectly-round feel */}
          <Path
            d={`M ${cx - headRx + 3} ${headCy + headRy * 0.5} C ${cx - 3} ${headCy + headRy + 1}, ${cx + 3} ${headCy + headRy + 1}, ${cx + headRx - 3} ${headCy + headRy * 0.5}`}
            stroke={headStroke}
            strokeWidth={headStrokeWidth}
            fill="none"
          />

          {/* --- Neck sides (short verticals, not closed to the head) --- */}
          <Line
            x1={neckLeftX}
            y1={neckTopY}
            x2={neckLeftX}
            y2={metrics.neckBottomY}
            stroke={LINE}
            strokeWidth={1.2}
          />
          <Line
            x1={neckRightX}
            y1={neckTopY}
            x2={neckRightX}
            y2={metrics.neckBottomY}
            stroke={LINE}
            strokeWidth={1.2}
          />

          {/* --- Torso silhouette (outline only) --- */}
          <Path
            d={torsoPath}
            fill={paperFill}
            stroke={LINE}
            strokeWidth={1.3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* --- Arms (single-stroke, outline only) --- */}
          <Path
            d={armPath('left')}
            fill="none"
            stroke={armStroke}
            strokeWidth={armStrokeWidth}
            strokeLinecap="round"
          />
          <Path
            d={armPath('right')}
            fill="none"
            stroke={armStroke}
            strokeWidth={armStrokeWidth}
            strokeLinecap="round"
          />
          {/* Hand tapers */}
          <Path d={handPath('left')} fill="none" stroke={LINE} strokeWidth={1.1} strokeLinecap="round" />
          <Path d={handPath('right')} fill="none" stroke={LINE} strokeWidth={1.1} strokeLinecap="round" />

          {/* --- Legs: outer + inner edges as separate strokes.
              No bottom closure — the leg reads as an open column
              that finishes at the foot. */}
          <Path
            d={legOuterPath('left')}
            fill="none"
            stroke={legStroke}
            strokeWidth={legStrokeWidth}
            strokeLinecap="round"
          />
          <Path
            d={legInnerPath('left')}
            fill="none"
            stroke={legStroke}
            strokeWidth={legStrokeWidth * 0.85}
            strokeLinecap="round"
          />
          <Path
            d={legOuterPath('right')}
            fill="none"
            stroke={legStroke}
            strokeWidth={legStrokeWidth}
            strokeLinecap="round"
          />
          <Path
            d={legInnerPath('right')}
            fill="none"
            stroke={legStroke}
            strokeWidth={legStrokeWidth * 0.85}
            strokeLinecap="round"
          />

          {/* --- Feet --- */}
          <Path d={footPath('left')} fill="none" stroke={LINE} strokeWidth={1.1} strokeLinecap="round" />
          <Path d={footPath('right')} fill="none" stroke={LINE} strokeWidth={1.1} strokeLinecap="round" />

          {/* --- Subtle centerline on the torso — only visible when the
              torso region is active, as a cue for the length being set. */}
          {focus.torso && (
            <Line
              x1={cx}
              y1={metrics.neckBottomY + 4}
              x2={cx}
              y2={metrics.crotchY + 2}
              stroke={HIGHLIGHT}
              strokeWidth={1.2}
              strokeDasharray="2 4"
              opacity={0.75}
            />
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Aspect ratio roughly 200:540 — taller than v1 for the croquis feel.
    // Parent sets actual dimensions; this just locks the ratio.
    aspectRatio: 200 / 540,
  },
});

// Re-export the shared enum so callers can import it from either file.
// Makes the swap from BodyFigurine → BodyCroquis a one-line import change.
export type { BodyFocusArea } from './bodyFigurineModel';
