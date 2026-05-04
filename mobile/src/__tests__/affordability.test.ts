import { computeAffordability } from '../utils/affordability';

describe('computeAffordability', () => {
  const range = { min: 20, max: 100, currency: 'GBP' };

  it('returns null when no range is configured', () => {
    expect(computeAffordability({ amount: 50, currency: 'GBP' }, null)).toBeNull();
  });

  it('returns null when price is missing', () => {
    expect(computeAffordability(undefined, range)).toBeNull();
    expect(computeAffordability(null as any, range)).toBeNull();
  });

  it('returns a result with currencyMismatch=true when currencies differ', () => {
    // May 4 2026 late-PM behaviour change: was returning null on
    // currency mismatch, which surprised users when they switched
    // their range currency in settings ("changing currency in
    // settings completely removed the affordability circle from
    // product fit screen"). Now we still bucket the raw amount
    // (no FX conversion) and flag `currencyMismatch: true` so the
    // UI can render a softer treatment if it wants.
    const result = computeAffordability({ amount: 50, currency: 'USD' }, range);
    expect(result).not.toBeNull();
    expect(result?.currencyMismatch).toBe(true);
    // 50 sits in the middle third of [20, 100] → scale 2.
    expect(result?.scale).toBe(2);
  });

  it('flags currencyMismatch=false when currencies match', () => {
    const result = computeAffordability({ amount: 50, currency: 'GBP' }, range);
    expect(result?.currencyMismatch).toBe(false);
  });

  it('returns 1 ($) for prices at or below min', () => {
    expect(computeAffordability({ amount: 10, currency: 'GBP' }, range)?.scale).toBe(1);
    expect(computeAffordability({ amount: 20, currency: 'GBP' }, range)?.scale).toBe(1);
    expect(computeAffordability({ amount: 45, currency: 'GBP' }, range)?.scale).toBe(1);
  });

  it('returns 2 ($$) for prices in the middle third of the range', () => {
    // Range 20-100 → thirds at ~46.67 and ~73.33
    expect(computeAffordability({ amount: 50, currency: 'GBP' }, range)?.scale).toBe(2);
    expect(computeAffordability({ amount: 60, currency: 'GBP' }, range)?.scale).toBe(2);
    expect(computeAffordability({ amount: 73, currency: 'GBP' }, range)?.scale).toBe(2);
  });

  it('returns 3 ($$$) for prices at or above the upper third', () => {
    expect(computeAffordability({ amount: 75, currency: 'GBP' }, range)?.scale).toBe(3);
    expect(computeAffordability({ amount: 100, currency: 'GBP' }, range)?.scale).toBe(3);
  });

  it('clamps prices ABOVE max to 3 ($$$) and flags overBudget', () => {
    const result = computeAffordability({ amount: 250, currency: 'GBP' }, range);
    expect(result?.scale).toBe(3);
    expect(result?.overBudget).toBe(true);
  });

  it('clamps prices below min to 1 ($) and does NOT flag overBudget', () => {
    const result = computeAffordability({ amount: 5, currency: 'GBP' }, range);
    expect(result?.scale).toBe(1);
    expect(result?.overBudget).toBe(false);
  });

  it('handles zero-width ranges (min === max) without dividing by zero', () => {
    const tightRange = { min: 50, max: 50, currency: 'GBP' };
    expect(computeAffordability({ amount: 50, currency: 'GBP' }, tightRange)?.scale).toBe(2);
    expect(computeAffordability({ amount: 100, currency: 'GBP' }, tightRange)?.overBudget).toBe(true);
  });

  it('returns null when range bounds are partially unset', () => {
    expect(
      computeAffordability({ amount: 50, currency: 'GBP' }, { min: 20, max: null, currency: 'GBP' })
    ).toBeNull();
    expect(
      computeAffordability({ amount: 50, currency: 'GBP' }, { min: null, max: 100, currency: 'GBP' })
    ).toBeNull();
  });
});
