import { usePriceRangeStore } from '../store/priceRangeStore';

describe('priceRangeStore', () => {
  beforeEach(() => {
    usePriceRangeStore.setState({ min: null, max: null, currency: 'GBP' });
  });

  it('initialises with no range set', () => {
    const s = usePriceRangeStore.getState();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.currency).toBe('GBP');
  });

  it('setRange stores both bounds + currency', () => {
    usePriceRangeStore.getState().setRange(20, 100, 'GBP');
    const s = usePriceRangeStore.getState();
    expect(s.min).toBe(20);
    expect(s.max).toBe(100);
    expect(s.currency).toBe('GBP');
  });

  it('setRange swaps min/max if the user enters them out of order', () => {
    usePriceRangeStore.getState().setRange(100, 20, 'GBP');
    const s = usePriceRangeStore.getState();
    expect(s.min).toBe(20);
    expect(s.max).toBe(100);
  });

  it('setRange clamps negatives to 0', () => {
    usePriceRangeStore.getState().setRange(-50, 100, 'GBP');
    expect(usePriceRangeStore.getState().min).toBe(0);
  });

  it('setRange ignores NaN inputs (no-op)', () => {
    usePriceRangeStore.getState().setRange(20, 100, 'GBP');
    usePriceRangeStore.getState().setRange(NaN, 200, 'GBP');
    const s = usePriceRangeStore.getState();
    expect(s.min).toBe(20);
    expect(s.max).toBe(100);
  });

  it('clearRange resets to null', () => {
    usePriceRangeStore.getState().setRange(20, 100, 'GBP');
    usePriceRangeStore.getState().clearRange();
    const s = usePriceRangeStore.getState();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
  });

  it('isConfigured reports true only when both bounds set', () => {
    expect(usePriceRangeStore.getState().isConfigured()).toBe(false);
    usePriceRangeStore.getState().setRange(20, 100, 'GBP');
    expect(usePriceRangeStore.getState().isConfigured()).toBe(true);
    usePriceRangeStore.getState().clearRange();
    expect(usePriceRangeStore.getState().isConfigured()).toBe(false);
  });
});
