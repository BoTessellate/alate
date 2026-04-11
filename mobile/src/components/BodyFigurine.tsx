/**
 * BodyFigurine — polished fashion croquis silhouette.
 *
 * Renders a parametric body figurine driven by 7 measurement inputs (height,
 * shoulders, bust, waist, hips, thighs, torso length). The silhouette is built
 * from smooth bezier curves and filled with a LinearGradient for a soft
 * fashion-illustration look. Active body zones glow blue when `activePart` is
 * set so the AvatarSetup screen can highlight the area being edited.
 *
 * The metrics come from `bodyFigurineModel.ts` — this file is purely the
 * visual rendering layer. Limbs that used to be rotated <Rect>s are now
 * tapered <Path>s built from cubic beziers so the result reads as a single
 * organic figure rather than stacked rectangles.
 */

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../constants/theme';
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

interface BodyFigurineProps {
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

// Fashion-illustration palette — gray-purple body matching brand palette,
// hairline outline, brand-purple highlight (#5a4377) for active focus areas.
const OUTLINE = '#3f2b54';
const HIGHLIGHT = '#5a4377';
const HIGHLIGHT_SOFT = '#c5c0d2';
const GUIDE = '#d8d4de';
const GUIDE_DARK = '#9a92ac';
const SHEEN = 'rgba(255, 255, 255, 0.55)';

export default function BodyFigurine({
  heightCm,
  shoulders,
  bust,
  waist,
  hips,
  thighs,
  torsoLength,
  activePart,
  style,
}: BodyFigurineProps) {
  const metrics = getBodyFigurineMetrics({
    heightCm,
    shoulders,
    bust,
    waist,
    hips,
    thighs,
    torsoLength,
  });
  const focusFill = getFocusFill(activePart);

  // ----------------------------------------------------------------
  // Geometry helpers — derived from metrics
  // ----------------------------------------------------------------
  const cx = metrics.centerX;
  const headCy = 32;
  const headRx = 16;
  const headRy = 21;
  const neckHalf = 6.2;

  // Torso curve points
  const shoulderCapY = metrics.shoulderY + 9;

  // Arm geometry — arms hang down with a gentle outward curve
  const armTopY = shoulderCapY - 1;
  const armBottomY = metrics.hipY + 70;
  const upperArmWidthShoulder = 9.5;
  const upperArmWidthElbow = 7;
  const forearmWidthElbow = 6.5;
  const forearmWidthWrist = 5.2;

  // Left arm anchor points (the figure's left = viewer's right)
  const armLeftShoulderX = cx - metrics.shoulderHalf + 2;
  const armLeftElbowX = cx - metrics.shoulderHalf - 4;
  const armLeftWristX = cx - metrics.hipHalf - 1;
  const elbowY = metrics.waistY + 10;

  const armRightShoulderX = cx + metrics.shoulderHalf - 2;
  const armRightElbowX = cx + metrics.shoulderHalf + 4;
  const armRightWristX = cx + metrics.hipHalf + 1;

  // Leg geometry — tapered thigh → calf → ankle
  const thighCenterLeftX = cx - metrics.legGap / 2 - metrics.thighWidth / 2;
  const thighCenterRightX = cx + metrics.legGap / 2 + metrics.thighWidth / 2;
  const ankleHalfWidth = Math.max(3.5, metrics.calfWidth * 0.42);
  const calfMaxHalfWidth = metrics.calfWidth * 0.62;
  const thighHalfWidth = metrics.thighWidth * 0.7;
  const legBottomY = metrics.footY - 4;

  // ----------------------------------------------------------------
  // Path builders
  // ----------------------------------------------------------------

  // Main torso silhouette — flowing single path from neck to crotch
  const torsoPath = [
    `M ${cx - neckHalf} ${metrics.neckBottomY}`,
    // Right side of neck → shoulder cap (figure's left)
    `C ${cx - 12} ${metrics.neckBottomY + 5}, ${cx - metrics.shoulderHalf * 0.78} ${metrics.shoulderY - 2}, ${cx - metrics.shoulderHalf} ${shoulderCapY}`,
    // Shoulder → bust → waist
    `C ${cx - metrics.bustHalf * 1.04} ${metrics.bustY - 18}, ${cx - metrics.bustHalf * 0.97} ${metrics.waistY - 12}, ${cx - metrics.waistHalf} ${metrics.waistY}`,
    // Waist → hips
    `C ${cx - metrics.waistHalf * 0.98} ${metrics.hipY - 14}, ${cx - metrics.hipHalf} ${metrics.hipY - 6}, ${cx - metrics.hipHalf} ${metrics.hipY + 8}`,
    // Hip → crotch (figure's left thigh upper)
    `C ${cx - metrics.hipHalf * 0.85} ${metrics.crotchY - 4}, ${cx - metrics.legGap / 2 - 6} ${metrics.crotchY - 1}, ${cx - metrics.legGap / 2 - 2} ${metrics.crotchY + 6}`,
    // Crotch base
    `L ${cx + metrics.legGap / 2 + 2} ${metrics.crotchY + 6}`,
    // Right thigh upper → hip
    `C ${cx + metrics.legGap / 2 + 6} ${metrics.crotchY - 1}, ${cx + metrics.hipHalf * 0.85} ${metrics.crotchY - 4}, ${cx + metrics.hipHalf} ${metrics.hipY + 8}`,
    // Hips → waist
    `C ${cx + metrics.hipHalf} ${metrics.hipY - 6}, ${cx + metrics.waistHalf * 0.98} ${metrics.hipY - 14}, ${cx + metrics.waistHalf} ${metrics.waistY}`,
    // Waist → bust → shoulder
    `C ${cx + metrics.bustHalf * 0.97} ${metrics.waistY - 12}, ${cx + metrics.bustHalf * 1.04} ${metrics.bustY - 18}, ${cx + metrics.shoulderHalf} ${shoulderCapY}`,
    // Shoulder → neck
    `C ${cx + metrics.shoulderHalf * 0.78} ${metrics.shoulderY - 2}, ${cx + 12} ${metrics.neckBottomY + 5}, ${cx + neckHalf} ${metrics.neckBottomY}`,
    'Z',
  ].join(' ');

  // Tapered limb path: builds a curved ribbon from a top point (with width)
  // through a mid point (with width) to a bottom point (with width). All
  // sides use cubic beziers so the limb reads as organic, not boxy.
  const taperedLimb = (
    topX: number,
    topY: number,
    topHalf: number,
    midX: number,
    midY: number,
    midHalf: number,
    botX: number,
    botY: number,
    botHalf: number
  ) => {
    return [
      `M ${topX - topHalf} ${topY}`,
      // Down the outer (left) edge
      `C ${midX - midHalf - 0.5} ${(topY + midY) / 2}, ${midX - midHalf} ${midY - 1}, ${midX - midHalf} ${midY}`,
      `C ${midX - midHalf} ${midY + 1}, ${botX - botHalf - 0.3} ${(midY + botY) / 2}, ${botX - botHalf} ${botY}`,
      // Across the bottom
      `C ${botX - botHalf * 0.4} ${botY + 2.5}, ${botX + botHalf * 0.4} ${botY + 2.5}, ${botX + botHalf} ${botY}`,
      // Up the inner (right) edge
      `C ${botX + botHalf + 0.3} ${(midY + botY) / 2}, ${midX + midHalf} ${midY + 1}, ${midX + midHalf} ${midY}`,
      `C ${midX + midHalf} ${midY - 1}, ${topX + topHalf + 0.5} ${(topY + midY) / 2}, ${topX + topHalf} ${topY}`,
      'Z',
    ].join(' ');
  };

  // Mirrored tapered limb (for the figure's right limbs)
  const leftArmPath = taperedLimb(
    armLeftShoulderX, armTopY, upperArmWidthShoulder / 2,
    armLeftElbowX, elbowY, upperArmWidthElbow / 2,
    armLeftWristX, armBottomY, forearmWidthWrist / 2
  );
  const rightArmPath = taperedLimb(
    armRightShoulderX, armTopY, upperArmWidthShoulder / 2,
    armRightElbowX, elbowY, upperArmWidthElbow / 2,
    armRightWristX, armBottomY, forearmWidthWrist / 2
  );

  const leftLegPath = taperedLimb(
    thighCenterLeftX, metrics.crotchY + 4, thighHalfWidth,
    thighCenterLeftX - 0.5, metrics.kneeY, calfMaxHalfWidth,
    thighCenterLeftX - 1, legBottomY, ankleHalfWidth
  );
  const rightLegPath = taperedLimb(
    thighCenterRightX, metrics.crotchY + 4, thighHalfWidth,
    thighCenterRightX + 0.5, metrics.kneeY, calfMaxHalfWidth,
    thighCenterRightX + 1, legBottomY, ankleHalfWidth
  );

  // Foot paths (small organic shapes at the ankle base)
  const leftFoot = `M ${thighCenterLeftX - ankleHalfWidth - 1} ${legBottomY + 1} C ${thighCenterLeftX - ankleHalfWidth - 5} ${legBottomY + 5}, ${thighCenterLeftX - ankleHalfWidth - 8} ${legBottomY + 9}, ${thighCenterLeftX - 4} ${legBottomY + 11} C ${thighCenterLeftX + ankleHalfWidth} ${legBottomY + 11}, ${thighCenterLeftX + ankleHalfWidth} ${legBottomY + 4}, ${thighCenterLeftX + ankleHalfWidth + 0.5} ${legBottomY} Z`;
  const rightFoot = `M ${thighCenterRightX + ankleHalfWidth + 1} ${legBottomY + 1} C ${thighCenterRightX + ankleHalfWidth + 5} ${legBottomY + 5}, ${thighCenterRightX + ankleHalfWidth + 8} ${legBottomY + 9}, ${thighCenterRightX + 4} ${legBottomY + 11} C ${thighCenterRightX - ankleHalfWidth} ${legBottomY + 11}, ${thighCenterRightX - ankleHalfWidth} ${legBottomY + 4}, ${thighCenterRightX - ankleHalfWidth - 0.5} ${legBottomY} Z`;

  // Centreline highlight stripe — thin curve down the front of the torso
  // gives the figure an inner sheen for 3D feel.
  const sheenPath = [
    `M ${cx - 2} ${metrics.neckBottomY + 6}`,
    `C ${cx - 5} ${metrics.bustY - 4}, ${cx - 4} ${metrics.waistY - 2}, ${cx - 3} ${metrics.hipY + 4}`,
    `L ${cx + 3} ${metrics.hipY + 4}`,
    `C ${cx + 4} ${metrics.waistY - 2}, ${cx + 5} ${metrics.bustY - 4}, ${cx + 2} ${metrics.neckBottomY + 6}`,
    'Z',
  ].join(' ');

  // ----------------------------------------------------------------
  // Region highlight paths (for activePart glow) — kept compact, only
  // the shapes that actually need to glow on the figurine.
  // ----------------------------------------------------------------
  const shouldersHighlightPath = [
    `M ${cx - metrics.shoulderHalf + 3} ${shoulderCapY + 1}`,
    `C ${cx - metrics.bustHalf * 1.04} ${metrics.bustY - 16}, ${cx - metrics.bustHalf * 0.78} ${metrics.bustY - 12}, ${cx - metrics.bustHalf * 0.5} ${metrics.bustY - 10}`,
    `L ${cx + metrics.bustHalf * 0.5} ${metrics.bustY - 10}`,
    `C ${cx + metrics.bustHalf * 0.78} ${metrics.bustY - 12}, ${cx + metrics.bustHalf * 1.04} ${metrics.bustY - 16}, ${cx + metrics.shoulderHalf - 3} ${shoulderCapY + 1}`,
    `C ${cx + metrics.shoulderHalf * 0.6} ${metrics.shoulderY + 1}, ${cx + 10} ${metrics.neckBottomY + 8}, ${cx + 5} ${metrics.neckBottomY + 14}`,
    `L ${cx - 5} ${metrics.neckBottomY + 14}`,
    `C ${cx - 10} ${metrics.neckBottomY + 8}, ${cx - metrics.shoulderHalf * 0.6} ${metrics.shoulderY + 1}, ${cx - metrics.shoulderHalf + 3} ${shoulderCapY + 1}`,
    'Z',
  ].join(' ');

  const bustHighlightPath = [
    `M ${cx - metrics.bustHalf * 0.86} ${metrics.bustY - 8}`,
    `C ${cx - metrics.bustHalf * 0.96} ${metrics.bustY + 4}, ${cx - metrics.waistHalf * 1.08} ${metrics.waistY - 12}, ${cx - metrics.waistHalf * 0.92} ${metrics.waistY - 4}`,
    `L ${cx + metrics.waistHalf * 0.92} ${metrics.waistY - 4}`,
    `C ${cx + metrics.waistHalf * 1.08} ${metrics.waistY - 12}, ${cx + metrics.bustHalf * 0.96} ${metrics.bustY + 4}, ${cx + metrics.bustHalf * 0.86} ${metrics.bustY - 8}`,
    `C ${cx + metrics.bustHalf * 0.46} ${metrics.bustY - 2}, ${cx - metrics.bustHalf * 0.46} ${metrics.bustY - 2}, ${cx - metrics.bustHalf * 0.86} ${metrics.bustY - 8}`,
    'Z',
  ].join(' ');

  const waistHighlightPath = [
    `M ${cx - metrics.waistHalf * 1.05} ${metrics.waistY - 8}`,
    `C ${cx - metrics.waistHalf * 0.95} ${metrics.waistY + 6}, ${cx - metrics.waistHalf * 0.98} ${metrics.hipY - 16}, ${cx - metrics.waistHalf * 0.82} ${metrics.hipY - 10}`,
    `L ${cx + metrics.waistHalf * 0.82} ${metrics.hipY - 10}`,
    `C ${cx + metrics.waistHalf * 0.98} ${metrics.hipY - 16}, ${cx + metrics.waistHalf * 0.95} ${metrics.waistY + 6}, ${cx + metrics.waistHalf * 1.05} ${metrics.waistY - 8}`,
    `C ${cx + metrics.waistHalf * 0.44} ${metrics.waistY - 3}, ${cx - metrics.waistHalf * 0.44} ${metrics.waistY - 3}, ${cx - metrics.waistHalf * 1.05} ${metrics.waistY - 8}`,
    'Z',
  ].join(' ');

  const hipsHighlightPath = [
    `M ${cx - metrics.hipHalf * 0.92} ${metrics.hipY - 4}`,
    `C ${cx - metrics.hipHalf * 0.84} ${metrics.hipY + 18}, ${cx - metrics.legGap / 2 - 5} ${metrics.crotchY + 2}, ${cx - metrics.legGap / 2 - 3} ${metrics.crotchY + 8}`,
    `L ${cx + metrics.legGap / 2 + 3} ${metrics.crotchY + 8}`,
    `C ${cx + metrics.legGap / 2 + 5} ${metrics.crotchY + 2}, ${cx + metrics.hipHalf * 0.84} ${metrics.hipY + 18}, ${cx + metrics.hipHalf * 0.92} ${metrics.hipY - 4}`,
    `C ${cx + metrics.hipHalf * 0.4} ${metrics.hipY - 8}, ${cx - metrics.hipHalf * 0.4} ${metrics.hipY - 8}, ${cx - metrics.hipHalf * 0.92} ${metrics.hipY - 4}`,
    'Z',
  ].join(' ');

  const torsoHighlightPath = [
    `M ${cx - metrics.bustHalf * 0.9} ${metrics.bustY - 10}`,
    `C ${cx - metrics.bustHalf * 1.02} ${metrics.bustY + 10}, ${cx - metrics.hipHalf * 0.7} ${metrics.hipY - 12}, ${cx - metrics.hipHalf * 0.78} ${metrics.hipY + 8}`,
    `L ${cx + metrics.hipHalf * 0.78} ${metrics.hipY + 8}`,
    `C ${cx + metrics.hipHalf * 0.7} ${metrics.hipY - 12}, ${cx + metrics.bustHalf * 1.02} ${metrics.bustY + 10}, ${cx + metrics.bustHalf * 0.9} ${metrics.bustY - 10}`,
    `C ${cx + metrics.bustHalf * 0.42} ${metrics.bustY - 4}, ${cx - metrics.bustHalf * 0.42} ${metrics.bustY - 4}, ${cx - metrics.bustHalf * 0.9} ${metrics.bustY - 10}`,
    'Z',
  ].join(' ');

  const heightGuideColor = focusFill.height ? HIGHLIGHT : GUIDE_DARK;
  const strokeWidth = 1.4;

  return (
    <View style={[styles.container, style]} testID="body-figurine">
      <Svg width="100%" height="100%" viewBox="0 0 220 420">
        <Defs>
          {/* Body fill — gray-purple, lighter on the front, deeper on the side. */}
          <LinearGradient id="bodyFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#9a92ac" />
            <Stop offset="0.45" stopColor="#c5c0d2" />
            <Stop offset="1" stopColor="#7d6699" />
          </LinearGradient>
          {/* Limb fill — slightly deeper to give the limbs depth against torso */}
          <LinearGradient id="limbFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#867a9c" />
            <Stop offset="0.5" stopColor="#b5afc4" />
            <Stop offset="1" stopColor="#6a577f" />
          </LinearGradient>
          {/* Head fill — same gray-purple, vertical gradient for hair shadow */}
          <LinearGradient id="headFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7d6699" />
            <Stop offset="0.5" stopColor="#b5afc4" />
            <Stop offset="1" stopColor="#867a9c" />
          </LinearGradient>
          {/* Active highlight fill — brand purple #5a4377 */}
          <LinearGradient id="highlightFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#5a4377" />
            <Stop offset="0.5" stopColor="#7d6699" />
            <Stop offset="1" stopColor="#3f2b54" />
          </LinearGradient>
        </Defs>

        {/* Backdrop card */}
        <Rect x="20" y="10" width="180" height="400" rx="28" fill={colors.surface} />
        <Rect
          x="20.5"
          y="10.5"
          width="179"
          height="399"
          rx="27.5"
          fill="none"
          stroke={GUIDE}
        />

        {/* Height ruler */}
        <Line x1="170" y1="88" x2="170" y2="392" stroke={heightGuideColor} strokeDasharray="3 4" />
        <Line x1="162" y1="88" x2="178" y2="88" stroke={heightGuideColor} strokeWidth="1.5" />
        <Line x1="162" y1="392" x2="178" y2="392" stroke={heightGuideColor} strokeWidth="1.5" />
        <SvgText
          x="170"
          y="80"
          textAnchor="middle"
          fill={heightGuideColor}
          fontSize="10"
          fontWeight="600"
        >
          H
        </SvgText>

        {/* Figure (height-scaled) */}
        <G transform={`translate(0 ${392 - 392 * metrics.figureScaleY}) scale(1 ${metrics.figureScaleY})`}>
          {/* Centerline guide */}
          <Line
            x1={cx}
            y1="64"
            x2={cx}
            y2={metrics.footY}
            stroke={GUIDE}
            strokeWidth="0.7"
            strokeDasharray="2 5"
          />

          {/* --- Legs (rendered first so torso overlaps cleanly at hips) --- */}
          <Path
            d={leftLegPath}
            fill={focusFill.thighs ? 'url(#highlightFill)' : 'url(#limbFill)'}
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          <Path
            d={rightLegPath}
            fill={focusFill.thighs ? 'url(#highlightFill)' : 'url(#limbFill)'}
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />

          {/* Feet */}
          <Path d={leftFoot} fill="url(#limbFill)" stroke={OUTLINE} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <Path d={rightFoot} fill="url(#limbFill)" stroke={OUTLINE} strokeWidth={strokeWidth} strokeLinejoin="round" />

          {/* --- Arms (also rendered before torso so shoulder caps blend) --- */}
          <Path
            d={leftArmPath}
            fill={focusFill.shoulders ? 'url(#highlightFill)' : 'url(#limbFill)'}
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          <Path
            d={rightArmPath}
            fill={focusFill.shoulders ? 'url(#highlightFill)' : 'url(#limbFill)'}
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />

          {/* Hands (small soft ovals) */}
          <Ellipse
            cx={armLeftWristX - 1}
            cy={armBottomY + 6}
            rx="4.2"
            ry="6.5"
            fill="url(#limbFill)"
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
          />
          <Ellipse
            cx={armRightWristX + 1}
            cy={armBottomY + 6}
            rx="4.2"
            ry="6.5"
            fill="url(#limbFill)"
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
          />

          {/* --- Head + neck --- */}
          <Path
            d={`M ${cx - 4.5} 53 L ${cx - neckHalf} ${metrics.neckBottomY} L ${cx + neckHalf} ${metrics.neckBottomY} L ${cx + 4.5} 53 Z`}
            fill="url(#headFill)"
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          <Ellipse
            cx={cx}
            cy={headCy}
            rx={headRx}
            ry={headRy}
            fill={focusFill.height ? HIGHLIGHT_SOFT : 'url(#headFill)'}
            stroke={focusFill.height ? HIGHLIGHT : OUTLINE}
            strokeWidth={strokeWidth}
          />
          {/* Hair sheen — short curve over the crown */}
          <Path
            d={`M ${cx - headRx + 3} ${headCy - 8} C ${cx - 4} ${headCy - headRy + 1}, ${cx + 4} ${headCy - headRy + 1}, ${cx + headRx - 3} ${headCy - 8}`}
            stroke={SHEEN}
            strokeWidth="1.2"
            fill="none"
          />

          {/* --- Torso (drawn over arms/legs for clean shoulder + hip joins) --- */}
          <Path
            d={torsoPath}
            fill="url(#bodyFill)"
            stroke={OUTLINE}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          {/* Centerline sheen — gives the body a 3D inner highlight */}
          <Path d={sheenPath} fill={SHEEN} />

          {/* --- Active region highlights (sit on top of torso) --- */}
          {focusFill.shoulders && (
            <Path d={shouldersHighlightPath} fill={HIGHLIGHT} opacity="0.85" />
          )}
          {focusFill.bust && <Path d={bustHighlightPath} fill={HIGHLIGHT} opacity="0.88" />}
          {focusFill.waist && <Path d={waistHighlightPath} fill={HIGHLIGHT} opacity="0.9" />}
          {focusFill.hips && <Path d={hipsHighlightPath} fill={HIGHLIGHT} opacity="0.88" />}
          {focusFill.torso && <Path d={torsoHighlightPath} fill={HIGHLIGHT} opacity="0.88" />}

          {/* Subtle anatomy lines — bust, waist, hip (as guidelines) */}
          <Line
            x1={cx - metrics.bustHalf * 0.6}
            y1={metrics.bustY - 4}
            x2={cx + metrics.bustHalf * 0.6}
            y2={metrics.bustY - 4}
            stroke={SHEEN}
            strokeWidth="0.8"
          />
          <Line
            x1={cx - metrics.waistHalf * 0.7}
            y1={metrics.waistY - 1}
            x2={cx + metrics.waistHalf * 0.7}
            y2={metrics.waistY - 1}
            stroke={SHEEN}
            strokeWidth="0.8"
          />

          {/* Active measurement caliper line */}
          {(focusFill.waist || focusFill.hips || focusFill.bust || focusFill.torso) && (
            <>
              <Line
                x1={cx - Math.max(metrics.bustHalf, metrics.hipHalf) - 6}
                y1={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                x2={cx + Math.max(metrics.bustHalf, metrics.hipHalf) + 6}
                y2={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                stroke={HIGHLIGHT}
                strokeWidth="1.4"
                strokeDasharray="3 3"
              />
              <Circle
                cx={cx - Math.max(metrics.bustHalf, metrics.hipHalf) - 6}
                cy={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                r="2.5"
                fill={HIGHLIGHT}
              />
              <Circle
                cx={cx + Math.max(metrics.bustHalf, metrics.hipHalf) + 6}
                cy={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                r="2.5"
                fill={HIGHLIGHT}
              />
            </>
          )}
        </G>

        <SvgText
          x="170"
          y="406"
          textAnchor="middle"
          fill={heightGuideColor}
          fontSize="11"
          fontWeight="600"
        >
          {metrics.heightLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 210,
    height: 420,
  },
});
