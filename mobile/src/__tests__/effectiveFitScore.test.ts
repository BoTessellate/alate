import { computeEffectiveFitScore } from '../utils/effectiveFitScore';

describe('computeEffectiveFitScore', () => {
  it('returns great when no warnings AND backend says great', () => {
    expect(computeEffectiveFitScore([], 'great')).toBe('great');
    expect(computeEffectiveFitScore(undefined, 'great')).toBe('great');
  });

  it('returns minor when only minor warnings are present', () => {
    expect(
      computeEffectiveFitScore(
        [{ severity: 'minor', message: 'A-line adds volume at the hip' }],
        'moderate'
      )
    ).toBe('minor');
  });

  it('returns moderate when at least one moderate warning is present', () => {
    expect(
      computeEffectiveFitScore(
        [
          { severity: 'minor', message: 'Tag 1' },
          { severity: 'moderate', message: 'Cropped runs short' },
        ],
        'moderate'
      )
    ).toBe('moderate');
  });

  it('returns poor when at least one major warning is present', () => {
    expect(
      computeEffectiveFitScore(
        [
          { severity: 'minor', message: 'Tag 1' },
          { severity: 'moderate', message: 'Tag 2' },
          { severity: 'major', message: 'Bodycon non-stretch tight at hips' },
        ],
        'poor'
      )
    ).toBe('poor');
  });

  it('respects backend fitScore when no warnings (rule-based no-text path)', () => {
    expect(computeEffectiveFitScore([], 'moderate')).toBe('moderate');
    expect(computeEffectiveFitScore([], 'poor')).toBe('poor');
  });
});
