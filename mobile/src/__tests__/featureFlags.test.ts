import { featureFlags, isEnabled } from '../constants/featureFlags';

describe('featureFlags', () => {
  it('V2 (umbrella release flag) defaults to off', () => {
    expect(featureFlags.V2).toBe(false);
    expect(isEnabled('V2')).toBe(false);
  });
});
