/**
 * FitResultErrorCard
 *
 * Pins the user-facing behaviour:
 *   1. Unsupported brand → POSTs to /api/brand-request on mount
 *   2. Social-proof copy gates at >= 20 (below that, generic line)
 *   3. Blocked origin → no POST (defeats the opt-out), shows opted-out copy
 *   4. Network/unknown error → no POST, shows generic copy
 *   5. Notify-me input collapsed by default; expands on tap; submits with email
 *   6. Visit store directly is the primary CTA (confirmed 2026-05-02)
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Linking } from 'react-native';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: ({ children, ...p }: any) => React.createElement(View, p, children) };
});

jest.mock('../services/api', () => ({
  extractBrandFromUrl: jest.requireActual('../services/api').extractBrandFromUrl,
  logBrandRequest: jest.fn(),
  getBrandRequestCount: jest.fn(),
}));

import * as api from '../services/api';
import FitResultErrorCard from '../components/FitResultErrorCard';

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.logBrandRequest.mockResolvedValue({ success: true, brandHandle: 'cosstores.com', count: 0 });
  mockApi.getBrandRequestCount.mockResolvedValue(0);
});

const URL = 'https://cosstores.com/p/dress-1';

describe('FitResultErrorCard — unsupported brand', () => {
  it('POSTs to /api/brand-request on mount with sourceUrl + brandDisplay', async () => {
    render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'Unable to fetch product' }}
        onGoBack={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockApi.logBrandRequest).toHaveBeenCalledWith({
        sourceUrl: URL,
        brandDisplay: 'Cosstores',
      });
    });
  });

  it('shows brand-aware headline', () => {
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    expect(getByTestId('fit-result-error-headline').props.children).toContain('Cosstores');
  });

  it('falls back to generic headline when brand cannot be extracted', () => {
    const { getByTestId } = render(
      <FitResultErrorCard
        url=""
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    expect(getByTestId('fit-result-error-headline').props.children).toBe(
      "We couldn't read this product"
    );
  });

  it('hides the "N others" line when count < 20', async () => {
    mockApi.logBrandRequest.mockResolvedValue({ success: true, brandHandle: 'cosstores.com', count: 7 });
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    await waitFor(() => expect(mockApi.logBrandRequest).toHaveBeenCalled());
    const body = getByTestId('fit-result-error-body').props.children;
    expect(body).not.toContain('7');
    expect(body).toContain('tracking demand');
  });

  it('shows the "N others" line when count >= 20', async () => {
    mockApi.logBrandRequest.mockResolvedValue({ success: true, brandHandle: 'cosstores.com', count: 23 });
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    await waitFor(() => {
      expect(getByTestId('fit-result-error-body').props.children).toContain('23');
    });
  });
});

describe('FitResultErrorCard — blocked origin', () => {
  it('does NOT call logBrandRequest (defeats the opt-out)', async () => {
    render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'blocked', origin: 'cosstores.com', message: 'opted out' }}
        onGoBack={jest.fn()}
      />
    );
    // give the effect a microtask to settle
    await act(async () => {});
    expect(mockApi.logBrandRequest).not.toHaveBeenCalled();
  });

  it('shows the opted-out headline using the blocked origin', () => {
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'blocked', origin: 'cosstores.com', message: 'opted out' }}
        onGoBack={jest.fn()}
      />
    );
    expect(getByTestId('fit-result-error-headline').props.children).toContain('cosstores.com');
    expect(getByTestId('fit-result-error-headline').props.children).toContain('opted out');
  });
});

describe('FitResultErrorCard — unknown / network error', () => {
  it('does NOT call logBrandRequest', async () => {
    render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unknown', message: 'Something went wrong' }}
        onGoBack={jest.fn()}
      />
    );
    await act(async () => {});
    expect(mockApi.logBrandRequest).not.toHaveBeenCalled();
  });
});

describe('FitResultErrorCard — CTAs', () => {
  it('opens the URL when Visit store directly is tapped', async () => {
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('fit-result-error-open-store'));
    expect(openSpy).toHaveBeenCalledWith(URL);
    openSpy.mockRestore();
  });

  it('calls onGoBack when Back is tapped', () => {
    const back = jest.fn();
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={back}
      />
    );
    fireEvent.press(getByTestId('fit-result-error-go-back'));
    expect(back).toHaveBeenCalled();
  });
});

describe('FitResultErrorCard — notify-me flow', () => {
  it('expands the email input when notify-me CTA is tapped', () => {
    const { getByTestId, queryByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    expect(queryByTestId('fit-result-error-notify-input')).toBeNull();
    fireEvent.press(getByTestId('fit-result-error-notify-toggle'));
    expect(getByTestId('fit-result-error-notify-input')).toBeTruthy();
  });

  it('submits the email via logBrandRequest and shows confirmation', async () => {
    // First call from mount
    mockApi.logBrandRequest.mockResolvedValueOnce({ success: true, brandHandle: 'cosstores.com', count: 0 });
    // Second call from notify submit
    mockApi.logBrandRequest.mockResolvedValueOnce({ success: true, brandHandle: 'cosstores.com', count: 1 });

    const { getByTestId, queryByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    await waitFor(() => expect(mockApi.logBrandRequest).toHaveBeenCalledTimes(1));

    fireEvent.press(getByTestId('fit-result-error-notify-toggle'));
    fireEvent.changeText(getByTestId('fit-result-error-notify-input'), 'a@b.co');
    fireEvent.press(getByTestId('fit-result-error-notify-submit'));

    await waitFor(() => {
      expect(mockApi.logBrandRequest).toHaveBeenLastCalledWith({
        sourceUrl: URL,
        brandDisplay: 'Cosstores',
        requesterEmail: 'a@b.co',
      });
    });

    await waitFor(() => {
      expect(queryByTestId('fit-result-error-notify-confirm')).toBeTruthy();
    });
  });

  it('does not submit when email is invalid', () => {
    const { getByTestId } = render(
      <FitResultErrorCard
        url={URL}
        scrapeError={{ kind: 'unsupported', message: 'x' }}
        onGoBack={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('fit-result-error-notify-toggle'));
    fireEvent.changeText(getByTestId('fit-result-error-notify-input'), 'not-an-email');
    fireEvent.press(getByTestId('fit-result-error-notify-submit'));
    // Only the mount call — no submit call
    expect(mockApi.logBrandRequest).toHaveBeenCalledTimes(1);
  });
});
