/**
 * FitLoader copy regression test.
 *
 * The default subtitle used to read "matching bust, waist and hip
 * against your profile" — gendered copy that assumes a woman's
 * measurement landmarks. The fit engine itself is gender-neutral
 * and the loader has no business outing a body model. This test
 * pins the gender-neutral copy in place so we don't regress.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

// jest.setup.js mocks react-native-reanimated but doesn't expose
// `withRepeat` / `Easing`, which the FitLoader spinner uses. Extend
// the mock just for this file.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Animated = { View, createAnimatedComponent: (c: any) => c, call: () => {} };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial: any) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: (cb: any) => ({ value: cb ? cb() : undefined }),
    withSpring: (v: any) => v,
    withTiming: (v: any, _c: any, cb?: any) => {
      if (cb) cb(true);
      return v;
    },
    withRepeat: (v: any) => v,
    withDelay: (_d: any, v: any) => v,
    withSequence: (...args: any[]) => args[args.length - 1],
    runOnJS: (fn: any) => fn,
    runOnUI: (fn: any) => fn,
    interpolate: (v: any) => v,
    Easing: {
      linear: (t: number) => t,
      out: () => (t: number) => t,
      in: () => (t: number) => t,
      cubic: (t: number) => t,
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend' },
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend' },
  };
});

import FitLoader from '../components/FitLoader';

describe('FitLoader', () => {
  it('uses gender-neutral default copy (no "bust" / "hip" / "waist")', () => {
    const { getByText, queryByText } = render(<FitLoader />);
    // The new copy talks about the user's measurements and the size
    // chart without enumerating gendered body landmarks.
    expect(
      getByText(/matching your measurements against the size chart/i)
    ).toBeTruthy();
    expect(queryByText(/\bbust\b/i)).toBeNull();
    expect(queryByText(/\bhip\b/i)).toBeNull();
  });

  it('renders the headline title', () => {
    const { getByText } = render(<FitLoader />);
    expect(getByText(/reading the size chart/i)).toBeTruthy();
  });

  it('shows the alate wordmark inside the loading circle', () => {
    const { getByTestId } = render(<FitLoader />);
    expect(getByTestId('fit-loader-logo')).toBeTruthy();
  });
});
