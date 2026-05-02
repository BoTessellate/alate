/**
 * Effective fit score — derived from the actual warnings list, NOT
 * just the backend `fitScore` label.
 *
 * The backend marks any non-empty warning list as 'moderate'. That
 * meant a single MINOR concern (e.g. "minor: A-line styles add volume
 * at the hip") rendered with the full ⚠ "Concerns" treatment. Per
 * user direction April 29 2026: "showing a warning on 1 minor concern
 * feels excessive". We re-tier into four levels so the verdict matches
 * the actual severity:
 *
 *   - great:    no warnings
 *   - minor:    only minor warnings present (still a positive verdict)
 *   - moderate: at least one moderate warning
 *   - poor:     at least one major warning
 *
 * Originally lived inline in FitResultScreen, but the same re-tiering
 * also needs to apply to FitDetailBar (history cover-flow detail
 * pill) and HomeScreen's RecentCard so a "Great Fit, with a note"
 * doesn't render as "Concerns" / "⚠ Check" in those views. Single
 * source of truth.
 */

import type { FitWarning } from '../services/api';

export type EffectiveFitScore = 'great' | 'minor' | 'moderate' | 'poor';

export function computeEffectiveFitScore(
  warnings: FitWarning[] | undefined,
  backendFitScore: 'great' | 'moderate' | 'poor'
): EffectiveFitScore {
  const list = warnings ?? [];
  if (list.some((w) => w.severity === 'major')) return 'poor';
  if (list.some((w) => w.severity === 'moderate')) return 'moderate';
  if (list.length > 0) return 'minor';
  // No warnings — trust the backend's call. It can still be 'moderate'
  // or 'poor' from rule-based logic that didn't produce a textual
  // warning (rare but possible). Pass-through.
  return backendFitScore === 'great' ? 'great' : backendFitScore;
}
