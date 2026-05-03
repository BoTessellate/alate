/**
 * Affordability scale — given a product price and the user's configured
 * range, return a 1..3 bucket plus an `overBudget` flag.
 *
 * Bucketing is done over thirds of [min, max]:
 *   1 ($)   — price ≤ min + (max-min)/3
 *   2 ($$)  — middle third
 *   3 ($$$) — price ≥ min + 2*(max-min)/3
 *
 * Prices below `min` clamp to 1 (no overBudget). Prices above `max` clamp
 * to 3 with `overBudget: true` so the UI can flag "above your range".
 *
 * Returns `null` (i.e. don't render the icon) when:
 *   - the user hasn't set a range
 *   - the product has no price
 *   - the price currency mismatches the range currency
 *   - the range has only one bound set (partial config)
 */

export type AffordabilityScale = 1 | 2 | 3;

export interface PriceRangeShape {
  min: number | null;
  max: number | null;
  currency: string;
}

export interface PriceShape {
  amount: number;
  currency: string;
}

export interface AffordabilityResult {
  scale: AffordabilityScale;
  overBudget: boolean;
}

export function computeAffordability(
  price: PriceShape | undefined | null,
  range: PriceRangeShape | null
): AffordabilityResult | null {
  if (!range) return null;
  if (range.min === null || range.max === null) return null;
  if (!price) return null;
  if (typeof price.amount !== 'number' || !Number.isFinite(price.amount)) return null;
  if (price.currency !== range.currency) return null;

  const { min, max } = range;
  const amount = price.amount;

  // Above-budget: clamp to 3, flag.
  if (amount > max) {
    return { scale: 3, overBudget: true };
  }

  // Below-min: clamp to 1, do NOT flag overBudget.
  if (amount < min) {
    return { scale: 1, overBudget: false };
  }

  // Zero-width range — pin to middle for any price exactly at min===max.
  if (min === max) {
    return { scale: 2, overBudget: false };
  }

  const span = max - min;
  const third = span / 3;
  const lowerCut = min + third;
  const upperCut = min + 2 * third;

  let scale: AffordabilityScale = 2;
  if (amount < lowerCut) scale = 1;
  else if (amount >= upperCut) scale = 3;

  return { scale, overBudget: false };
}
