/**
 * Aesthetic Feedback Loop System
 *
 * Collects and learns from layout aesthetic scores to improve future compositions.
 * Tracks which layout parameters correlate with higher scores and suggests
 * adjustments for better aesthetic outcomes.
 *
 * Features:
 * - Score history tracking per archetype
 * - Parameter correlation analysis
 * - Automatic adjustment suggestions
 * - Learning thresholds for continuous improvement
 */

import { LayoutArchetypeName, LayoutElement, Size } from '../layoutGenerator/types';
import { AestheticScoreResult } from './visionScoreClient';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Layout parameters that affect aesthetics
 */
export interface LayoutParameters {
  archetype: LayoutArchetypeName;
  productCount: number;
  canvasSize: Size;
  averageSpacing: number;
  overlapRatio: number;
  maxRotation: number;
  whitespaceRatio: number;
  labelCount: number;
  sizeVariance: number; // How much sizes vary (0-1)
}

/**
 * Scored layout record for learning
 */
export interface ScoredLayout {
  id: string;
  timestamp: number;
  parameters: LayoutParameters;
  score: number;
  notes: string[];
  suggestions?: string[];
}

/**
 * Parameter adjustment recommendation
 */
export interface ParameterAdjustment {
  parameter: keyof LayoutParameters;
  currentValue: number;
  suggestedValue: number;
  confidence: number; // 0-1
  reason: string;
}

/**
 * Feedback analysis result
 */
export interface FeedbackAnalysis {
  averageScore: number;
  scoresByArchetype: Record<LayoutArchetypeName, number>;
  topIssues: string[];
  adjustments: ParameterAdjustment[];
  trend: 'improving' | 'stable' | 'declining';
}

// =============================================================================
// AESTHETIC FEEDBACK MANAGER
// =============================================================================

export class AestheticFeedbackManager {
  private history: ScoredLayout[] = [];
  private maxHistorySize: number;
  private learningThreshold: number;

