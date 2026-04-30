/**
 * AccountScreen — Google sign-in flow tests.
 *
 * Two failure modes the user can hit after configuring Google Cloud
 * Console:
 *   1. Env vars not picked up → `hasAnyGoogleAuthConfig` is false, the
 *      "Not configured" toast shows.
 *   2. `useAuthRequest` or the userinfo fetch throws → the error
 *      boundary fallback shows the "Not configured" toast even
 *      though env vars ARE set, masking the real cause.
 *
 * babel-preset-expo inlines `process.env.EXPO_PUBLIC_*` at compile
 * time, so we can't toggle env vars at runtime in tests. Instead we
 * mock `googleAuthEnv` (the helper that wraps the env reads) — which
 * is also why that helper exists.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockGetGoogleAuthConfig = jest.fn();
const mockHasAnyGoogleAuthConfig = jest.fn();
const mockLogMissingGoogleAuthConfigOnce = jest.fn();

jest.mock('../utils/googleAuthEnv', () => ({
  getGoogleAuthConfig: () => mockGetGoogleAuthConfig(),
  hasAnyGoogleAuthConfig: () => mockHasAnyGoogleAuthConfig(),
  logMissingGoogleAuthConfigOnce: () => mockLogMissingGoogleAuthConfigOnce(),
}));

const mockUseAuthRequest = jest.fn();
const mockPromptAsync = jest.fn();

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'test://redirect'),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: (...args: unknown[]) => mockUseAuthRequest(...args),
}));

jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((arr: Uint8Array) => arr),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, props, children),
  };
});

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

import AccountScreen from '../screens/AccountScreen';
import { useAccountStore } from '../store/accountStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthRequest.mockReset();
  mockPromptAsync.mockReset();
  mockGetGoogleAuthConfig.mockReset();
  mockHasAnyGoogleAuthConfig.mockReset();
  mockLogMissingGoogleAuthConfigOnce.mockReset();
  mockUseAuthRequest.mockReturnValue([null, null, mockPromptAsync]);
  useAccountStore.getState().clearAccount();
});

describe('AccountScreen — Google sign-in configured path', () => {
  it('renders the configured path and calls useAuthRequest with the env client IDs', () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(true);
    mockGetGoogleAuthConfig.mockReturnValue({
      clientId: 'web-id.apps.googleusercontent.com',
      androidClientId: 'android-id.apps.googleusercontent.com',
      iosClientId: 'ios-id.apps.googleusercontent.com',
    });

    render(<AccountScreen />);

    expect(mockUseAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'web-id.apps.googleusercontent.com',
        androidClientId: 'android-id.apps.googleusercontent.com',
        iosClientId: 'ios-id.apps.googleusercontent.com',
      })
    );
  });

  it('triggers promptAsync when "Continue with Google" is tapped (configured path)', () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(true);
    mockGetGoogleAuthConfig.mockReturnValue({ clientId: 'web-id' });
    mockUseAuthRequest.mockReturnValue([null, null, mockPromptAsync]);

    const { getByText } = render(<AccountScreen />);
    fireEvent.press(getByText('Continue with Google'));

    expect(mockPromptAsync).toHaveBeenCalledTimes(1);
  });

  it('shows "Not configured" toast on tap when no env vars are present', () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(false);
    mockGetGoogleAuthConfig.mockReturnValue({});

    const { getByText, queryByText } = render(<AccountScreen />);
    expect(queryByText('Not configured')).toBeNull();

    fireEvent.press(getByText('Continue with Google'));
    expect(getByText('Not configured')).toBeTruthy();
  });

  it('logs a Sentry breadcrumb when env vars are missing', () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(false);
    mockGetGoogleAuthConfig.mockReturnValue({});

    render(<AccountScreen />);
    expect(mockLogMissingGoogleAuthConfigOnce).toHaveBeenCalled();
  });

  it('does NOT log the Sentry breadcrumb when env vars are present', () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(true);
    mockGetGoogleAuthConfig.mockReturnValue({ clientId: 'web-id' });

    render(<AccountScreen />);
    expect(mockLogMissingGoogleAuthConfigOnce).not.toHaveBeenCalled();
  });

  it('falls back to the "Not configured" card when useAuthRequest throws', () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(true);
    mockGetGoogleAuthConfig.mockReturnValue({ clientId: 'web-id' });
    mockUseAuthRequest.mockImplementation(() => {
      throw new Error('redirect URI not registered');
    });

    const originalError = console.error;
    console.error = jest.fn();
    try {
      const { getByText, queryByText } = render(<AccountScreen />);
      expect(queryByText('Not configured')).toBeNull();
      fireEvent.press(getByText('Continue with Google'));
      expect(getByText('Not configured')).toBeTruthy();
    } finally {
      console.error = originalError;
    }
  });

  it('fetches the userinfo and stores the user on a successful auth response', async () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(true);
    mockGetGoogleAuthConfig.mockReturnValue({ clientId: 'web-id' });
    mockUseAuthRequest.mockReturnValue([
      null,
      { type: 'success', authentication: { accessToken: 'fake-token' } },
      mockPromptAsync,
    ]);

    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        id: 'g-1',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    render(<AccountScreen />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://www.googleapis.com/userinfo/v2/me',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }),
        })
      );
    });
    await waitFor(() => {
      const stored = useAccountStore.getState().googleUser;
      expect(stored?.email).toBe('user@example.com');
    });
  });

  it('shows "Sign-in error" toast when the userinfo fetch fails', async () => {
    mockHasAnyGoogleAuthConfig.mockReturnValue(true);
    mockGetGoogleAuthConfig.mockReturnValue({ clientId: 'web-id' });
    mockUseAuthRequest.mockReturnValue([
      null,
      { type: 'success', authentication: { accessToken: 'fake-token' } },
      mockPromptAsync,
    ]);

    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { findByText } = render(<AccountScreen />);
    expect(await findByText('Sign-in error')).toBeTruthy();
  });
});
