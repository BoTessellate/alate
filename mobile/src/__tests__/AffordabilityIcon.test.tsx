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

  it('renders nothing when price has different currency', () => {
    const { toJSON } = render(
      <AffordabilityIcon price={{ amount: 50, currency: 'USD' }} range={range} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders $ for low-bucket prices', () => {
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 25, currency: 'GBP' }} range={range} />
    );
    expect(getByText('$')).toBeTruthy();
  });

  it('renders $$ for mid-bucket prices', () => {
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 60, currency: 'GBP' }} range={range} />
    );
    expect(getByText('$$')).toBeTruthy();
  });

  it('renders $$$ for high-bucket prices', () => {
    const { getByText } = render(
      <AffordabilityIcon price={{ amount: 95, currency: 'GBP' }} range={range} />
    );
    expect(getByText('$$$')).toBeTruthy();
  });

  it('flags over-budget prices with the warning testID suffix', () => {
    const { getByTestId } = render(
      <AffordabilityIcon price={{ amount: 250, currency: 'GBP' }} range={range} />
    );
    expect(getByTestId('affordability-3-over')).toBeTruthy();
  });
});