  constructor(options: { maxHistorySize?: number; learningThreshold?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize || 100;
    this.learningThreshold = options.learningThreshold || 7; // Score above which is "good"
  }

  /**
   * Record a scored layout for learning
   */
  recordScore(
    parameters: LayoutParameters,
    scoreResult: AestheticScoreResult
  ): void {
    const record: ScoredLayout = {
      id: `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      parameters,
      score: scoreResult.score,
      notes: scoreResult.notes,
      suggestions: scoreResult.suggestions,
    };

    this.history.push(record);

    // Maintain max history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Analyze feedback history and get improvement recommendations
   */
  analyzeFeedback(): FeedbackAnalysis {
    if (this.history.length === 0) {
      return this.getDefaultAnalysis();
    }

    const scores = this.history.map(h => h.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Scores by archetype
    const scoresByArchetype = this.calculateScoresByArchetype();

    // Find common issues from notes
    const topIssues = this.findCommonIssues();

    // Calculate parameter adjustments
    const adjustments = this.calculateAdjustments();

    // Determine trend
    const trend = this.calculateTrend();

    return {
      averageScore,
      scoresByArchetype,
      topIssues,
      adjustments,
      trend,
    };
  }

  /**
   * Get suggested parameters for a new layout
   */
  getSuggestedParameters(
    archetype: LayoutArchetypeName,
    productCount: number
  ): Partial<LayoutParameters> {
    const archetypeHistory = this.history.filter(
      h => h.parameters.archetype === archetype
    );

    if (archetypeHistory.length < 3) {
      // Not enough data, return defaults
      return this.getDefaultParameters(archetype);
    }

    // Find high-scoring layouts for this archetype
    const goodLayouts = archetypeHistory.filter(h => h.score >= this.learningThreshold);

    if (goodLayouts.length === 0) {
      return this.getDefaultParameters(archetype);
    }

    // Average the parameters of good layouts
    return {
      averageSpacing: this.average(goodLayouts.map(l => l.parameters.averageSpacing)),
      overlapRatio: this.average(goodLayouts.map(l => l.parameters.overlapRatio)),
      maxRotation: this.average(goodLayouts.map(l => l.parameters.maxRotation)),
      whitespaceRatio: this.average(goodLayouts.map(l => l.parameters.whitespaceRatio)),
      sizeVariance: this.average(goodLayouts.map(l => l.parameters.sizeVariance)),
    };
  }

  /**
   * Check if a layout's parameters are likely to score well
   */
  predictScore(parameters: LayoutParameters): { predicted: number; confidence: number } {
    const similar = this.findSimilarLayouts(parameters);

    if (similar.length === 0) {
      return { predicted: 5, confidence: 0.2 };
    }

    const predictedScore = this.average(similar.map(s => s.score));
    const confidence = Math.min(1, similar.length / 10); // More similar layouts = higher confidence

    return { predicted: predictedScore, confidence };
  }

  /**
   * Get optimization suggestions for improving a low score
   */
  getOptimizationSuggestions(
    parameters: LayoutParameters,
    currentScore: number
  ): string[] {
    const suggestions: string[] = [];

    // Compare to high-scoring layouts of same archetype
    const goodLayouts = this.history.filter(
      h => h.parameters.archetype === parameters.archetype && h.score >= this.learningThreshold
    );

    if (goodLayouts.length === 0) {
      return ['Not enough historical data for optimization suggestions'];
    }

    const avgGoodSpacing = this.average(goodLayouts.map(l => l.parameters.averageSpacing));
    const avgGoodWhitespace = this.average(goodLayouts.map(l => l.parameters.whitespaceRatio));
    const avgGoodRotation = this.average(goodLayouts.map(l => l.parameters.maxRotation));

    // Spacing suggestion
    if (Math.abs(parameters.averageSpacing - avgGoodSpacing) > 20) {
      if (parameters.averageSpacing < avgGoodSpacing) {
        suggestions.push(`Increase spacing from ${Math.round(parameters.averageSpacing)}px to ~${Math.round(avgGoodSpacing)}px`);
      } else {
        suggestions.push(`Reduce spacing from ${Math.round(parameters.averageSpacing)}px to ~${Math.round(avgGoodSpacing)}px`);
      }
    }

    // Whitespace suggestion
    if (Math.abs(parameters.whitespaceRatio - avgGoodWhitespace) > 0.1) {
      const currentPct = Math.round(parameters.whitespaceRatio * 100);
      const targetPct = Math.round(avgGoodWhitespace * 100);
      suggestions.push(`Adjust whitespace from ${currentPct}% to ~${targetPct}%`);
    }

    // Rotation suggestion
    if (parameters.maxRotation > avgGoodRotation + 5) {
      suggestions.push(`Reduce rotation from ${parameters.maxRotation}° to ~${Math.round(avgGoodRotation)}°`);
    }

    // General suggestions based on common issues
    const commonIssues = this.findCommonIssues();
    if (commonIssues.includes('crowded') && parameters.productCount > 6) {
      suggestions.push('Consider using fewer products or a larger canvas');
    }
    if (commonIssues.includes('imbalance')) {
      suggestions.push('Try a more symmetrical element distribution');
    }

    return suggestions.length > 0 ? suggestions : ['Layout parameters appear optimal'];
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private calculateScoresByArchetype(): Record<LayoutArchetypeName, number> {
    const archetypes: LayoutArchetypeName[] = ['Minimal', 'Hero', 'Dynamic', 'Collage'];
    const result: Record<LayoutArchetypeName, number> = {
      Minimal: 0,
      Hero: 0,
      Dynamic: 0,
      Collage: 0,
    };

    for (const archetype of archetypes) {
      const layouts = this.history.filter(h => h.parameters.archetype === archetype);
      if (layouts.length > 0) {
        result[archetype] = this.average(layouts.map(l => l.score));
      }
    }

    return result;
  }

  private findCommonIssues(): string[] {
    const issueCounts: Record<string, number> = {};

    // Extract keywords from notes in low-scoring layouts
    const lowScoring = this.history.filter(h => h.score < this.learningThreshold);

    for (const layout of lowScoring) {
      for (const note of layout.notes) {
        const lower = note.toLowerCase();
        // Count common issue keywords
        const keywords = ['crowded', 'spacing', 'overlap', 'balance', 'imbalance', 'label', 'rotation'];
        for (const keyword of keywords) {
          if (lower.includes(keyword)) {
            issueCounts[keyword] = (issueCounts[keyword] || 0) + 1;
          }
        }
      }
    }

    // Sort by frequency and return top 3
    return Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([issue]) => issue);
  }

  private calculateAdjustments(): ParameterAdjustment[] {
    const adjustments: ParameterAdjustment[] = [];

    // Compare good vs bad layouts to find differentiators
    const good = this.history.filter(h => h.score >= this.learningThreshold);
    const bad = this.history.filter(h => h.score < this.learningThreshold - 2);

    if (good.length === 0 || bad.length === 0) {
      return adjustments;
    }

    const avgGoodSpacing = this.average(good.map(l => l.parameters.averageSpacing));
    const avgBadSpacing = this.average(bad.map(l => l.parameters.averageSpacing));

    if (Math.abs(avgGoodSpacing - avgBadSpacing) > 15) {
      adjustments.push({
        parameter: 'averageSpacing',
        currentValue: avgBadSpacing,
        suggestedValue: avgGoodSpacing,
        confidence: 0.7,
        reason: 'High-scoring layouts use different spacing',
      });
    }

    const avgGoodWhitespace = this.average(good.map(l => l.parameters.whitespaceRatio));
    const avgBadWhitespace = this.average(bad.map(l => l.parameters.whitespaceRatio));

    if (Math.abs(avgGoodWhitespace - avgBadWhitespace) > 0.1) {
      adjustments.push({
        parameter: 'whitespaceRatio',
        currentValue: avgBadWhitespace,
        suggestedValue: avgGoodWhitespace,
        confidence: 0.65,
        reason: 'Whitespace ratio correlates with better scores',
      });
    }

    return adjustments;
  }

  private calculateTrend(): 'improving' | 'stable' | 'declining' {
    if (this.history.length < 10) return 'stable';

    const recentHalf = this.history.slice(-Math.floor(this.history.length / 2));
    const olderHalf = this.history.slice(0, Math.floor(this.history.length / 2));

    const recentAvg = this.average(recentHalf.map(h => h.score));
    const olderAvg = this.average(olderHalf.map(h => h.score));

    if (recentAvg > olderAvg + 0.5) return 'improving';
    if (recentAvg < olderAvg - 0.5) return 'declining';
    return 'stable';
  }

  private findSimilarLayouts(parameters: LayoutParameters): ScoredLayout[] {
    return this.history.filter(h => {
      const p = h.parameters;
      return (
        p.archetype === parameters.archetype &&
        Math.abs(p.productCount - parameters.productCount) <= 2 &&
        Math.abs(p.whitespaceRatio - parameters.whitespaceRatio) < 0.15
      );
    });
  }

  private getDefaultParameters(archetype: LayoutArchetypeName): Partial<LayoutParameters> {
    const defaults: Record<LayoutArchetypeName, Partial<LayoutParameters>> = {
      Minimal: { averageSpacing: 80, overlapRatio: 0, maxRotation: 0, whitespaceRatio: 0.5, sizeVariance: 0.1 },
      Hero: { averageSpacing: 40, overlapRatio: 0.15, maxRotation: 5, whitespaceRatio: 0.3, sizeVariance: 0.3 },
      Dynamic: { averageSpacing: 30, overlapRatio: 0.2, maxRotation: 10, whitespaceRatio: 0.25, sizeVariance: 0.25 },
      Collage: { averageSpacing: 20, overlapRatio: 0.3, maxRotation: 12, whitespaceRatio: 0.15, sizeVariance: 0.35 },
    };
    return defaults[archetype];
  }

  private getDefaultAnalysis(): FeedbackAnalysis {
    return {
      averageScore: 0,
      scoresByArchetype: { Minimal: 0, Hero: 0, Dynamic: 0, Collage: 0 },
      topIssues: [],
      adjustments: [],
      trend: 'stable',
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // =============================================================================
  // SERIALIZATION
  // =============================================================================

  /**
   * Export history for persistence
   */
  exportHistory(): ScoredLayout[] {
    return [...this.history];
  }

  /**
   * Import history from persistence
   */
  importHistory(history: ScoredLayout[]): void {
    this.history = history.slice(-this.maxHistorySize);
  }

  /**
   * Get history stats
   */
  getStats(): { totalLayouts: number; averageScore: number; bestScore: number } {
    if (this.history.length === 0) {
      return { totalLayouts: 0, averageScore: 0, bestScore: 0 };
    }

    const scores = this.history.map(h => h.score);
    return {
      totalLayouts: this.history.length,
      averageScore: this.average(scores),
      bestScore: Math.max(...scores),
    };
  }
}

// =============================================================================
// FACTORY & HELPERS
// =============================================================================

/**
 * Create an aesthetic feedback manager
 */
export function createAestheticFeedbackManager(
  options?: { maxHistorySize?: number; learningThreshold?: number }
): AestheticFeedbackManager {
  return new AestheticFeedbackManager(options);
}

/**
 * Extract layout parameters from elements
 */
export function extractLayoutParameters(
  elements: LayoutElement[],
  archetype: LayoutArchetypeName,
  canvasSize: Size
): LayoutParameters {
  const imageElements = elements.filter(e => e.type === 'image');
  const labelElements = elements.filter(e => e.type === 'label' || e.type === 'text');

  // Calculate average spacing between elements
  let totalSpacing = 0;
  let spacingCount = 0;
  for (let i = 0; i < imageElements.length; i++) {
    for (let j = i + 1; j < imageElements.length; j++) {
      const el1 = imageElements[i];
      const el2 = imageElements[j];
      const dx = el1.position.x - el2.position.x;
      const dy = el1.position.y - el2.position.y;
      totalSpacing += Math.sqrt(dx * dx + dy * dy);
      spacingCount++;
    }
  }

  // Calculate overlap ratio
  let overlapCount = 0;
  for (let i = 0; i < imageElements.length; i++) {
    for (let j = i + 1; j < imageElements.length; j++) {
      const el1 = imageElements[i];
      const el2 = imageElements[j];
      if (el1.size && el2.size) {
        const overlaps =
          el1.position.x < el2.position.x + el2.size.width &&
          el1.position.x + el1.size.width > el2.position.x &&
          el1.position.y < el2.position.y + el2.size.height &&
          el1.position.y + el1.size.height > el2.position.y;
        if (overlaps) overlapCount++;
      }
    }
  }

  // Calculate whitespace ratio
  let coveredArea = 0;
  for (const el of imageElements) {
    if (el.size) {
      coveredArea += el.size.width * el.size.height;
    }
  }
  const canvasArea = canvasSize.width * canvasSize.height;
  const whitespaceRatio = 1 - Math.min(1, coveredArea / canvasArea);

  // Calculate max rotation
  const maxRotation = Math.max(...imageElements.map(e => Math.abs(e.rotation || 0)), 0);

  // Calculate size variance
  const sizes = imageElements.map(e => e.size?.width || 0).filter(s => s > 0);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length || 1;
  const sizeVariance = sizes.length > 1
    ? Math.sqrt(sizes.reduce((sum, s) => sum + Math.pow(s - avgSize, 2), 0) / sizes.length) / avgSize
    : 0;

  return {
    archetype,
    productCount: imageElements.length,
    canvasSize,
    averageSpacing: spacingCount > 0 ? totalSpacing / spacingCount : 100,
    overlapRatio: imageElements.length > 1 ? overlapCount / ((imageElements.length * (imageElements.length - 1)) / 2) : 0,
    maxRotation,
    whitespaceRatio,
    labelCount: labelElements.length,
    sizeVariance,
  };
}
