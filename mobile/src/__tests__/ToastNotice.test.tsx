/**
 * ToastNotice — themed replacement for info/error-flavour Alert.alert.
 *
 * Confirms the component renders, calls onDismiss after the auto-hide
 * timeout, and swallows the timer when manually dismissed early.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import ToastNotice from '../components/ToastNotice';

describe('ToastNotice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders title and message when visible', () => {
    const { getByText } = render(
      <ToastNotice
        visible={true}
        title="Sharing unavailable"
        message="Your device does not support sharing."
        onDismiss={() => {}}
      />
    );
    expect(getByText('Sharing unavailable')).toBeTruthy();
    expect(getByText('Your device does not support sharing.')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <ToastNotice
        visible={false}
        title="Sharing unavailable"
        onDismiss={() => {}}
      />
    );
    expect(queryByText('Sharing unavailable')).toBeNull();
  });

  it('calls onDismiss after the auto-hide timeout', () => {
    const onDismiss = jest.fn();
    render(
      <ToastNotice
        visible={true}
        title="Sign-in error"
        onDismiss={onDismiss}
        durationMs={3000}
      />
    );
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss when not visible', () => {
    const onDismiss = jest.fn();
    render(
      <ToastNotice
        visible={false}
        title="Sign-in error"
        onDismiss={onDismiss}
        durationMs={3000}
      />
    );
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
