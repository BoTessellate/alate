/**
 * Core Type Definitions - Fit Check Tool
 */

// Avatar/Body Profile types
export type ShoulderType = 'narrow' | 'average' | 'broad';
export type BustType = 'small' | 'medium' | 'large' | 'extra-large';
export type WaistType = 'defined' | 'average' | 'undefined';
export type HipType = 'narrow' | 'average' | 'wide' | 'extra-wide';
export type ThighType = 'slim' | 'average' | 'muscular' | 'full';
export type TorsoType = 'short' | 'average' | 'long';

export interface Avatar {
  height_cm: number;
  shoulders: ShoulderType;
  bust: BustType;
  waist: WaistType;
  hips: HipType;
  thighs: ThighType;
  torso_length: TorsoType;
}

// Product types
export interface ScrapedProduct {
  name?: string;
  image?: string;
  description?: string;
  price?: {
    amount: number;
    currency: string;
  };
  brand?: string;
}

export interface EnrichedProduct {
  id?: string;
  name: string;
  category?: string;
  material?: string;
  tags?: string[];
}

// Fit Check types
export interface FitWarning {
  severity: 'minor' | 'moderate' | 'major';
  message: string;
}

export type FitScore = 'great' | 'moderate' | 'poor';

export interface FitCheckResult {
  success: boolean;
  product_id?: string;
  product_name?: string;
  warnings: FitWarning[];
  warning_count: number;
  fit_score: FitScore;
}

// History types
export interface FitHistoryEntry {
  id: string;
  url: string;
  productName: string;
  productImage?: string;
  fitScore: FitScore;
  warnings: FitWarning[];
  checkedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
