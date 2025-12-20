/**
 * Layout Aesthetic Scoring
 * Public function for scoring canvas layouts during export/preview
 *
 * Uses GPT-4V for image-based analysis or Claude as fallback
 */

import {
  scoreAesthetics,
  AestheticScoreInput,
  AestheticScoreResult,
  createVisionScoreClient,
  createClaudeScoreClient,
} from './visionScoreClient';

export interface ScoreLayoutOptions {
  /** Force GPT-4V even if USE_GPT4V is false */
  forceGPT4V?: boolean;
  /** API key override (defaults to env vars) */
  apiKey?: string;
  /** Include improvement suggestions in result */
  includeSuggestions?: boolean;
  /** Layout metadata for Claude fallback (when GPT-4V unavailable) */
  layoutMetadata?: {
    canvasSize: { width: number; height: number };
    elementCount: number;
    elementTypes: string[];
    labelCount: number;
    imageCount: number;
    averageSpacing?: number;
  };
}

export interface ScoreLayoutResult {
  score: number;
  notes: string[];
  summary: string;
  suggestions?: string[];
  /** Whether the score is considered good (>= 7) */
  isGood: boolean;
  /** Suggested action based on score */
  action: 'approve' | 'remix' | 'review';
}

/**
 * Score a layout's aesthetic quality
 *
 * @param canvasImage - Base64 encoded PNG of the canvas
 * @param layoutIntent - Description of the intended layout style (e.g., "clean, modern, symmetric")
 * @param options - Optional configuration
 * @returns Score result with notes and recommended action
 *
 * @example
 * ```typescript
 * const result = await scoreLayout(base64Image, 'clean, minimalist moodboard');
 * if (result.action === 'remix') {
 *   console.log('Consider improvements:', result.suggestions);
 * }
 * ```
 */
export async function scoreLayout(
  canvasImage: string,
  layoutIntent: string,
  options?: ScoreLayoutOptions
): Promise<ScoreLayoutResult> {
  const input: AestheticScoreInput & {
    layoutMetadata?: ScoreLayoutOptions['layoutMetadata'];
  } = {
    canvasImage,
    layoutIntent,
    layoutMetadata: options?.layoutMetadata,
  };

  const result = await scoreAesthetics(input, {
    forceGPT4V: options?.forceGPT4V,
    apiKey: options?.apiKey,
  });

  // Determine action based on score
  let action: 'approve' | 'remix' | 'review';
  if (result.score >= 7) {
    action = 'approve';
  } else if (result.score >= 4) {
    action = 'review';
  } else {
    action = 'remix';
  }

  return {
    score: result.score,
    notes: result.notes,
    summary: result.summary,
    suggestions: options?.includeSuggestions !== false ? result.suggestions : undefined,
    isGood: result.score >= 7,
    action,
  };
}

/**
 * Quick score check - returns just the numeric score
 * Useful for conditional logic without full analysis
 *
 * @returns Score 0-10, defaults to 5 on error
 */
export async function getQuickScore(
  canvasImage: string,
  layoutIntent: string = 'professional moodboard'
): Promise<number> {
  try {
    const result = await scoreLayout(canvasImage, layoutIntent);
    return result.score;
  } catch (error: any) {
    console.error('[getQuickScore] Failed:', error.message);
    return 5; // Neutral default score on error
  }
}

/**
 * Check if a layout passes quality threshold
 *
 * @param canvasImage - Base64 encoded PNG
 * @param threshold - Minimum acceptable score (default: 6)
 * @returns True if layout meets or exceeds threshold, false on error
 */
export async function passesQualityCheck(
  canvasImage: string,
  threshold: number = 6
): Promise<boolean> {
  try {
    const score = await getQuickScore(canvasImage);
    return score >= threshold;
  } catch (error: any) {
    console.error('[passesQualityCheck] Failed:', error.message);
    return false; // Fail closed on error (don't approve unknown quality)
  }
}

// Re-export types for convenience
export type { AestheticScoreInput, AestheticScoreResult };
