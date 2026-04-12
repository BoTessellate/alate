/**
 * Unit tests: accountStore
 *
 * The store is a thin zustand slice but it's the source of truth for "is
 * the user signed in?" so the tiny surface area still matters. These tests
 * cover: initial state, setGoogleUser (set + clear-by-null), clearAccount,
 * and independence between successive mutations.
 *
 * Persistence is mocked globally via AsyncStorage in jest.setup.js so we
 * don't exercise the middleware — those integration points are covered by
 * the shareIntent flow test.
 */

import { useAccountStore, GoogleUser } from '../store/accountStore';

const SAMPLE_USER: GoogleUser = {
  id: 'google-oauth|12345',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  picture: 'https://lh3.googleusercontent.com/a/default',
};

describe('accountStore', () => {
  beforeEach(() => {
    // Reset to initial state between tests so previous test state doesn't
    // leak (zustand stores are module-singletons).
    useAccountStore.setState({ googleUser: null });
  });

  describe('initial state', () => {
    it('starts with no signed-in user', () => {
      expect(useAccountStore.getState().googleUser).toBeNull();
    });
  });

  describe('setGoogleUser', () => {
    it('stores a full user payload', () => {
      useAccountStore.getState().setGoogleUser(SAMPLE_USER);

      const { googleUser } = useAccountStore.getState();
      expect(googleUser).toEqual(SAMPLE_USER);
      // Spread-check to catch accidental property stripping
      expect(googleUser?.id).toBe('google-oauth|12345');
      expect(googleUser?.email).toBe('ada@example.com');
      expect(googleUser?.name).toBe('Ada Lovelace');
      expect(googleUser?.picture).toBe(
        'https://lh3.googleusercontent.com/a/default'
      );
    });

    it('stores a minimal user payload (only id + email)', () => {
      const minimal: GoogleUser = {
        id: 'google-oauth|67890',
        email: 'grace@example.com',
      };
      useAccountStore.getState().setGoogleUser(minimal);

      const { googleUser } = useAccountStore.getState();
      expect(googleUser).toEqual(minimal);
      expect(googleUser?.name).toBeUndefined();
      expect(googleUser?.picture).toBeUndefined();
    });

    it('overwrites an existing user on subsequent calls', () => {
      useAccountStore.getState().setGoogleUser(SAMPLE_USER);
      const replacement: GoogleUser = {
        id: 'google-oauth|99999',
        email: 'new@example.com',
        name: 'New User',
      };

      useAccountStore.getState().setGoogleUser(replacement);

      expect(useAccountStore.getState().googleUser).toEqual(replacement);
    });

    it('accepts null to sign the user out', () => {
      useAccountStore.getState().setGoogleUser(SAMPLE_USER);
      expect(useAccountStore.getState().googleUser).not.toBeNull();

      useAccountStore.getState().setGoogleUser(null);

      expect(useAccountStore.getState().googleUser).toBeNull();
    });
  });

  describe('clearAccount', () => {
    it('removes a signed-in user', () => {
      useAccountStore.getState().setGoogleUser(SAMPLE_USER);

      useAccountStore.getState().clearAccount();

      expect(useAccountStore.getState().googleUser).toBeNull();
    });

    it('is idempotent when no user is signed in', () => {
      expect(useAccountStore.getState().googleUser).toBeNull();

      useAccountStore.getState().clearAccount();

      expect(useAccountStore.getState().googleUser).toBeNull();
    });

    it('does not affect other store references after clear', () => {
      useAccountStore.getState().setGoogleUser(SAMPLE_USER);
      const snapshotBeforeClear = useAccountStore.getState().googleUser;

      useAccountStore.getState().clearAccount();

      // Original snapshot object is untouched (immutability check)
      expect(snapshotBeforeClear).toEqual(SAMPLE_USER);
    });
  });

  describe('selector usage pattern', () => {
    it('exposes googleUser via getState for consumers', () => {
      // Mirrors how screens read the store via `useAccountStore(s => s.googleUser)`.
      useAccountStore.getState().setGoogleUser(SAMPLE_USER);
      const select = (state: ReturnType<typeof useAccountStore.getState>) =>
        state.googleUser?.email ?? null;

      expect(select(useAccountStore.getState())).toBe('ada@example.com');
    });
  });
});
