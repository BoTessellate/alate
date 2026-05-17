/**
 * SizeChartSheet — bottom-sheet renderer for brand-pushed size charts
 * pulled from Mood Layer via the composed-product endpoint.
 *
 * The chart can carry body measurements ("fits person with bust 86cm"),
 * garment measurements ("garment chest 92cm flat"), or both. The sheet
 * must render whatever combination is present and offer a cm/in toggle
 * that reformats numbers without re-fetching.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

import SizeChartSheet, { SizeChartForSheet } from '../components/SizeChartSheet';

const bodyOnlyChart: SizeChartForSheet = {
  id: '1',
  name: 'Tops — Women',
  unit: 'cm',
  notes: 'We run small. Size up if between sizes.',
  rows: [
    { label: 'S', body_measurements: { bust: 84, waist: 66, hips: 90 } },
    { label: 'M', body_measurements: { bust: 88, waist: 70, hips: 94 } },
  ],
};

const garmentOnlyChart: SizeChartForSheet = {
  id: '2',
  name: 'Selvedge Denim',
  unit: 'cm',
  rows: [
    { label: '30', garment_measurements: { waist_flat: 38, inseam: 81, rise: 27 } },
    { label: '32', garment_measurements: { waist_flat: 40, inseam: 83, rise: 27 } },
  ],
};

const bothChart: SizeChartForSheet = {
  id: '3',
  name: 'Linen Shirt',
  unit: 'cm',
  rows: [
    {
      label: 'M',
      body_measurements: { chest: 96, waist: 80 },
      garment_measurements: { chest_flat: 56, length: 70 },
    },
  ],
};

describe('SizeChartSheet', () => {
  describe('visibility', () => {
    it('renders nothing when not visible', () => {
      const { queryByText } = render(
        <SizeChartSheet visible={false} chart={bodyOnlyChart} onClose={() => {}} />
      );
      expect(queryByText('Tops — Women')).toBeNull();
    });

    it('shows the chart name when visible', () => {
      const { getByText } = render(
        <SizeChartSheet visible chart={bodyOnlyChart} onClose={() => {}} />
      );
      expect(getByText('Tops — Women')).toBeTruthy();
    });

    it('calls onClose when the close affordance is pressed', () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <SizeChartSheet visible chart={bodyOnlyChart} onClose={onClose} />
      );
      fireEvent.press(getByTestId('size-chart-sheet-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('rendering', () => {
    it('renders body-only rows with body axes as columns', () => {
      const { getByText } = render(
        <SizeChartSheet visible chart={bodyOnlyChart} onClose={() => {}} />
      );
      // Size labels
      expect(getByText('S')).toBeTruthy();
      expect(getByText('M')).toBeTruthy();
      // Body values present
      expect(getByText('84')).toBeTruthy();
      expect(getByText('88')).toBeTruthy();
      // Body header axis labels (rendered)
      expect(getByText(/bust/i)).toBeTruthy();
      expect(getByText(/waist/i)).toBeTruthy();
      expect(getByText(/hips/i)).toBeTruthy();
    });

    it('renders garment-only rows with the garment-flat label', () => {
      const { getByText, queryByText } = render(
        <SizeChartSheet visible chart={garmentOnlyChart} onClose={() => {}} />
      );
      expect(getByText('30')).toBeTruthy();
      expect(getByText('38')).toBeTruthy();
      expect(getByText(/garment/i)).toBeTruthy();
      // body-section header should NOT appear
      expect(queryByText(/body measurements/i)).toBeNull();
    });

    it('renders body + garment side by side when both are present', () => {
      const { getByText } = render(
        <SizeChartSheet visible chart={bothChart} onClose={() => {}} />
      );
      expect(getByText(/body measurements/i)).toBeTruthy();
      expect(getByText(/garment measurements/i)).toBeTruthy();
      // values from both halves
      expect(getByText('96')).toBeTruthy(); // body chest
      expect(getByText('56')).toBeTruthy(); // garment chest flat
    });

    it('shows brand notes when present', () => {
      const { getByText } = render(
        <SizeChartSheet visible chart={bodyOnlyChart} onClose={() => {}} />
      );
      expect(getByText(/we run small/i)).toBeTruthy();
    });
  });

  describe('cm/in toggle', () => {
    it('starts in the chart\'s native unit and toggles to the other', () => {
      const { getByTestId, getByText, queryByText } = render(
        <SizeChartSheet visible chart={bodyOnlyChart} onClose={() => {}} />
      );
      // Native unit cm — values rendered as integers
      expect(getByText('84')).toBeTruthy();

      fireEvent.press(getByTestId('size-chart-unit-toggle'));

      // 84 cm = 33.07 in → rounded to 33.1
      expect(getByText('33.1')).toBeTruthy();
      // Original cm value should no longer appear
      expect(queryByText('84')).toBeNull();
    });
  });
});
