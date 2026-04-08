import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
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

const BODY_FILL = '#231531';
const BODY_STROKE = '#6B5B8A';
const GUIDE = '#D9D2E7';
const GUIDE_DARK = '#BFB4D8';
const HIGHLIGHT = '#63B4F4';
const HIGHLIGHT_SOFT = '#D7EEFF';

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

  const neckHalf = 7;
  const headCx = metrics.centerX;
  const headCy = 32;
  const shoulderCapY = metrics.shoulderY + 10;
  const upperArmLength = metrics.waistY - metrics.shoulderY + 20;
  const forearmLength = metrics.hipY - metrics.waistY + 34;
  const armBaseX = metrics.centerX - metrics.shoulderHalf + 3;
  const rightArmBaseX = metrics.centerX + metrics.shoulderHalf - 3;
  const leftElbowX = metrics.centerX - metrics.shoulderHalf - 6;
  const rightElbowX = metrics.centerX + metrics.shoulderHalf + 6;
  const leftWristX = metrics.centerX - metrics.hipHalf + 2;
  const rightWristX = metrics.centerX + metrics.hipHalf - 2;
  const thighInnerLeftX = metrics.centerX - metrics.legGap / 2 - metrics.thighWidth;
  const thighInnerRightX = metrics.centerX + metrics.legGap / 2;
  const calfLeftX = metrics.centerX - metrics.legGap / 2 - metrics.calfWidth;
  const calfRightX = metrics.centerX + metrics.legGap / 2;
  const torsoPath = [
    `M ${metrics.centerX - neckHalf} ${metrics.neckBottomY}`,
    `C ${metrics.centerX - 14} ${metrics.neckBottomY + 4}, ${metrics.centerX - metrics.shoulderHalf * 0.84} ${metrics.shoulderY - 2}, ${metrics.centerX - metrics.shoulderHalf} ${shoulderCapY}`,
    `C ${metrics.centerX - metrics.bustHalf * 1.05} ${metrics.bustY - 20}, ${metrics.centerX - metrics.bustHalf * 0.98} ${metrics.waistY - 14}, ${metrics.centerX - metrics.waistHalf} ${metrics.waistY}`,
    `C ${metrics.centerX - metrics.waistHalf * 0.96} ${metrics.hipY - 10}, ${metrics.centerX - metrics.hipHalf} ${metrics.hipY - 4}, ${metrics.centerX - metrics.hipHalf} ${metrics.hipY + 9}`,
    `C ${metrics.centerX - metrics.hipHalf * 0.8} ${metrics.crotchY - 2}, ${metrics.centerX - metrics.legGap / 2 - 8} ${metrics.crotchY}, ${metrics.centerX - metrics.legGap / 2 - 4} ${metrics.crotchY + 7}`,
    `L ${metrics.centerX + metrics.legGap / 2 + 4} ${metrics.crotchY + 7}`,
    `C ${metrics.centerX + metrics.legGap / 2 + 8} ${metrics.crotchY}, ${metrics.centerX + metrics.hipHalf * 0.8} ${metrics.crotchY - 2}, ${metrics.centerX + metrics.hipHalf} ${metrics.hipY + 9}`,
    `C ${metrics.centerX + metrics.hipHalf} ${metrics.hipY - 4}, ${metrics.centerX + metrics.waistHalf * 0.96} ${metrics.hipY - 10}, ${metrics.centerX + metrics.waistHalf} ${metrics.waistY}`,
    `C ${metrics.centerX + metrics.bustHalf * 0.98} ${metrics.waistY - 14}, ${metrics.centerX + metrics.bustHalf * 1.05} ${metrics.bustY - 20}, ${metrics.centerX + metrics.shoulderHalf} ${shoulderCapY}`,
    `C ${metrics.centerX + metrics.shoulderHalf * 0.84} ${metrics.shoulderY - 2}, ${metrics.centerX + 14} ${metrics.neckBottomY + 4}, ${metrics.centerX + neckHalf} ${metrics.neckBottomY}`,
    'Z',
  ].join(' ');

  const shouldersHighlightPath = [
    `M ${metrics.centerX - metrics.shoulderHalf + 4} ${shoulderCapY + 1}`,
    `C ${metrics.centerX - metrics.bustHalf * 1.04} ${metrics.bustY - 18}, ${metrics.centerX - metrics.bustHalf * 0.8} ${metrics.bustY - 12}, ${metrics.centerX - metrics.bustHalf * 0.55} ${metrics.bustY - 10}`,
    `L ${metrics.centerX + metrics.bustHalf * 0.55} ${metrics.bustY - 10}`,
    `C ${metrics.centerX + metrics.bustHalf * 0.8} ${metrics.bustY - 12}, ${metrics.centerX + metrics.bustHalf * 1.04} ${metrics.bustY - 18}, ${metrics.centerX + metrics.shoulderHalf - 4} ${shoulderCapY + 1}`,
    `C ${metrics.centerX + metrics.shoulderHalf * 0.62} ${metrics.shoulderY + 2}, ${metrics.centerX + 11} ${metrics.neckBottomY + 9}, ${metrics.centerX + 5} ${metrics.neckBottomY + 15}`,
    `L ${metrics.centerX - 5} ${metrics.neckBottomY + 15}`,
    `C ${metrics.centerX - 11} ${metrics.neckBottomY + 9}, ${metrics.centerX - metrics.shoulderHalf * 0.62} ${metrics.shoulderY + 2}, ${metrics.centerX - metrics.shoulderHalf + 4} ${shoulderCapY + 1}`,
    'Z',
  ].join(' ');

  const bustHighlightPath = [
    `M ${metrics.centerX - metrics.bustHalf * 0.84} ${metrics.bustY - 8}`,
    `C ${metrics.centerX - metrics.bustHalf * 0.96} ${metrics.bustY + 4}, ${metrics.centerX - metrics.waistHalf * 1.1} ${metrics.waistY - 12}, ${metrics.centerX - metrics.waistHalf * 0.9} ${metrics.waistY - 4}`,
    `L ${metrics.centerX + metrics.waistHalf * 0.9} ${metrics.waistY - 4}`,
    `C ${metrics.centerX + metrics.waistHalf * 1.1} ${metrics.waistY - 12}, ${metrics.centerX + metrics.bustHalf * 0.96} ${metrics.bustY + 4}, ${metrics.centerX + metrics.bustHalf * 0.84} ${metrics.bustY - 8}`,
    `C ${metrics.centerX + metrics.bustHalf * 0.46} ${metrics.bustY - 2}, ${metrics.centerX - metrics.bustHalf * 0.46} ${metrics.bustY - 2}, ${metrics.centerX - metrics.bustHalf * 0.84} ${metrics.bustY - 8}`,
    'Z',
  ].join(' ');

  const waistHighlightPath = [
    `M ${metrics.centerX - metrics.waistHalf * 1.05} ${metrics.waistY - 8}`,
    `C ${metrics.centerX - metrics.waistHalf * 0.95} ${metrics.waistY + 6}, ${metrics.centerX - metrics.waistHalf * 0.98} ${metrics.hipY - 16}, ${metrics.centerX - metrics.waistHalf * 0.8} ${metrics.hipY - 10}`,
    `L ${metrics.centerX + metrics.waistHalf * 0.8} ${metrics.hipY - 10}`,
    `C ${metrics.centerX + metrics.waistHalf * 0.98} ${metrics.hipY - 16}, ${metrics.centerX + metrics.waistHalf * 0.95} ${metrics.waistY + 6}, ${metrics.centerX + metrics.waistHalf * 1.05} ${metrics.waistY - 8}`,
    `C ${metrics.centerX + metrics.waistHalf * 0.44} ${metrics.waistY - 3}, ${metrics.centerX - metrics.waistHalf * 0.44} ${metrics.waistY - 3}, ${metrics.centerX - metrics.waistHalf * 1.05} ${metrics.waistY - 8}`,
    'Z',
  ].join(' ');

  const hipsHighlightPath = [
    `M ${metrics.centerX - metrics.hipHalf * 0.92} ${metrics.hipY - 4}`,
    `C ${metrics.centerX - metrics.hipHalf * 0.82} ${metrics.hipY + 18}, ${metrics.centerX - metrics.legGap / 2 - 7} ${metrics.crotchY + 2}, ${metrics.centerX - metrics.legGap / 2 - 5} ${metrics.crotchY + 9}`,
    `L ${metrics.centerX + metrics.legGap / 2 + 5} ${metrics.crotchY + 9}`,
    `C ${metrics.centerX + metrics.legGap / 2 + 7} ${metrics.crotchY + 2}, ${metrics.centerX + metrics.hipHalf * 0.82} ${metrics.hipY + 18}, ${metrics.centerX + metrics.hipHalf * 0.92} ${metrics.hipY - 4}`,
    `C ${metrics.centerX + metrics.hipHalf * 0.4} ${metrics.hipY - 8}, ${metrics.centerX - metrics.hipHalf * 0.4} ${metrics.hipY - 8}, ${metrics.centerX - metrics.hipHalf * 0.92} ${metrics.hipY - 4}`,
    'Z',
  ].join(' ');

  const torsoHighlightPath = [
    `M ${metrics.centerX - metrics.bustHalf * 0.9} ${metrics.bustY - 10}`,
    `C ${metrics.centerX - metrics.bustHalf * 1.02} ${metrics.bustY + 10}, ${metrics.centerX - metrics.hipHalf * 0.7} ${metrics.hipY - 12}, ${metrics.centerX - metrics.hipHalf * 0.78} ${metrics.hipY + 8}`,
    `L ${metrics.centerX + metrics.hipHalf * 0.78} ${metrics.hipY + 8}`,
    `C ${metrics.centerX + metrics.hipHalf * 0.7} ${metrics.hipY - 12}, ${metrics.centerX + metrics.bustHalf * 1.02} ${metrics.bustY + 10}, ${metrics.centerX + metrics.bustHalf * 0.9} ${metrics.bustY - 10}`,
    `C ${metrics.centerX + metrics.bustHalf * 0.42} ${metrics.bustY - 4}, ${metrics.centerX - metrics.bustHalf * 0.42} ${metrics.bustY - 4}, ${metrics.centerX - metrics.bustHalf * 0.9} ${metrics.bustY - 10}`,
    'Z',
  ].join(' ');

  const heightGuideColor = focusFill.height ? HIGHLIGHT : GUIDE_DARK;
  const strokeWidth = 1.7;

  return (
    <View style={[styles.container, style]} testID="body-figurine">
      <Svg width="100%" height="100%" viewBox="0 0 220 420">
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

        <G transform={`translate(0 ${392 - 392 * metrics.figureScaleY}) scale(1 ${metrics.figureScaleY})`}>
          <Line
            x1={metrics.centerX}
            y1="64"
            x2={metrics.centerX}
            y2={metrics.footY}
            stroke={GUIDE}
            strokeWidth="1"
            strokeDasharray="2 5"
          />

          <Ellipse
            cx={headCx}
            cy={headCy}
            rx="17"
            ry="23"
            fill={focusFill.height ? HIGHLIGHT_SOFT : colors.surface}
            stroke={focusFill.height ? HIGHLIGHT : GUIDE_DARK}
            strokeWidth={strokeWidth}
          />

          <Path d={`M ${metrics.centerX - 5} 54 L ${metrics.centerX - neckHalf} ${metrics.neckBottomY} L ${metrics.centerX + neckHalf} ${metrics.neckBottomY} L ${metrics.centerX + 5} 54`} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={strokeWidth} />
          <Path d={torsoPath} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={strokeWidth} />

          {focusFill.shoulders && (
            <Path d={shouldersHighlightPath} fill={HIGHLIGHT} opacity="0.9" />
          )}
          {focusFill.bust && <Path d={bustHighlightPath} fill={HIGHLIGHT} opacity="0.92" />}
          {focusFill.waist && <Path d={waistHighlightPath} fill={HIGHLIGHT} opacity="0.94" />}
          {focusFill.hips && <Path d={hipsHighlightPath} fill={HIGHLIGHT} opacity="0.92" />}
          {focusFill.torso && <Path d={torsoHighlightPath} fill={HIGHLIGHT} opacity="0.92" />}

          <Line
            x1={metrics.centerX - metrics.bustHalf * 0.95}
            y1={metrics.bustY - 4}
            x2={metrics.centerX + metrics.bustHalf * 0.95}
            y2={metrics.bustY - 4}
            stroke={GUIDE}
            strokeWidth="1"
          />
          <Line
            x1={metrics.centerX - metrics.waistHalf * 1.02}
            y1={metrics.waistY - 1}
            x2={metrics.centerX + metrics.waistHalf * 1.02}
            y2={metrics.waistY - 1}
            stroke={GUIDE}
            strokeWidth="1"
          />
          <Line
            x1={metrics.centerX - metrics.hipHalf * 0.92}
            y1={metrics.hipY + 2}
            x2={metrics.centerX + metrics.hipHalf * 0.92}
            y2={metrics.hipY + 2}
            stroke={GUIDE}
            strokeWidth="1"
          />

          <Rect
            x={armBaseX}
            y={metrics.shoulderY + 10}
            width={metrics.upperArmWidth}
            height={upperArmLength}
            rx={metrics.upperArmWidth / 2}
            fill={focusFill.shoulders ? HIGHLIGHT : BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(8 ${armBaseX + metrics.upperArmWidth / 2} ${metrics.shoulderY + 10})`}
          />
          <Rect
            x={rightArmBaseX - metrics.upperArmWidth}
            y={metrics.shoulderY + 10}
            width={metrics.upperArmWidth}
            height={upperArmLength}
            rx={metrics.upperArmWidth / 2}
            fill={focusFill.shoulders ? HIGHLIGHT : BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(-8 ${rightArmBaseX - metrics.upperArmWidth / 2} ${metrics.shoulderY + 10})`}
          />

          <Rect
            x={leftElbowX}
            y={metrics.waistY + 12}
            width={metrics.forearmWidth}
            height={forearmLength}
            rx={metrics.forearmWidth / 2}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(4 ${leftElbowX + metrics.forearmWidth / 2} ${metrics.waistY + 12})`}
          />
          <Rect
            x={rightElbowX - metrics.forearmWidth}
            y={metrics.waistY + 12}
            width={metrics.forearmWidth}
            height={forearmLength}
            rx={metrics.forearmWidth / 2}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(-4 ${rightElbowX - metrics.forearmWidth / 2} ${metrics.waistY + 12})`}
          />

          <Ellipse cx={leftWristX} cy={metrics.hipY + 72} rx="5" ry="11" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={strokeWidth} transform={`rotate(6 ${leftWristX} ${metrics.hipY + 72})`} />
          <Ellipse cx={rightWristX} cy={metrics.hipY + 72} rx="5" ry="11" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth={strokeWidth} transform={`rotate(-6 ${rightWristX} ${metrics.hipY + 72})`} />

          <Rect
            x={thighInnerLeftX}
            y={metrics.crotchY + 6}
            width={metrics.thighWidth}
            height={metrics.kneeY - metrics.crotchY - 2}
            rx={metrics.thighWidth / 2}
            fill={focusFill.thighs ? HIGHLIGHT : BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(1 ${thighInnerLeftX + metrics.thighWidth / 2} ${metrics.crotchY + 6})`}
          />
          <Rect
            x={thighInnerRightX}
            y={metrics.crotchY + 6}
            width={metrics.thighWidth}
            height={metrics.kneeY - metrics.crotchY - 2}
            rx={metrics.thighWidth / 2}
            fill={focusFill.thighs ? HIGHLIGHT : BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(-1 ${thighInnerRightX + metrics.thighWidth / 2} ${metrics.crotchY + 6})`}
          />

          <Rect
            x={calfLeftX}
            y={metrics.kneeY - 4}
            width={metrics.calfWidth}
            height={metrics.ankleY - metrics.kneeY + 2}
            rx={metrics.calfWidth / 2}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(1 ${calfLeftX + metrics.calfWidth / 2} ${metrics.kneeY - 4})`}
          />
          <Rect
            x={calfRightX}
            y={metrics.kneeY - 4}
            width={metrics.calfWidth}
            height={metrics.ankleY - metrics.kneeY + 2}
            rx={metrics.calfWidth / 2}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
            transform={`rotate(-1 ${calfRightX + metrics.calfWidth / 2} ${metrics.kneeY - 4})`}
          />

          <Path
            d={`M ${calfLeftX + metrics.calfWidth / 2} ${metrics.footY - 6} C ${calfLeftX + metrics.calfWidth / 2 - 3} ${metrics.footY + 4}, ${calfLeftX - 4} ${metrics.footY + 8}, ${calfLeftX - 10} ${metrics.footY + 2} C ${calfLeftX - 2} ${metrics.footY + 10}, ${calfLeftX + 10} ${metrics.footY + 10}, ${calfLeftX + 12} ${metrics.footY} Z`}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
          />
          <Path
            d={`M ${calfRightX + metrics.calfWidth / 2} ${metrics.footY - 6} C ${calfRightX + metrics.calfWidth / 2 + 3} ${metrics.footY + 4}, ${calfRightX + metrics.calfWidth + 4} ${metrics.footY + 8}, ${calfRightX + metrics.calfWidth + 10} ${metrics.footY + 2} C ${calfRightX + metrics.calfWidth + 2} ${metrics.footY + 10}, ${calfRightX + metrics.calfWidth - 10} ${metrics.footY + 10}, ${calfRightX + metrics.calfWidth - 12} ${metrics.footY} Z`}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={strokeWidth}
          />

          {(focusFill.waist || focusFill.hips || focusFill.bust || focusFill.torso) && (
            <>
              <Line
                x1={metrics.centerX - Math.max(metrics.bustHalf, metrics.hipHalf) - 6}
                y1={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                x2={metrics.centerX + Math.max(metrics.bustHalf, metrics.hipHalf) + 6}
                y2={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                stroke={HIGHLIGHT}
                strokeWidth="1.6"
                strokeDasharray="3 3"
              />
              <Circle
                cx={metrics.centerX - Math.max(metrics.bustHalf, metrics.hipHalf) - 6}
                cy={
                  focusFill.bust ? metrics.bustY - 3 : focusFill.waist ? metrics.waistY - 1 : focusFill.hips ? metrics.hipY + 1 : metrics.waistY
                }
                r="2.5"
                fill={HIGHLIGHT}
              />
              <Circle
                cx={metrics.centerX + Math.max(metrics.bustHalf, metrics.hipHalf) + 6}
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
