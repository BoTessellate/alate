import React from 'react';
import { render } from '@testing-library/react-native';
import AffordabilityIcon from '../components/AffordabilityIcon';

const range = { min: 20, max: 100, currency: 'GBP' };

describe('AffordabilityIcon', () => {
  it('renders nothing when no range is configured', () => {
    const { toJSON } = render(
      <AffordabilityIcon price={{ amount: 50, currency: 'GBP' }} range={null} />
    );
    expect(toJSON()).toBeNull();
  });

  it('still renders when price currency differs from range (currencyMismatch)', () => {
    // May 4 2026 late-PM: relaxed the currency-strict check in
    // computeAffordability — surprised users when their indicator
    // vanished after switching range currency. Component now
    // renders a chip on mismatch (using the user's range currency
    // symbol), buckets the raw amount with `currencyMismatch: true`.
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 50, currency: 'USD' }} range={range} />
    );
    // Range is GBP → symbol £, scale 2 (50 in [20,100] middle third).
    expect(getByText('££')).toBeTruthy();
  });

  // The chip uses the user's price-range currency symbol (GBP → £)
  // since May 4 2026 — no longer hardcoded $. See AffordabilityIcon
  // for the symbol-resolution priority.
  it('renders £ for low-bucket prices (GBP range)', () => {
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 25, currency: 'GBP' }} range={range} />
    );
    expect(getByText('£')).toBeTruthy();
  });

  it('renders ££ for mid-bucket prices (GBP range)', () => {
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 60, currency: 'GBP' }} range={range} />
    );
    expect(getByText('££')).toBeTruthy();
  });

  it('renders £££ for high-bucket prices (GBP range)', () => {
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 95, currency: 'GBP' }} range={range} />
    );
    expect(getByText('£££')).toBeTruthy();
  });

  it('uses the INR symbol when the range currency is INR', () => {
    const inrRange = { min: 1000, max: 5000, currency: 'INR' };
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 1500, currency: 'INR' }} range={inrRange} />
    );
    expect(getByText('₹')).toBeTruthy();
  });

  it('respects an explicit symbol override', () => {
    // Caller can still force a specific symbol — useful for surfaces
    // where we want the universal $ regardless of range.
    const { getByText } = render(
      <AffordabilityIcon
        price={{ amount: 25, currency: 'GBP' }}
        range={range}
        symbol="$"
      />
    );
    expect(getByText('$')).toBeTruthy();
  });

  it('flags over-budget prices with the warning testID suffix', () => {
    const { getByTestId } = render(
      <AffordabilityIcon price={{ amount: 250, currency: 'GBP' }} range={range} />
    );
    expect(getByTestId('affordability-3-over')).toBeTruthy();
  });
});
