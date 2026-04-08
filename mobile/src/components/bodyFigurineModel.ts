import type {
  BustType,
  HipType,
  ShoulderType,
  ThighType,
  TorsoType,
  WaistType,
} from '../store/avatarStore';

export type BodyFocusArea =
  | 'height'
  | 'shoulders'
  | 'bust'
  | 'waist'
  | 'hips'
  | 'thighs'
  | 'torso';

export interface BodyFigurineInputs {
  heightCm?: number | null;
  shoulders?: ShoulderType | null;
  bust?: BustType | null;
  waist?: WaistType | null;
  hips?: HipType | null;
  thighs?: ThighType | null;
  torsoLength?: TorsoType | null;
}

type NormalizedBodyFigurineInputs = {
  heightCm: number;
  shoulders: ShoulderType;
  bust: BustType;
  waist: WaistType;
  hips: HipType;
  thighs: ThighType;
  torsoLength: TorsoType;
};

export interface BodyFigurineMetrics {
  centerX: number;
  neckBottomY: number;
  shoulderY: number;
  bustY: number;
  waistY: number;
  hipY: number;
  crotchY: number;
  midThighY: number;
  kneeY: number;
  calfY: number;
  ankleY: number;
  footY: number;
  shoulderHalf: number;
  bustHalf: number;
  waistHalf: number;
  hipHalf: number;
  thighWidth: number;
  calfWidth: number;
  upperArmWidth: number;
  forearmWidth: number;
  legGap: number;
  figureScaleY: number;
  heightLabel: string;
}

const SHOULDER_SCALE: Record<ShoulderType, number> = {
  narrow: 0.92,
  average: 1,
  broad: 1.12,
};

const BUST_SCALE: Record<BustType, number> = {
  small: 0.92,
  medium: 1,
  large: 1.1,
  'extra-large': 1.18,
};

const WAIST_SCALE: Record<WaistType, number> = {
  defined: 0.82,
  average: 0.92,
  undefined: 1.02,
};

const HIP_SCALE: Record<HipType, number> = {
  narrow: 0.92,
  average: 1,
  wide: 1.1,
  'extra-wide': 1.2,
};

const THIGH_SCALE: Record<ThighType, number> = {
  slim: 0.88,
  average: 1,
  muscular: 1.08,
  full: 1.16,
};

const TORSO_SHIFT: Record<TorsoType, number> = {
  short: -14,
  average: 0,
  long: 14,
};

const DEFAULT_INPUTS: NormalizedBodyFigurineInputs = {
  heightCm: 168,
  shoulders: 'average',
  bust: 'medium',
  waist: 'average',
  hips: 'average',
  thighs: 'average',
  torsoLength: 'average',
};

export const BODY_FOCUS_ORDER: BodyFocusArea[] = [
  'height',
  'shoulders',
  'bust',
  'waist',
  'hips',
  'thighs',
  'torso',
];

export function getHeightOptionLabel(heightCm?: number | null) {
  if (heightCm == null) {
    return 'Tap to set';
  }

  if (heightCm <= 155) return "Under 5'3\"";
  if (heightCm <= 163) return "5'3\" - 5'5\"";
  if (heightCm <= 168) return "5'5\" - 5'7\"";
  if (heightCm <= 173) return "5'7\" - 5'9\"";
  if (heightCm <= 178) return "5'9\" - 5'11\"";
  return "Over 5'11\"";
}

function normalizeInputs(inputs: BodyFigurineInputs): NormalizedBodyFigurineInputs {
  return {
    heightCm: inputs.heightCm ?? DEFAULT_INPUTS.heightCm,
    shoulders: inputs.shoulders ?? DEFAULT_INPUTS.shoulders,
    bust: inputs.bust ?? DEFAULT_INPUTS.bust,
    waist: inputs.waist ?? DEFAULT_INPUTS.waist,
    hips: inputs.hips ?? DEFAULT_INPUTS.hips,
    thighs: inputs.thighs ?? DEFAULT_INPUTS.thighs,
    torsoLength: inputs.torsoLength ?? DEFAULT_INPUTS.torsoLength,
  };
}

export function getBodyFigurineMetrics(inputs: BodyFigurineInputs): BodyFigurineMetrics {
  const normalized = normalizeInputs(inputs);
  const torsoShift = TORSO_SHIFT[normalized.torsoLength];
  const legSpanBase = 392 - (196 + torsoShift);
  const heightScale = 0.92 + ((normalized.heightCm - 155) / (183 - 155)) * 0.14;

  const shoulderHalf = 34 * SHOULDER_SCALE[normalized.shoulders];
  const bustHalf =
    28 * BUST_SCALE[normalized.bust] + (SHOULDER_SCALE[normalized.shoulders] - 1) * 3;
  const waistHalf = 20 * WAIST_SCALE[normalized.waist];
  const hipHalf = 31 * HIP_SCALE[normalized.hips];
  const thighWidth = 13.5 * THIGH_SCALE[normalized.thighs];

  return {
    centerX: 100,
    neckBottomY: 62,
    shoulderY: 74,
    bustY: 108 + torsoShift * 0.2,
    waistY: 145 + torsoShift * 0.58,
    hipY: 178 + torsoShift * 0.84,
    crotchY: 196 + torsoShift,
    midThighY: 196 + torsoShift + legSpanBase * 0.18,
    kneeY: 196 + torsoShift + legSpanBase * 0.48,
    calfY: 196 + torsoShift + legSpanBase * 0.72,
    ankleY: 196 + torsoShift + legSpanBase * 0.92,
    footY: 392,
    shoulderHalf,
    bustHalf,
    waistHalf,
    hipHalf,
    thighWidth,
    calfWidth: Math.max(8, thighWidth * 0.73),
    upperArmWidth: 9.5,
    forearmWidth: 7.25,
    legGap: 8,
    figureScaleY: Math.max(0.92, Math.min(1.06, heightScale)),
    heightLabel: getHeightOptionLabel(normalized.heightCm),
  };
}

export function getFocusFill(activePart: BodyFocusArea | null | undefined) {
  return {
    height: activePart === 'height',
    shoulders: activePart === 'shoulders',
    bust: activePart === 'bust',
    waist: activePart === 'waist',
    hips: activePart === 'hips',
    thighs: activePart === 'thighs',
    torso: activePart === 'torso',
  };
}
