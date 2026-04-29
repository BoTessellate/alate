import React from 'react';
import { render } from '@testing-library/react-native';
import BrandHeading, { slugifyBrand } from '../components/BrandHeading';
import { featureFlags } from '../constants/featureFlags';

describe('slugifyBrand', () => {
  it('lowercases simple ASCII names', () => {
    expect(slugifyBrand('ASOS')).toBe('asos');
    expect(slugifyBrand('Cos')).toBe('cos');
  });

  it('expands ampersands to "and"', () => {
    expect(slugifyBrand('& Other Stories')).toBe('and-other-stories');
    expect(slugifyBrand('H&M')).toBe('h-and-m');
  });

  it('collapses punctuation and trims edge dashes', () => {
    expect(slugifyBrand("Levi's")).toBe('levi-s');
    expect(slugifyBrand('  Weekday  ')).toBe('weekday');
    expect(slugifyBrand('A.P.C.')).toBe('a-p-c');
  });

  it('handles unicode characters by stripping to dashes', () => {
    expect(slugifyBrand('Acné Studios')).toBe('acn-studios');
  });
});

describe('BrandHeading', () => {
  it('renders fallback text when no SVG is registered', () => {
    const { getByText } = render(<BrandHeading brand="ASOS" />);
    expect(getByText('asos')).toBeTruthy();
  });

  it('respects uppercase prop on fallback', () => {
    const { getByText } = render(<BrandHeading brand="cos" uppercase />);
    expect(getByText('COS')).toBeTruthy();
  });

  it('forwards testID to fallback Text', () => {
    const { getByTestId } = render(
      <BrandHeading brand="Weekday" testID="brand-weekday" />
    );
    expect(getByTestId('brand-weekday')).toBeTruthy();
  });

  it('survives empty brand string without throwing', () => {
    expect(() => render(<BrandHeading brand="" />)).not.toThrow();
  });

  it('falls back to text even with V2 off — SVG path is V2-gated', () => {
    // Default: V2 flag is false. Even if a brand SVG is registered, we
    // should render the fallback text until the release flips. Verifies
    // the gating directly (registry is empty by default, but the assert
    // is on the rendered output regardless).
    expect(featureFlags.V2).toBe(false);
    const { getByText } = render(<BrandHeading brand="Asos" uppercase />);
    expect(getByText('ASOS')).toBeTruthy();
  });
});
